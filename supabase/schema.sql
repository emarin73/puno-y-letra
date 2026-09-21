-- Puño y Letra — Picture-First Epistolary & Audio Reading Schema
-- Everything arrives de puño y letra — by manuscript picture & author's voice reading.

create extension if not exists citext;
create extension if not exists pgcrypto;

create table if not exists correspondents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  name         text not null,                 -- real name, Art. II
  email        citext not null unique,
  bio          text,                          -- author introduction / bio
  primary_lang text default 'spa',            -- primary manuscript writing language
  avatar_image text,                          -- base64 profile avatar seal
  attested     boolean default false,         -- Art. II attestation
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create table if not exists mail_prefs (
  correspondent_id uuid primary key references correspondents(id) on delete cascade,
  mail_own      boolean not null default true,
  mail_replies  boolean not null default true,
  mail_digest   boolean not null default false,
  unsub_token   uuid not null default gen_random_uuid(),
  updated_at    timestamptz not null default now()
);

create table if not exists letters (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid references correspondents(id) on delete cascade,
  author_name       text not null default 'A Correspondent',
  in_reply_to       uuid references letters(id) on delete set null,
  title             text not null,
  -- Primary manuscript photo(s)
  manuscript_url    text,
  manuscript_images jsonb default '[]'::jsonb,
  -- Voice Audio Reading by Author
  audio_url         text,
  audio_duration    int default 0,
  -- Optional summary / brief note
  summary           text default '',
  orig_lang         text not null default 'es',
  visibility        text not null default 'public'
                    check (visibility in ('public', 'private')),
  sealed_at         timestamptz not null default now(),
  posted_at         timestamptz default now()
);

create index if not exists letters_reply_idx on letters(in_reply_to);
create index if not exists letters_posted_idx on letters(posted_at desc);

create table if not exists marginalia (
  id             uuid primary key default gen_random_uuid(),
  letter_id      uuid not null references letters(id) on delete cascade,
  author_id      uuid references correspondents(id) on delete set null,
  author_name    text not null default 'A Correspondent',
  image_url      text,                          -- photo scrap of handwritten margin/annotation
  audio_url      text,                          -- optional voice note
  text_note      text default '',               -- optional short text reason
  ref_letter_id  uuid references letters(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists marginalia_letter_idx on marginalia(letter_id);

create table if not exists endorsements (
  id             uuid primary key default gen_random_uuid(),
  letter_id      uuid not null references letters(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (letter_id, user_id)
);

create table if not exists mail_log (
  id           uuid primary key default gen_random_uuid(),
  letter_id    uuid not null references letters(id) on delete cascade,
  recipient_id uuid not null references correspondents(id) on delete cascade,
  kind         text not null check (kind in ('own_copy', 'reply', 'digest')),
  provider_id  text,
  sent_at      timestamptz not null default now(),
  unique (letter_id, recipient_id, kind)
);
