// Runs Watch Heart's friend SQL, entry-social.sql and comment-reactions.sql on PGlite (Postgres in Node), with
// stand-ins for Supabase's auth and storage schemas, and checks who can react to comments and what they see.
// PGlite isn't a dependency of the app (package.json counts towards the runtime fingerprint), so run it from a
// scratch folder:
//   npm i @electric-sql/pglite@0.3.15   (in that folder), then
//   node <that folder>/comment-reactions.check.mjs "<path to Watch Heart>"   with this file copied there.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = process.argv[2];
const db = new PGlite();
const read = (f) =>
  readFileSync(`${dir}/supabase/${f}`, 'utf8').replace(/create extension if not exists pgcrypto with schema extensions;/g, '');

await db.exec(`
  create role authenticated; create role anon; create publication supabase_realtime;
  create schema auth; create schema extensions; create schema storage;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
`);
for (const f of ['schema.sql', 'people.sql', 'friends-safety.sql', 'entry-social.sql', 'comment-reactions.sql']) {
  try {
    await db.exec(read(f));
  } catch (e) {
    console.error('FAILED loading', f, e.message);
    process.exit(1);
  }
}
// Twice: it must be safe to run again.
await db.exec(read('comment-reactions.sql'));

const id = (n) => `00000000-0000-0000-0000-00000000000${n}`;
const [A, B, C, D] = [1, 2, 3, 4].map(id);
await db.exec(`insert into auth.users values ('${A}'),('${B}'),('${C}'),('${D}');`);
await db.exec(`
  insert into public.profiles (user_id, data, photo_path, modified_at) values
    ('${A}', '{"name":"Asha"}', null, 1), ('${B}', '{"name":"Bosco"}', null, 1),
    ('${C}', '{"name":"Chitra"}', null, 1), ('${D}', '{"name":"Dev"}', null, 1);
  insert into public.friendships values ('${A}','${B}'),('${B}','${A}'),('${A}','${C}'),('${C}','${A}'),('${B}','${D}'),('${D}','${B}');
  insert into public.entries (user_id, id, data, modified_at) values ('${A}', 'e1', '{"id":"e1","title":"Past Lives"}', 1);
`);

const as = async (who) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who ?? '']);
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const fails = async (sql, args, re) => {
  await assert.rejects(db.query(sql, args), re);
};
const react = async (comment, emoji) => (await q(`select public.react_comment($1, $2) r`, [comment, emoji]))[0].r;
const counts = async () =>
  (await q(`select comment_id, emoji, count, mine from public.comment_reaction_counts($1, 'e1') order by comment_id, emoji`, [A])).map((r) => [
    r.comment_id === bosco ? 'bosco' : 'asha',
    r.emoji,
    r.count,
    r.mine,
  ]).sort((x, y) => `${x[0]}${x[1]}`.localeCompare(`${y[0]}${y[1]}`));
let n = 0;
const ok = (name) => console.log(`ok ${++n} ${name}`);

await as(B);
const bosco = (await q(`select public.add_comment($1, 'e1', 'So good') c`, [A]))[0].c;
await as(A);
const asha = (await q(`select public.add_comment($1, 'e1', 'Thank you') c`, [A]))[0].c;

// Reacting
await as(A);
assert.equal(await react(bosco, '🍿'), '🍿');
await as(C);
assert.equal(await react(bosco, '🍿'), '🍿');
assert.equal(await react(asha, '❤️'), '❤️');
ok('the owner and friends react to comments and replies');
assert.deepEqual(await counts(), [['asha', '❤️', 1, true], ['bosco', '🍿', 2, true]]);
await as(B);
assert.deepEqual(await counts(), [['asha', '❤️', 1, false], ['bosco', '🍿', 2, false]]);
ok('everyone who sees the entry sees the counts, and which one is theirs');

await as(B);
assert.equal(await react(bosco, '🔥'), null);
assert.equal((await q(`select count(*)::int c from public.comment_reactions where user_id = $1`, [B]))[0].c, 0);
ok('reacting to your own comment does nothing');

await as(C);
assert.equal(await react(bosco, '😂'), '😂');
assert.equal((await q(`select emoji from public.comment_reactions where user_id = $1 and comment_id = $2`, [C, bosco]))[0].emoji, '😂');
ok('one reaction each: a new one replaces it');
assert.equal(await react(bosco, '😂'), null);
assert.equal(await react(asha, null), null);
assert.equal((await q(`select count(*)::int c from public.comment_reactions where user_id = $1`, [C]))[0].c, 0);
ok('the same one again, or none, takes it off');

await fails(`select public.react_comment($1, '👎')`, [bosco], /Pick one of the reactions shown/);
await as(D);
await fails(`select public.react_comment($1, '🔥')`, [bosco], /isn’t shared with you/);
assert.equal((await q(`select * from public.comment_reaction_counts($1, 'e1')`, [A])).length, 0);
await as(null);
await fails(`select public.react_comment($1, '🔥')`, [bosco], /Sign in first/);
ok('other emoji, strangers and signed-out calls are refused; strangers see nothing');

// Blocking
await as(C);
await react(asha, '🔥');
await as(B);
await react(asha, '😮');
await as(C);
await q(`select public.block_person($1)`, [B]);
assert.deepEqual(await counts(), [['asha', '🔥', 1, true]]);
ok('blocking hides their reactions and the reactions on their comments');
await fails(`select public.react_comment($1, '🔥')`, [bosco], /isn’t shared with you/);
ok('you can’t react to a blocked person’s comment');
await as(B);
assert.deepEqual((await counts()).filter((r) => r[0] === 'asha'), [['asha', '😮', 1, true]]);
ok('they don’t see yours either');

// Deleting
await as(A);
await q(`select public.delete_comment($1)`, [asha]);
assert.equal((await q(`select count(*)::int c from public.comment_reactions where comment_id = $1`, [asha]))[0].c, 0);
ok('a deleted comment takes its reactions with it');

console.log(`all ${n} passed`);
