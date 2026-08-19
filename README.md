# Puño y Letra

A slow correspondence platform for AI ethics, in the tradition of the Republic of Letters.

Everything published here arrives *de puño y letra* — by its author's own hand and signature.
Correspondents photograph a handwritten letter, the posting house transcribes it to editable
text, and the author corrects the transcription before sealing it.

The name comes from the notarial formula *"de su puño y letra"*: written and signed by one's
own hand, as a notary would attest.

## Why it works this way

Two mechanics carry the whole product:

**The balanced seal.** Praise and dissent are minted in pairs. A correspondent may hold at
most one unpaid endorsement — to endorse a second letter, they must first challenge one they
genuinely contest. Agreement is never free; it costs the harder act of saying what you doubt.

**A challenge is marginalia, not a downvote.** No challenge counts without a written reason,
published in the margin under the challenger's name. This is what stops the balance rule from
degrading into a dislike *tax* paid carelessly: dissent costs a sentence, so it stays a
contribution rather than a punishment.

The handwriting requirement is the third pillar and the one no competitor has tried. In an
internet drowning in generated text, a photographed handwritten letter is the cheapest
available proof of human effort — a spam moat, an AI-slop moat, and a brand in one gesture.
It is also a hard cap on growth, and deliberately so.

## Current state

`index.html` is a **working front-end prototype** — a single self-contained file, no build
step, no dependencies. Open it in a browser.

Published preview (private Claude artifact, same file):
<https://claude.ai/code/artifact/388910c1-1136-4dda-b24f-f0fc4fa52812>

What works:

- Left sidebar with collapsible icon rail; single-page routing (one section per view)
- Home, Charter, Catalogue, Today's Post, Write, Desk
- The eight-article Charter
- Endorse / challenge seals with the balance rule enforced, signed marginalia, a tilting
  balance-scale ledger in the sidebar
- Manuscript ⇄ transcription animation (scan-line wipe) on every letter
- Catalogue gallery with topic filters, a private ★ shelf, and per-correspondence subscriptions
- Compose sheet: handwritten-original upload (file picker + camera capture), simulated OCR,
  account-level default visibility with a per-letter override
- Sign-up overlay with Google and email paths
- Profile page: seal (initials or uploaded photo), bio, and a video introduction with a
  daily passphrase, plus the human-verification panel and the originality attestation
- **Eight languages** — English, Español, Português, Français, Italiano, Deutsch, Latin,
  Esperanto — auto-detected, switchable from the profile menu. Latin is not a joke: the
  original Republic of Letters corresponded in it.
- **Letter translation.** The OCR transcription of every letter can be read in any supported
  language. The manuscript is never translated — it is the author's hand and stays canonical —
  and each translation carries a label naming it a machine translation of the transcription,
  with the original one click away.

### Delivery by email

Two rules, both on by default:

1. **Every letter you seal is mailed back to you** — your own record of what went out.
2. **Every reply to your letters is mailed to you** — an answer reaches your inbox with the
   daily post, not a notification badge.

A daily digest of the whole post is available and off by default.

The front end owns the *rules* (Profile → Delivery by email); a server carries the mail, since
a static page cannot send it and an API key in client code would be public. The server side is
written and reviewable:

- `supabase/schema.sql` — correspondents, mail_prefs, letters, and `mail_log`, whose
  `unique (letter_id, recipient_id, kind)` constraint is the idempotency guard: a retry cannot
  mail the same letter twice.
- `supabase/functions/mail-letter/index.ts` — sends `own_copy` and `reply` mail for one letter.
  It claims the send in `mail_log` *before* calling the provider and releases the claim if the
  provider fails, so failures retry and successes never double-send. Includes a plain-text
  alternative and one-click `List-Unsubscribe` headers (required by Gmail and Yahoo for bulk
  senders). Secrets: `RESEND_API_KEY`, `MAIL_FROM`, `SITE_URL`, plus the Supabase pair.

Invoke it per letter from the daily delivery job — the post stays slow on purpose (Art. VI).

### On proving a human made it

There is no reliable detector for AI-generated text, images, or video, and false accusations
fall hardest on real people. So the platform does not run detectors. It relies on, in order
of how much weight they carry:

1. **The hand.** The video introduction requires reading aloud a passphrase that changes daily
   while holding it up in your own handwriting — which must match the handwriting on your
   letters. One person, one hand, two places. A pre-made video cannot satisfy it.
2. **Provenance.** Recording in-app is distinguished from uploading; where a file carries
   C2PA Content Credentials they are read and published, and a file stripped of metadata is
   treated as unknown rather than innocent.
3. **Human review.** Every new seal, bio, and introduction is read by a person before it
   appears (Art. VIII).

Plus the attestation every correspondent signs at save time (Art. II, Art. III).

What is **simulated** and needs a backend:

- OCR of the uploaded photograph (the transcription is faked, and labelled as such on the page)
- Google OAuth and email sign-in
- Persistence: seals, letters, shelves, and subscriptions live in the browser only
- The daily delivery job

## Roadmap

1. **Backend.** Supabase fits: `letters`, `seals`, `marginalia`, `subscriptions`, `profiles`
   tables; Supabase Auth for the Google provider and passwordless email; Storage for the
   manuscript images; a scheduled function for the once-a-day delivery.
2. **Real OCR.** A frontier vision model transcribes the manuscript; the author always
   corrects the result before sealing. Never publish an uncorrected transcription.
3. **Enforcement for Art. III.** Plagiarism detection on transcriptions at post time —
   "the ledger remembers" is only credible if something actually checks.
4. **Accessibility path for Art. II.** Mandatory handwriting excludes people with motor
   impairments. Decide the accommodation before launch, not after a complaint.
5. **History-API routing.** Swap the hash router for real paths (`/catalogue`) once served
   from a host that can rewrite all routes to the app.

## Monetization

- Free public Republic; **private threads / salons** as the paid tier (Letterloop validates
  this shape at ~$5/month)
- Patron / founding-member tier
- An annual **printed anthology** of the year's best letters — suits the brand, real margins
- **The Writing Desk**: affiliate links to paper, pens, ink, and penmanship books

Explicitly ruled out: licensing the letter corpus as AI training data. It would betray the
premise that justifies the handwriting ritual in the first place.

### Affiliate tag — action required

`index.html` ships with the placeholder tag `YOURTAG-20` so no clicks credit anyone else.
After enrolling in Amazon Associates, replace it in one place:

```js
var TAG = 'YOURTAG-20';
```

Notes: links are search-style (`/s?k=…&tag=…`) so they never 404; every link carries
`rel="sponsored"`; the FTC-required disclosure is on the Desk page and must stay there.
A `.com` tag earns nothing from buyers on Amazon ES/MX/FR/IT/DE — add regional programs or
a geo-router (OneLink, Geniuslink) once traffic justifies it. Affiliate links belong **only**
on the Desk page, never inside letters or marginalia.

## Prior art worth knowing

- **Letter (letter.wiki)** — the closest precedent, nearly feature-for-feature. Drew Chomsky,
  Harari, Hirsi Ali; its most popular exchanges still reached only tens of thousands of views.
  Never found revenue; acquired by Substack in 2021. The format has cachet and a structurally
  small audience.
- **Slowly** — distance-based delayed delivery; monetizes cosmetics and collectible stamps.
- **Letterloop** — private group newsletters, ~$5/month. Validates the paid-private-thread tier.
- **Interintellect** — paid salons, ~$15/month. People do pay for curated conversation, but
  they are buying live events and belonging, not archive access.
- **Stack Overflow** — has charged reputation to downvote for over 15 years. Costly negative
  signals are proven.

The honest read: this works as a crafted niche community with modest real revenue, not as a
growth business. Build it like a lighthouse, not a shopping mall.

## Domain

`puñoyletra.ink` (punycode `xn--puoyletra-m6a.ink`) and `punoyletra.ink` both appeared
unregistered as of 2026-08-18 — register **both** and make the ASCII form canonical, since
IDN email and some social platforms handle `ñ` unreliably.

## Design

Prussian blue and sealing wax on paper; serif throughout; light and dark themes driven by
CSS custom properties. Colors are defined once as tokens on `:root` and redefined for both
`prefers-color-scheme: dark` and an explicit `data-theme="dark"`.
