// Vercel Serverless Function: /api/profile.js
// Persistent Correspondent Profile & Handwriting Calibration API powered by Supabase DB

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eualuswwyosllmnumemt.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let supabase = null;
  if (supabaseUrl && supabaseKey) {
    try {
      supabase = createClient(supabaseUrl, supabaseKey);
    } catch (e) {
      console.warn('Supabase client init warning:', e.message);
    }
  }

  if (req.method === 'GET') {
    const { email } = req.query || {};
    if (!email) {
      return res.status(400).json({ error: 'Missing email parameter' });
    }

    if (!supabase) {
      return res.status(200).json({ success: false, note: 'Supabase client unavailable' });
    }

    try {
      const { data, error } = await supabase
        .from('correspondents')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile from Supabase:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        profile: data || null
      });
    } catch (err) {
      console.error('GET /api/profile exception:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { email, name, bio, primary_lang, calib_image, calib_text } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Missing required email field' });
    }

    const payload = {
      email: email.trim().toLowerCase(),
      name: name ? name.trim() : 'Anonymous Correspondent',
      bio: bio ? bio.trim() : null,
      primary_lang: primary_lang || 'spa',
      calib_image: calib_image || null,
      calib_text: calib_text ? calib_text.trim() : null,
      updated_at: new Date().toISOString()
    };

    if (!supabase) {
      return res.status(200).json({
        success: true,
        stored: 'local_only',
        profile: payload,
        note: 'Supabase DB credentials not present on server. Profile stored locally.'
      });
    }

    try {
      const { data, error } = await supabase
        .from('correspondents')
        .upsert(payload, { onConflict: 'email' })
        .select()
        .single();

      if (error) {
        console.error('Error upserting profile in Supabase:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        stored: 'supabase_db',
        profile: data
      });
    } catch (err) {
      console.error('POST /api/profile exception:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
