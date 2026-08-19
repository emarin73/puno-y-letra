-- Puño y Letra — mail delivery schema
--
-- Two rules drive every send:
--   1. a letter is mailed back to its own author as their record
--   2. a reply is mailed to the author of the letter it answers
--
-- Nothing is mailed twice: mail_log has a uniqueness constraint per (letter, recipient, kind).

create table if not exists correspondents (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                 -- real name, Art. II
  email        citext not null unique,
  created_at   timestamptz not null default now()
);

create table if not exists mail_prefs (
  correspondent_id uuid primary key references correspondents(id) on delete cascade,
  -- defaults match the product: own letters and their replies are mailed
  mail_own      boolean not null default true,
  mail_replies  boolean not null default true,
  mail_digest   boolean not null default false,
  -- one-click unsubscribe token, required by bulk-sender rules
  unsub_token   uuid not null default gen_random_uuid(),
  updated_at    timestamptz not null default now()
);

create table if not exists letters (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references correspondents(id) on delete cascade,
  in_reply_to    uuid references letters(id) on delete set null,
  title          text not null,
  -- the manuscript is canonical; the transcription is derived from it
  manuscript_url text not null,
  transcription  text not null,
  orig_lang      text not null default 'en',
  visibility     text not null default 'public'
                 check (visibility in ('public', 'private')),
  sealed_at      timestamptz not null default now(),
  -- letters wait for the daily delivery (Art. VI)
  posted_at      timestamptz
);

create index if not exists letters_reply_idx on letters(in_reply_to);
create index if not exists letters_pending_idx on letters(posted_at) where posted_at is null;

create table if not exists mail_log (
  id           uuid primary key default gen_random_uuid(),
  letter_id    uuid not null references letters(id) on delete cascade,
  recipient_id uuid not null references correspondents(id) on delete cascade,
  kind         text not null check (kind in ('own_copy', 'reply', 'digest')),
  provider_id  text,                          -- id returned by the mail provider
  sent_at      timestamptz not null default now(),
  unique (letter_id, recipient_id, kind)       -- the idempotency guard
);
