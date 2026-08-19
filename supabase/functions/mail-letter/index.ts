// Puño y Letra — mail-letter
//
// Sends the two letters the product promises:
//   • own_copy — the author's own sealed letter, mailed back as their record
//   • reply    — an answer, mailed to the author of the letter it answers
//
// Invoke per letter id, from the daily delivery job (Art. VI: the post is slow):
//   POST /functions/v1/mail-letter  { "letter_id": "<uuid>" }
//
// Secrets required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, MAIL_FROM, SITE_URL

import { createClient } from 'jsr:@supabase/supabase-js@2'

type Kind = 'own_copy' | 'reply'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const FROM = Deno.env.get('MAIL_FROM') ?? 'The Republic <post@punoyletra.ink>'
const SITE = Deno.env.get('SITE_URL') ?? 'https://punoyletra.ink'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A letter, in an envelope. The manuscript leads; the transcription follows. */
function render(opts: {
  kind: Kind
  title: string
  authorName: string
  transcription: string
  manuscriptUrl: string
  letterUrl: string
  unsubUrl: string
}) {
  const lede = opts.kind === 'own_copy'
    ? `Your letter is sealed and has gone out with today's post. This copy is for your own record.`
    : `${esc(opts.authorName)} has answered your letter. The manuscript is below; the transcription follows it.`

  const paras = opts.transcription
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 1em;line-height:1.65">${esc(p.trim())}</p>`)
    .join('')

  const html = `<!doctype html><html><body style="margin:0;background:#f3f3ee;padding:24px;
    font-family:Charter,Georgia,serif;color:#212b36">
    <div style="max-width:36rem;margin:0 auto;background:#fbfbf7;border:1px solid #d8d8cf;padding:28px">
      <p style="font:11px ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;
        color:#5c6670;margin:0 0 18px">Puño y Letra · ${opts.kind === 'reply' ? 'An answer' : 'Your record'}</p>
      <h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${esc(opts.title)}</h1>
      <p style="color:#3d4a58;margin:0 0 20px">${lede}</p>
      <p style="margin:0 0 20px"><a href="${opts.manuscriptUrl}" style="color:#1f4c74">View the manuscript ↗</a></p>
      ${paras}
      <p style="margin:24px 0 0"><a href="${opts.letterUrl}" style="color:#1f4c74">Read it in the Republic ↗</a></p>
      <p style="border-top:1px solid #e6e6dd;margin:24px 0 0;padding-top:12px;
        font-size:12px;color:#5c6670">
        The transcription is machine-read from the manuscript and may err; the hand is canonical.
        <a href="${opts.unsubUrl}" style="color:#5c6670">Stop these letters</a>.
      </p>
    </div></body></html>`

  // plain-text alternative — deliverability suffers without one
  const text = [
    opts.title, '', lede.replace(/<[^>]+>/g, ''), '',
    opts.transcription, '',
    `Manuscript: ${opts.manuscriptUrl}`,
    `In the Republic: ${opts.letterUrl}`,
    `Stop these letters: ${opts.unsubUrl}`,
  ].join('\n')

  return { html, text }
}

async function send(to: string, subject: string, body: { html: string; text: string }, unsubUrl: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject,
      html: body.html,
      text: body.text,
      // one-click unsubscribe: required by Gmail/Yahoo for bulk senders
      headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  })
  if (!res.ok) throw new Error(`provider ${res.status}: ${await res.text()}`)
  return (await res.json()).id as string
}

/** Records the send first, so a provider retry cannot mail the same letter twice. */
async function claim(letterId: string, recipientId: string, kind: Kind) {
  const { error } = await db.from('mail_log').insert({
    letter_id: letterId, recipient_id: recipientId, kind,
  })
  if (error) {
    if (error.code === '23505') return false // already logged — nothing to do
    throw error
  }
  return true
}

Deno.serve(async (req) => {
  try {
    const { letter_id } = await req.json()
    if (!letter_id) return Response.json({ error: 'letter_id required' }, { status: 400 })

    const { data: letter, error } = await db
      .from('letters')
      .select('id,title,transcription,manuscript_url,in_reply_to,author_id,correspondents!letters_author_id_fkey(id,name,email)')
      .eq('id', letter_id)
      .single()
    if (error || !letter) return Response.json({ error: 'letter not found' }, { status: 404 })

    const author = letter.correspondents as unknown as { id: string; name: string; email: string }
    const letterUrl = `${SITE}/#letters`
    const sent: Record<string, string> = {}

    // recipients: the author's own copy, plus the author being answered
    const targets: Array<{ id: string; kind: Kind }> = [{ id: author.id, kind: 'own_copy' }]
    if (letter.in_reply_to) {
      const { data: parent } = await db
        .from('letters').select('author_id').eq('id', letter.in_reply_to).single()
      // never mail someone an answer to their own letter twice over
      if (parent && parent.author_id !== author.id) targets.push({ id: parent.author_id, kind: 'reply' })
    }

    for (const target of targets) {
      const { data: person } = await db
        .from('correspondents').select('id,name,email').eq('id', target.id).single()
      if (!person) continue

      const { data: prefs } = await db
        .from('mail_prefs').select('mail_own,mail_replies,unsub_token').eq('correspondent_id', person.id).single()
      const wants = target.kind === 'own_copy' ? prefs?.mail_own !== false : prefs?.mail_replies !== false
      if (!wants) continue

      if (!(await claim(letter.id, person.id, target.kind))) continue

      const unsubUrl = `${SITE}/unsubscribe?token=${prefs?.unsub_token ?? ''}`
      const body = render({
        kind: target.kind,
        title: letter.title,
        authorName: author.name,
        transcription: letter.transcription,
        manuscriptUrl: letter.manuscript_url,
        letterUrl,
        unsubUrl,
      })
      const subject = target.kind === 'own_copy'
        ? `Your letter is sealed: ${letter.title}`
        : `${author.name} answered your letter`

      try {
        const providerId = await send(person.email, subject, body, unsubUrl)
        await db.from('mail_log').update({ provider_id: providerId })
          .eq('letter_id', letter.id).eq('recipient_id', person.id).eq('kind', target.kind)
        sent[target.kind] = person.email
      } catch (err) {
        // release the claim so the next delivery run retries this one
        await db.from('mail_log').delete()
          .eq('letter_id', letter.id).eq('recipient_id', person.id).eq('kind', target.kind)
        throw err
      }
    }

    return Response.json({ letter_id, sent })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
})
