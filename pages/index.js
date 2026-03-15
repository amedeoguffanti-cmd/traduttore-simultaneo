import { useState, useRef, useEffect, useCallback } from 'react'
import Head from 'next/head'
import styles from '../styles/Home.module.css'

const LANGS = {
  it: {
    flag: '🇮🇹', name: 'Italiano', browserLang: 'it-IT',
    placeholder: 'La traduzione apparirà qui...'
  },
  en: {
    flag: '🇬🇧', name: 'English', browserLang: 'en-GB',
    placeholder: 'Translation will appear here...'
  },
  tr: {
    flag: '🇹🇷', name: 'Türkçe', browserLang: 'tr-TR',
    placeholder: 'Çeviri burada görünecek...'
  }
}

const VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah — naturale, chiara' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Liam — maschile, caldo' },
  { id: 'pqHfZKP75CvOlQylNhV4', label: 'Bill — profondo, autorevole' },
  { id: 'XB0fDUnXU5powFXDhCwa', label: 'Charlotte — femminile, morbida' },
  { id: 'nPczCjzI2devNBz1zQrb', label: 'Brian — neutro, professionale' },
  { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel — britannico, chiaro' }
]

export default function Home() {
  const [anthropicKey, setAnthropicKey]   = useState('')
  const [elevenKey,    setElevenKey]       = useState('')
  const [sourceLang,   setSourceLang]      = useState('it')
  const [targetLang,   setTargetLang]      = useState('en')
  const [voiceId,      setVoiceId]         = useState(VOICES[0].id)
  const [stability,    setStability]       = useState(0.55)
  const [rate,         setRate]            = useState(0.88)
  const [isRecording,  setIsRecording]     = useState(false)
  const [sourceText,   setSourceText]      = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [status,       setStatus]          = useState({ msg: 'Pronto — premi Inizia per registrare', type: '' })
  const [history,      setHistory]         = useState([])
  const [currentAudioUrl, setCurrentAudioUrl] = useState(null)

  const recognitionRef   = useRef(null)
  const translationTimer = useRef(null)
  const audioRef         = useRef(null)
  const lastFinalRef     = useRef('')

  // Cleanup audio URL on change
  useEffect(() => {
    return () => { if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl) }
  }, [currentAudioUrl])

  const st = useCallback((msg, type = '') => setStatus({ msg, type }), [])

  // ── Translation ────────────────────────────────────
  const translate = useCallback(async (text) => {
    st('Traduzione con Claude...', 'info')
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang, targetLang, anthropicKey })
      })
      const data = await res.json()
      if (data.error) { st('Errore Claude: ' + data.error, 'error'); return }

      const translation = data.translation
      setTranslatedText(translation)
      setHistory(h => [{ src: text, tgt: translation, srcLang: sourceLang, tgtLang: targetLang }, ...h].slice(0, 20))
      st('Traduzione pronta — avvio audio', 'ok')
      await speak(translation)
    } catch(e) {
      st('Errore: ' + e.message, 'error')
    }
  }, [sourceLang, targetLang, anthropicKey, elevenKey, voiceId, stability, rate])

  // ── ElevenLabs TTS ─────────────────────────────────
  const speakElevenLabs = useCallback(async (text) => {
    st('Sintesi vocale ElevenLabs...', 'info')
    const res = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId, stability, elevenKey })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'ElevenLabs error')
    }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    setCurrentAudioUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url })
    if (audioRef.current) { audioRef.current.pause() }
    audioRef.current = new Audio(url)
    audioRef.current.onplay  = () => st('Parlando...', 'info')
    audioRef.current.onended = () => st('Pronto per il prossimo segmento', 'ok')
    await audioRef.current.play()
  }, [voiceId, stability, elevenKey])

  const speakBrowser = useCallback((text, lang) => {
    const tgtLang = lang || targetLang
    return new Promise((resolve) => {
      window.speechSynthesis.cancel()
      const utt  = new SpeechSynthesisUtterance(text)
      utt.lang   = LANGS[tgtLang].browserLang
      utt.rate   = rate
      utt.pitch  = 1.0
      const voices = window.speechSynthesis.getVoices()
      const match  = voices.find(v => v.lang === LANGS[tgtLang].browserLang)
                  || voices.find(v => v.lang.startsWith(tgtLang))
      if (match) utt.voice = match
      utt.onstart  = () => st('Parlando...', 'info')
      utt.onend    = () => { st('Pronto per il prossimo segmento', 'ok'); resolve() }
      utt.onerror  = () => { st('Errore audio browser', 'error'); resolve() }
      window.speechSynthesis.speak(utt)
    })
  }, [targetLang, rate])

  const speak = useCallback(async (text) => {
    try {
      if (elevenKey.length > 10) await speakElevenLabs(text)
      else await speakBrowser(text)
    } catch(e) {
      st('ElevenLabs: ' + e.message + ' — uso voce browser', 'warn')
      await speakBrowser(text)
    }
  }, [elevenKey, speakElevenLabs, speakBrowser])

  // ── Recording ──────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!anthropicKey) { st('Inserisci la Anthropic API key', 'error'); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { st('Usa Chrome o Edge', 'error'); return }

    const rec = new SR()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = LANGS[sourceLang].browserLang

    rec.onstart  = () => { setIsRecording(true); st(`Ascolto attivo — parla in ${LANGS[sourceLang].name}`, 'info') }
    rec.onresult = (event) => {
      let interim = '', final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      if (interim) setSourceText(interim)
      if (final) {
        const f = final.trim()
        setSourceText(f)
        if (f !== lastFinalRef.current && f.length > 2) {
          lastFinalRef.current = f
          clearTimeout(translationTimer.current)
          translationTimer.current = setTimeout(() => translate(f), 600)
        }
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      st('Errore microfono: ' + e.error, 'error')
      setIsRecording(false)
    }
    rec.onend = () => { if (recognitionRef.current) rec.start() }

    recognitionRef.current = rec
    rec.start()
  }, [anthropicKey, sourceLang, translate])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null }
    setIsRecording(false)
    st('Registrazione fermata')
  }, [])

  const toggleRecording = () => isRecording ? stopRecording() : startRecording()

  const S = LANGS[sourceLang]
  const T = LANGS[targetLang]

  const handleSourceLang = (code) => {
    if (isRecording) return
    setSourceLang(code)
    setSourceText('')
    setTranslatedText('')
    if (code === targetLang) {
      const other = Object.keys(LANGS).find(k => k !== code)
      setTargetLang(other)
    }
  }

  const handleTargetLang = (code) => {
    setTargetLang(code)
    setTranslatedText('')
  }

  return (
    <>
      <Head>
        <title>Traduttore Simultaneo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.page}>
        <div className={styles.container}>

          <div className={styles.header}>
            <h1>Traduttore Simultaneo</h1>
            <p>Parla · Claude traduce · Voce naturale in output</p>
          </div>

          {/* API Keys */}
          <div className={styles.card}>
            <div className={styles.label}>Chiavi API</div>
            <div className={styles.apiRow}>
              <div className={styles.apiGroup}>
                <div className={styles.label}>Anthropic (traduzione)</div>
                <input className={styles.apiInput} type="password" placeholder="sk-ant-api03-..."
                  value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} />
              </div>
              <div className={styles.apiGroup}>
                <div className={styles.label}>ElevenLabs — voce naturale</div>
                <input className={styles.apiInput} type="password" placeholder="opzionale — voce browser come fallback"
                  value={elevenKey} onChange={e => setElevenKey(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Source Language */}
          <div className={styles.card}>
            <div className={styles.label}>Lingua di input (parli in)</div>
            <div className={styles.langRow}>
              {Object.entries(LANGS).map(([code, l]) => (
                <button key={code}
                  className={`${styles.langBtn} ${sourceLang === code ? styles.active : ''}`}
                  onClick={() => handleSourceLang(code)}
                  disabled={isRecording}>
                  {l.flag} {l.name}
                </button>
              ))}
            </div>
          </div>

          {/* Target Language + Voice */}
          <div className={styles.card}>
            <div className={styles.label}>Lingua di output (traduzione in)</div>
            <div className={styles.langRow}>
              {Object.entries(LANGS).filter(([code]) => code !== sourceLang).map(([code, l]) => (
                <button key={code}
                  className={`${styles.langBtn} ${targetLang === code ? styles.active : ''}`}
                  onClick={() => handleTargetLang(code)}>
                  {l.flag} {l.name}
                </button>
              ))}
            </div>

            {elevenKey.length > 10 ? (
              <>
                <div className={styles.voiceRow}>
                  <label>Voce ElevenLabs</label>
                  <select className={styles.voiceSelect} value={voiceId} onChange={e => setVoiceId(e.target.value)}>
                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </div>
                <div className={styles.speedRow}>
                  <label>Stabilità voce</label>
                  <input type="range" min="0.3" max="0.9" step="0.05" value={stability}
                    onChange={e => setStability(parseFloat(e.target.value))} />
                  <span className={styles.speedVal}>{Math.round(stability * 100)}%</span>
                </div>
              </>
            ) : (
              <div className={styles.speedRow}>
                <label>Velocità voce browser</label>
                <input type="range" min="0.7" max="1.2" step="0.05" value={rate}
                  onChange={e => setRate(parseFloat(e.target.value))} />
                <span className={styles.speedVal}>{Math.round(rate * 100)}%</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className={styles.controls}>
            <button className={`${styles.btn} ${styles.btnPrimary} ${isRecording ? styles.rec : ''}`}
              onClick={toggleRecording}>
              {isRecording ? '⏹ Ferma' : `🎙 Inizia — ${S.name}`}
            </button>
            <button className={styles.btn} disabled={!translatedText}
              onClick={() => speak(translatedText)}>
              🔊 Riproduci
            </button>
          </div>

          {/* Status */}
          <div className={`${styles.status} ${status.type ? styles[status.type] : ''}`}>
            {status.msg}
          </div>

          {/* Panels */}
          <div className={styles.panels}>
            <div className={styles.card}>
              <div className={styles.label}>{S.flag} {S.name} — trascrizione</div>
              <div className={`${styles.panelBody} ${!sourceText ? styles.placeholder : ''}`}>
                {sourceText || 'In attesa del parlato...'}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.label}>{T.flag} {T.name} — traduzione</div>
              <div className={`${styles.panelBody} ${!translatedText ? styles.placeholder : ''}`}>
                {translatedText || T.placeholder}
              </div>
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className={styles.card}>
              <div className={styles.label}>Storico sessione</div>
              <div className={styles.historyList}>
                {history.map((h, i) => (
                  <div key={i} className={styles.historyItem}>
                    <div className={styles.hIt}>
                      {LANGS[h.srcLang]?.flag} {h.src}
                      <span className={styles.hReplay} onClick={() => speak(h.tgt)}>▶ riproduci</span>
                    </div>
                    <div className={styles.hTr}>{LANGS[h.tgtLang]?.flag} {h.tgt}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.tip}>
            Richiede Chrome o Edge · Consenti accesso al microfono
            <br />
            ElevenLabs gratuito fino a 10.000 caratteri/mese →{' '}
            <a href="https://elevenlabs.io" target="_blank" rel="noreferrer">elevenlabs.io</a>
          </div>

        </div>
      </div>
    </>
  )
}
