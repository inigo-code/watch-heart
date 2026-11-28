// Runs Watch Heart's friend SQL, entry-social.sql and entry-reactions.sql on PGlite (Postgres in Node), with
// stand-ins for Supabase's auth and storage schemas, and checks reactions on entries: who can react, what each
// person sees, and that old-style likes still work. Run it like comment-reactions.check.mjs (from a scratch
// folder with @electric-sql/pglite@0.3.15):
//   node <that folder>/entry-reactions.check.mjs "<path to Watch Heart>"
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
for (const f of ['schema.sql', 'people.sql', 'friends-safety.sql', 'entry-social.sql']) {
  try {
    await db.exec(read(f));
  } catch (e) {
    console.error('FAILED loading', f, e.message);
    process.exit(1);
  }
}

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
let n = 0;
const ok = (name) => console.log(`ok ${++n} ${name}`);

// A like from before the reactions: it becomes a heart.
await as(B);
await q(`select public.like_entry($1, 'e1', true)`, [A]);

for (const f of ['entry-reactions.sql', 'entry-reactions.sql']) {
  try {
    await db.exec(read(f));
  } catch (e) {
    console.error('FAILED loading', f, e.message);
    process.exit(1);
  }
}
assert.equal((await q(`select emoji from public.entry_likes where user_id = $1`, [B]))[0].emoji, '❤️');
ok('runs twice; a like from before is a heart');

const react = async (emoji) => (await q(`select public.react_entry($1, 'e1', $2) r`, [A, emoji]))[0].r;
const faces = async () =>
  (await q(`select emoji, count, mine from public.entry_reactions(array[$1]::uuid[], array['e1']) order by emoji`, [A])).map((r) => [r.emoji, r.count, r.mine]);
const social = async () => (await q(`select likes, liked from public.entry_social(array[$1]::uuid[], array['e1'])`, [A]))[0];

await as(C);
assert.equal(await react('😂'), '😂');
assert.deepEqual(await faces(), [['❤️', 1, false], ['😂', 1, true]].sort());
assert.deepEqual(await social(), { likes: 2, liked: true });
ok('a reaction is a like: counts and "liked" include it');

await as(B);
assert.deepEqual(await faces(), [['❤️', 1, true], ['😂', 1, false]].sort());
assert.equal(await react('🔥'), '🔥');
assert.deepEqual(await faces(), [['🔥', 1, true], ['😂', 1, false]].sort());
ok('one each: a new emoji replaces your like');

await as(B);
await q(`select public.like_entry($1, 'e1', true)`, [A]);
assert.equal((await q(`select emoji from public.entry_likes where user_id = $1`, [B]))[0].emoji, '🔥');
ok('an older app liking again keeps the emoji');

assert.equal(await react('🔥'), null);
assert.equal(await react(null), null);
assert.deepEqual(await faces(), [['😂', 1, false]]);
await as(C);
await q(`select public.like_entry($1, 'e1', false)`, [A]);
assert.deepEqual(await faces(), []);
ok('the same one again, none, or an older app’s unlike takes it off');

await as(A);
assert.equal(await react('😂'), null);
assert.equal((await q(`select count(*)::int c from public.entry_likes where user_id = $1`, [A]))[0].c, 0);
ok('reacting to your own entry does nothing');

await as(C);
await fails(`select public.react_entry($1, 'e1', '👎')`, [A], /Pick one of the reactions shown/);
await as(D);
await fails(`select public.react_entry($1, 'e1', '🔥')`, [A], /isn’t shared with you/);
assert.deepEqual(await faces(), []);
await as(null);
await fails(`select public.react_entry($1, 'e1', '🔥')`, [A], /Sign in first/);
ok('other emoji, strangers and signed-out calls are refused; strangers see nothing');

// The owner sees who; alerts name the emoji
await as(B);
await react('🍿');
await as(C);
await react('❤️');
await as(A);
const who = (await q(`select name, emoji from public.entry_reactors($1, 'e1') order by name`, [A])).map((r) => [r.name, r.emoji]);
assert.deepEqual(who, [['Bosco', '🍿'], ['Chitra', '❤️']]);
const news = (await q(`select who, body from public.social_news(null) where kind = 'like' order by who`)).map((r) => [r.who, r.body]);
assert.deepEqual(news, [['Bosco', '🍿'], ['Chitra', null]]);
await as(B);
assert.equal((await q(`select * from public.entry_reactors($1, 'e1')`, [A])).length, 0);
ok('only the owner sees who reacted with what; a heart is a plain like in alerts');

// Blocking
await as(C);
await q(`select public.block_person($1)`, [B]);
assert.deepEqual(await faces(), [['❤️', 1, true]]);
await as(B);
assert.deepEqual(await faces(), [['🍿', 1, true]]);
ok('blocking hides reactions both ways');

console.log(`all ${n} passed`);
