// Runs Watch Heart's friend SQL plus entry-social.sql on PGlite (Postgres in Node), with stand-ins for
// Supabase's auth and storage schemas, and checks who sees and can do what. PGlite isn't a dependency of the
// app (package.json counts towards the runtime fingerprint), so run it from a scratch folder:
//   npm i @electric-sql/pglite@0.3.15   (in that folder), then
//   node <that folder>/entry-social.check.mjs "<path to Watch Heart>"   with this file copied there.
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
// Twice: it must be safe to run again.
await db.exec(read('entry-social.sql'));

const id = (n) => `00000000-0000-0000-0000-00000000000${n}`;
const [A, B, C, D] = [1, 2, 3, 4].map(id);
await db.exec(`insert into auth.users values ('${A}'),('${B}'),('${C}'),('${D}');`);
await db.exec(`
  insert into public.profiles (user_id, data, photo_path, modified_at) values
    ('${A}', '{"name":"Asha"}', '${A}/a.jpg', 1), ('${B}', '{"name":"Bosco"}', '${B}/b.jpg', 1),
    ('${C}', '{"name":"Chitra"}', '${C}/c.jpg', 1), ('${D}', '{"name":"Dev"}', null, 1);
  insert into public.friendships values ('${A}','${B}'),('${B}','${A}'),('${A}','${C}'),('${C}','${A}'),('${B}','${D}'),('${D}','${B}');
  insert into public.entries (user_id, id, data, modified_at) values
    ('${A}', 'e1', '{"id":"e1","title":"Past Lives","review":"Lovely","companions":["Mum"]}', 1),
    ('${A}', 'e2', '{"id":"e2","title":"Gone","deletedAt":"2026-01-01"}', 1);
`);

const as = async (who) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who ?? '']);
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const fails = async (sql, args, re) => {
  await assert.rejects(db.query(sql, args), re);
};
let n = 0;
const ok = (name) => console.log(`ok ${++n} ${name}`);

// Likes
await as(B);
await q(`select public.like_entry($1, 'e1', true)`, [A]);
await q(`select public.like_entry($1, 'e1', true)`, [A]); // twice is fine
ok('a friend likes an entry, twice is harmless');
await as(D);
await fails(`select public.like_entry($1, 'e1', true)`, [A], /isn’t shared with you/);
ok('someone who isn’t a friend can’t like it');
await as(A);
await q(`select public.like_entry($1, 'e1', true)`, [A]);
assert.equal((await q(`select count(*)::int c from public.entry_likes`))[0].c, 1);
ok('liking your own entry does nothing');

// Comments
await as(B);
await q(`select public.add_comment($1, 'e1', '  So good  ')`, [A]);
await as(C);
await q(`select public.add_comment($1, 'e1', 'Agreed')`, [A]);
await as(A);
await q(`select public.add_comment($1, 'e1', 'Thank you both')`, [A]);
await as(D);
await fails(`select public.add_comment($1, 'e1', 'hi')`, [A], /isn’t shared with you/);
await as(B);
await fails(`select public.add_comment($1, 'e1', '   ')`, [A], /Write something first/);
await fails(`select public.add_comment($1, 'e1', $2)`, [A, 'x'.repeat(1001)], /too long/);
await fails(`select public.add_comment($1, 'e2', 'hi')`, [A], /isn’t shared with you/);
await as(null);
await fails(`select public.add_comment($1, 'e1', 'hi')`, [A], /Sign in first/);
ok('friends and the owner comment; strangers, blanks, long ones, deleted entries and signed-out calls are refused');

await as(C);
let t = await q(`select * from public.entry_thread($1, 'e1')`, [A]);
assert.deepEqual(t.map((r) => [r.name, r.body]), [['Bosco', 'So good'], ['Chitra', 'Agreed'], ['Asha', 'Thank you both']]);
assert.equal(t[0].photo_path, null, 'no photo of someone you aren’t friends with');
assert.equal(t[2].photo_path, `${A}/a.jpg`);
ok('the whole conversation shows to another friend, photos only of friends');

await as(D);
assert.equal((await q(`select * from public.entry_thread($1, 'e1')`, [A])).length, 0);
ok('a stranger sees no conversation');

await as(C);
let s = await q(`select * from public.entry_social($1, $2)`, [[A, A, A], ['e1', 'e2', 'e1']]);
assert.deepEqual(s, [{ owner_id: A, entry_id: 'e1', likes: 1, liked: false, comments: 3 }]);
ok('counts for a batch, deleted and repeated entries left out');
assert.equal((await q(`select * from public.entry_likers($1, 'e1')`, [A])).length, 0);
ok('only the owner sees who liked');
await as(A);
assert.deepEqual((await q(`select name from public.entry_likers($1, 'e1')`, [A])).map((r) => r.name), ['Bosco']);
ok('the owner sees who liked');

await as(B);
const fe = (await q(`select public.friend_entry($1, 'e1') e`, [A]))[0].e;
assert.equal(fe.title, 'Past Lives');
assert.equal(fe.companions, undefined, 'watched-with names never shared');
ok('a friend opens the entry without its watched-with names');

// News
await as(A);
let news = await q(`select kind, who, title, body from public.social_news(null) order by kind, who`);
assert.deepEqual(news.map((r) => [r.kind, r.who]), [['comment', 'Bosco'], ['comment', 'Chitra'], ['like', 'Bosco']]);
assert.equal(news[0].title, 'Past Lives');
ok('the owner hears about likes and comments, not their own');
await as(B);
news = await q(`select kind, who from public.social_news(null) order by kind, who`);
assert.deepEqual(news.map((r) => [r.kind, r.who]), [['also', 'Chitra'], ['reply', 'Asha']]);
ok('a commenter hears about the owner’s reply and later comments');

// Blocking
await as(C);
await q(`select public.block_person($1)`, [B]);
t = await q(`select name from public.entry_thread($1, 'e1')`, [A]);
assert.deepEqual(t.map((r) => r.name), ['Chitra', 'Asha']);
s = await q(`select comments from public.entry_social($1, $2)`, [[A], ['e1']]);
assert.equal(s[0].comments, 2);
await as(B);
news = await q(`select kind, who from public.social_news(null)`);
assert.deepEqual(news.map((r) => r.who), ['Asha']);
ok('blocking hides each other’s comments, both ways');

// Deleting
await as(C);
const bosco = (await q(`select id from public.entry_comments where body = 'So good'`))[0].id;
await q(`select public.delete_comment($1)`, [bosco]);
assert.equal((await q(`select count(*)::int c from public.entry_comments`))[0].c, 3);
ok('you can’t delete someone else’s comment on someone else’s entry');
await as(A);
await q(`select public.delete_comment($1)`, [bosco]);
assert.equal((await q(`select count(*)::int c from public.entry_comments`))[0].c, 2);
ok('the owner deletes any comment on their entry');

// Unlike, and sharing off
await as(B);
await q(`select public.like_entry($1, 'e1', false)`, [A]);
assert.equal((await q(`select count(*)::int c from public.entry_likes`))[0].c, 0);
ok('unlike');
await db.exec(`update public.profiles set data = data || '{"sharing":{"diary":false}}', modified_at = 2 where user_id = '${A}'`);
assert.equal((await q(`select * from public.entry_thread($1, 'e1')`, [A])).length, 0);
await fails(`select public.add_comment($1, 'e1', 'hi')`, [A], /isn’t shared with you/);
await as(A);
assert.equal((await q(`select * from public.entry_thread($1, 'e1')`, [A])).length, 2);
ok('once the diary isn’t shared, only the owner sees the conversation');

console.log(`all ${n} passed`);
