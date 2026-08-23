// Vercel Serverless Function: /api/ocr.js
// Multimodal Language-Aware Handwritten OCR powered by Gemini 1.5 Flash Vision

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, lang } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        success: false,
        note: 'GEMINI_API_KEY not configured in Vercel. Falling back to local language-aware OCR engine.'
      });
    }

    let mimeType = 'image/jpeg';
    let base64Data = image;
    if (image.startsWith('data:')) {
      const parts = image.split(';base64,');
      mimeType = parts[0].replace('data:', '');
      base64Data = parts[1];
    }

    const langMap = {
      spa: 'Spanish (Español)',
      eng: 'English',
      fra: 'French (Français)',
      por: 'Portuguese (Português)',
      deu: 'German (Deutsch)',
      lat: 'Latin',
      epo: 'Esperanto',
      auto: 'auto-detected language'
    };
    const targetLang = langMap[lang] || 'Spanish or English';

    const prompt = `You are a master paleographer transcribing a handwritten letter. 
Carefully read the handwriting in this manuscript photo and transcribe its full text in ${targetLang}.
Return ONLY the raw transcribed letter text. Do NOT include markdown backticks, greetings to the user, or conversational preambles.`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048
      }
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini OCR API error:', errText);
      return res.status(500).json({ error: 'OCR processing failed at server level' });
    }

    const data = await response.json();
    const extractedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    return res.status(200).json({
      success: true,
      text: extractedText,
      lang: lang
    });
  } catch (err) {
    console.error('Serverless OCR exception:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
