# Traduttore Simultaneo 🎙
> Italiano → Turco / Inglese — voce naturale via ElevenLabs + Claude

## Stack
- **Next.js 14** (Pages Router)
- **Claude Sonnet** — traduzione simultanea
- **ElevenLabs** — sintesi vocale naturale (opzionale, fallback browser)
- **Web Speech API** — riconoscimento vocale (Chrome/Edge)

## Deploy su Vercel (3 minuti)

1. Carica questa cartella su GitHub (nuovo repo)
2. Vai su [vercel.com](https://vercel.com) → New Project → importa il repo
3. Nelle **Environment Variables** aggiungi:
   - `ANTHROPIC_API_KEY` = la tua chiave Anthropic
   - `ELEVENLABS_API_KEY` = la tua chiave ElevenLabs (opzionale)
4. Deploy — fatto!

> Le API key inserite su Vercel rimangono server-side e non vengono mai esposte al browser.
> I campi API nell'interfaccia servono solo per uso locale/dev senza .env.

## Sviluppo locale

```bash
npm install
cp .env.example .env.local
# aggiungi le chiavi in .env.local
npm run dev
# apri http://localhost:3000
```

## Struttura

```
pages/
  index.js          # UI principale
  api/
    translate.js    # Proxy → Anthropic API
    speak.js        # Proxy → ElevenLabs API
styles/
  Home.module.css   # Stili componente
  globals.css       # Reset globale
```

## Voci ElevenLabs consigliate

| ID | Nome | Note |
|----|------|-------|
| EXAVITQu4vr4xnSDxMaL | Sarah | Naturale, multilingue |
| onwK4e9ZLuTAKqWW03F9 | Daniel | Britannico, chiaro |
| TX3LPaxmHKxFdv7VOQHJ | Liam | Maschile, caldo |

## Note
- Il riconoscimento vocale funziona **solo su Chrome o Edge**
- ElevenLabs piano gratuito: 10.000 caratteri/mese (~45 min di corso)
- Ritardo traduzione: ~1-3 secondi
