export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text, voiceId, stability, elevenKey } = req.body
  if (!text || !voiceId) return res.status(400).json({ error: 'Missing text or voiceId' })

  const apiKey = process.env.ELEVENLABS_API_KEY || elevenKey
  if (!apiKey) return res.status(400).json({ error: 'Missing ElevenLabs API key' })

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: stability || 0.55,
          similarity_boost: 0.75,
          style: 0.35,
          use_speaker_boost: true
        }
      })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return res.status(response.status).json({ error: err?.detail?.message || 'ElevenLabs error' })
    }

    const audioBuffer = await response.arrayBuffer()
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    return res.send(Buffer.from(audioBuffer))
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
