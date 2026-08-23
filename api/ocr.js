// Vercel Serverless Function: /api/ocr.js
// Multimodal Language-Aware Handwritten OCR powered by Gemini 1.5 Flash Vision (Multi-Page Support)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, images, lang } = req.body || {};
    const imageList = Array.isArray(images) && images.length > 0 ? images : (image ? [image] : []);

    if (imageList.length === 0) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        success: false,
        note: 'GEMINI_API_KEY not configured in Vercel. Falling back to local language-aware OCR engine.'
      });
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

    const promptText = `You are a master paleographer transcribing a handwritten letter. 
Carefully read the handwriting in each page of these ${imageList.length} manuscript photos and transcribe the full text in ${targetLang}.
If there are multiple pages, transcribe them page by page in order, labeling each page clearly with '[Page 1]', '[Page 2]', etc.
Return ONLY the raw transcribed letter text. Do NOT include markdown backticks (\`\`\`), greetings to the user, or conversational preambles.`;

    const parts = [{ text: promptText }];

    for (let i = 0; i < imageList.length; i++) {
      let mimeType = 'image/jpeg';
      let base64Data = imageList[i];
      if (base64Data.startsWith('data:')) {
        const splitParts = base64Data.split(';base64,');
        mimeType = splitParts[0].replace('data:', '');
        base64Data = splitParts[1];
      }
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });
    }

    const payload = {
      contents: [{ parts }],
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
      pageCount: imageList.length,
      lang: lang
    });
  } catch (err) {
    console.error('Serverless OCR exception:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
