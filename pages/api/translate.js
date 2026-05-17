export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text, sourceLang, targetLang, anthropicKey } = req.body
  if (!text || !targetLang) return res.status(400).json({ error: 'Missing params' })

  const apiKey = process.env.ANTHROPIC_API_KEY || anthropicKey
  if (!apiKey) return res.status(400).json({ error: 'Missing Anthropic API key' })

  const langNames = {
    it: 'italiano',
    tr: 'turco moderno e naturale',
    en: 'inglese britannico naturale e fluente',
    sq: 'albanese (shqip) moderno e naturale'
  }

  const srcName = langNames[sourceLang] || 'italiano'
  const tgtName = langNames[targetLang] || langNames.en

  const systemPrompt = `Sei un interprete simultaneo professionista specializzato in corsi aziendali e formativi. Traduci il testo ${srcName} in ${tgtName}. Mantieni il tono formativo ma accessibile e naturale. Rispondi SOLO con la traduzione, senza spiegazioni o altro testo.`

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
