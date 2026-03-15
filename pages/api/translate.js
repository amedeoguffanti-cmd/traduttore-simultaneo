export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text, sourceLang, targetLang, anthropicKey } = req.body
  if (!text || !targetLang) return res.status(400).json({ error: 'Missing text or targetLang' })

  const apiKey = process.env.ANTHROPIC_API_KEY || anthropicKey
  if (!apiKey) return res.status(400).json({ error: 'Missing Anthropic API key' })

  const langNames = { it: 'Italian', en: 'English', tr: 'Turkish' }
  const src = langNames[sourceLang] || 'Italian'
  const tgt = langNames[targetLang] || 'English'

  const systemPrompt = `You are a professional simultaneous interpreter specializing in corporate training and everyday conversation. Translate the ${src} text into natural, fluent ${tgt}. Keep the original tone — whether formal, casual, or instructional. Reply ONLY with the translation, no other text.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }]
      })
    })

    const data = await response.json()
    if (data.error) return res.status(500).json({ error: data.error.message })
    return res.status(200).json({ translation: data.content[0].text.trim() })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
