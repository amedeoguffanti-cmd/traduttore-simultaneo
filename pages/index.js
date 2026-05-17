import { useState, useRef, useCallback } from 'react'
import Head from 'next/head'
import styles from '../styles/Home.module.css'

// ── Language config ────────────────────────────────────────────────────────
const LANGS = {
  it: { flag: '🇮🇹', name: 'Italiano',  browserLang: 'it-IT', placeholder: 'In attesa del parlato...' },
  tr: { flag: '🇹🇷', name: 'Turco',     browserLang: 'tr-TR', placeholder: 'Çeviri burada görünecek...' },
  en: { flag: '🇬🇧', name: 'Inglese',   browserLang: 'en-GB', placeholder: 'Translation will appear here...' },
  sq: { flag: '🇦🇱', name: 'Albanese',  browserLang: 'sq-AL', placeholder: 'Përkthimi do të shfaqet këtu...' }
}

const SOURCE_LANGS = ['it', 'sq']   // lingue parlabili in input
const TARGET_LANGS = ['tr', 'en', 'sq', 'it']  // lingue di output

const VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah — naturale, chiara (multi)' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Liam — maschile, caldo' },
  { id: 'pqHfZKP75CvOlQylNhV4', label: 'Bill — profondo, autorevole' },
  { id: 'XB0fDUnXU5powFXDhCwa', label: 'Charlotte — femminile, morbida' },
  { id: 'nPczCjzI2devNBz1zQrb', label: 'Brian — neutro, professionale' },
  { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel — britannico, chiaro' }
]

// ── Component ──────────────────────────────────────────────────────────────
export default function Home() {
  const [anthropicKey,    setAnthropicKey]    = useState('')
  const [elevenKey,       setElevenKey]        = useState('')
  const [sourceLang,      setSourceLang]       = useState('it')
  const [targetLang,      setTargetLang]       = useState('tr')
  const [voiceId,         setVoiceId]          = useState(VOICES[0].id)
  const [stability,       setStability]        = useState(0.55)
  const [rate,            setRate]             = useState(0.88)
  const [isRecording,     setIsRecording]      = useState(false)
  const [sourceText,      setSourceText]       = useState('')
  const [translatedText,  setTranslatedText]   = useState('')
  const [status,          setStatus]           = useState({ msg: 'Pronto — configura le API key e premi Inizia', type: '' })
  const [history,         setHistory]          = useState([])

  const recognitionRef   = useRef(null)
  const translationTimer = useRef(null)
  const audioRef         = useRef(null)
  const lastFinalRef     = useRef('')

  const st = useCallback((msg, type = '') => setStatus({ msg, type }), [])

  // prevent same target as source
  const handleSourceChange = (lang) => {
    setSourceLang(lang)
    setSourceText('')
    setTranslatedText('')
    if (targetLang === lang) {
      // pick first target that isn't the same
      const next = TARGET_LANGS.find(l => l !== lang)
      setTargetLang(next)
    }
  }
  const handleTargetChange = (lang) => {
    setTargetLang(lang)
    setTranslatedText('')
  }

  // ── Translation ──────────────────────────────────────────────────────────
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
    } catch (e) {
      st('Errore: ' + e.message, 'error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceLang, targetLang, anthropicKey, elevenKey, voiceId, stability, rate])

  // ── ElevenLabs TTS ───────────────────────────────────────────────────────
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
    if (audioRef.current) audioRef.current.pause()
    audioRef.current = new Audio(url)
    audioRef.current.onplay  = () => st('Parlando...', 'info')
    audioRef.current.onended = () => { st('Pronto per il prossimo segmento', 'ok'); URL.revokeObjectURL(url) }
    await audioRef.current.play()
  }, [voiceId, stability, elevenKey])

  const speakBrowser = useCallback((text) => {
    return new Promise((resolve) => {
      window.speechSynthesis.cancel()
      const utt  = new SpeechSynthesisUtterance(text)
      utt.lang   = LANGS[targetLang].browserLang
      utt.rate   = rate
      utt.pitch  = 1.0
      const voices = window.speechSynthesis.getVoices()
      const match  = voices.find(v => v.lang === LANGS[targetLang].browserLang)
                  || voices.find(v => v.lang.startsWith(targetLang))
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
    } catch (e) {
      st('ElevenLabs: ' + e.message + ' — uso voce browser', 'warn')
      await speakBrowser(text)
    }
  }, [elevenKey, speakElevenLabs, speakBrowser])

  // ── Recording ────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!anthropicKey) { st('Inserisci la Anthropic API key', 'error'); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { st('Usa Chrome o Edge per il riconoscimento vocale', 'error'); return }

    const rec = new SR()
    rec.continuous      = true
    rec.interimResults  = true
    rec.lang            = LANGS[sourceLang].browserLang

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

  const SL = LANGS[sourceLang]
  const TL = LANGS[targetLang]
  const hasEleven = elevenKey.length > 10

  return (
    <>
      <Head>
        <title>Traduttore Simultaneo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.page}>
        <div className={styles.container}>

          {/* Header */}
          <div className={styles.header}>
            <h1>🎙 Traduttore Simultaneo</h1>
            <p>Parla nella tua lingua · Claude traduce · Voce naturale in output</p>
          </div>

          {/* API Keys */}
          <div className={styles.card}>
            <div className={styles.label}>Chiavi API</div>
            <div className={styles.apiRow}>
              <div className={styles.apiGroup}>
                <span className={styles.label}>Anthropic (traduzione) *</span>
                <input className={styles.apiInput} type="password" placeholder="sk-ant-api03-..."
                  value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} />
              </div>
              <div className={styles.apiGroup}>
                <span className={styles.label}>ElevenLabs — voce naturale</span>
                <input className={styles.apiInput} type="password" placeholder="opzionale — fallback voce browser"
                  value={elevenKey} onChange={e => setElevenKey(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Source language */}
          <div className={styles.card}>
            <div className={styles.label}>Lingua di ingresso (chi parla)</div>
            <div className={styles.langRow}>
              {SOURCE_LANGS.map(code => (
                <button key={code}
                  className={`${styles.langBtn} ${sourceLang === code ? styles.active : ''}`}
                  onClick={() => handleSourceChange(code)}>
                  {LANGS[code].flag} {LANGS[code].name}
                </button>
              ))}
            </div>
          </div>

          {/* Target language */}
          <div className={styles.card}>
            <div className={styles.label}>Lingua di uscita (chi ascolta)</div>
            <div className={styles.langRow}>
              {TARGET_LANGS.filter(c => c !== sourceLang).map(code => (
                <button key={code}
                  className={`${styles.langBtn} ${targetLang === code ? styles.active : ''}`}
                  onClick={() => handleTargetChange(code)}>
                  {LANGS[code].flag} {LANGS[code].name}
                </button>
              ))}
            </div>
          </div>

          {/* Voice settings */}
          <div className={styles.card}>
            <div className={styles.label}>Impostazioni voce</div>
            {hasEleven ? (
              <>
                <div className={styles.voiceRow}>
                  <label>Voce ElevenLabs</label>
                  <select className={styles.voiceSelect} value={voiceId} onChange={e => setVoiceId(e.target.value)}>
                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </div>
                <div className={styles.speedRow}>
                  <label>Stabilità</label>
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
            <button
              className={`${styles.btn} ${styles.btnPrimary} ${isRecording ? styles.rec : ''}`}
              onClick={toggleRecording}>
              {isRecording ? '⏹ Ferma registrazione' : `🎙 Inizia — parla in ${SL.name}`}
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
              <div className={styles.label}>{SL.flag} {SL.name} — trascrizione</div>
              <div className={`${styles.panelBody} ${!sourceText ? styles.placeholder : ''}`}>
                {sourceText || SL.placeholder}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.label}>{TL.flag} {TL.name} — traduzione</div>
              <div className={`${styles.panelBody} ${!translatedText ? styles.placeholder : ''}`}>
                {translatedText || TL.placeholder}
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
                    <div className={styles.hSrc}>
                      {LANGS[h.srcLang]?.flag} {h.src}
                      <span className={styles.hReplay} onClick={() => speak(h.tgt)}>▶ riproduci</span>
                    </div>
                    <div className={styles.hTgt}>{LANGS[h.tgtLang]?.flag} {h.tgt}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.tip}>
            Richiede <strong>Chrome o Edge</strong> · Consenti accesso al microfono
            <br />
            ElevenLabs gratuito fino a 10.000 caratteri/mese →{' '}
            <a href="https://elevenlabs.io" target="_blank" rel="noreferrer">elevenlabs.io</a>
          </div>

        </div>
      </div>
    </>
  )
}
