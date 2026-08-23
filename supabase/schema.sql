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
  bio          text,                          -- author introduction / bio
  primary_lang text default 'spa',            -- primary manuscript writing language
  avatar_image text,                          -- base64 profile avatar seal
  calib_image  text,                          -- handwriting calibration sample base64/URL
  calib_text   text,                          -- exact ground truth calibration key
  updated_at   timestamptz not null default now(),
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

-- ---------------------------------------------------------------------------
-- Quoting
--
-- A quote is an annotation, not a DOM range. It anchors to an IMMUTABLE
-- revision of the transcription, so correcting the OCR can never silently
-- move somebody else's quotation.
--
-- Anchors follow the W3C Web Annotation model: position for fast lookup,
-- exact text + surrounding context for repair when the position drifts.
-- Many replies may carry identical or overlapping anchors — that is the point.

create table if not exists transcription_revisions (
  letter_id   uuid not null references letters(id) on delete cascade,
  rev         int  not null,
  text        text not null,               -- canonical plain text; paragraphs joined by \n\n
  created_at  timestamptz not null default now(),
  primary key (letter_id, rev)
);

create table if not exists quotes (
  id           uuid primary key default gen_random_uuid(),
  -- the reply that carries the quotation
  reply_id     uuid not null references letters(id) on delete cascade,
  -- the letter and exact revision being quoted
  letter_id    uuid not null references letters(id) on delete cascade,
  rev          int  not null,
  -- TextPositionSelector
  start_offset int  not null check (start_offset >= 0),
  end_offset   int  not null,
  -- TextQuoteSelector (the repair kit, and what a reader sees if anchoring fails)
  exact        text not null,
  prefix       text not null default '',
  suffix       text not null default '',
  created_at   timestamptz not null default now(),
  check (end_offset > start_offset),
  foreign key (letter_id, rev) references transcription_revisions(letter_id, rev)
);

create index if not exists quotes_letter_span_idx on quotes(letter_id, rev, start_offset, end_offset);
create index if not exists quotes_reply_idx on quotes(reply_id);
