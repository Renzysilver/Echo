/**
 * Text Normalization Module
 * Echo — Script Processing Pipeline
 *
 * Handles the transformation of raw input text into a phonetic/prosodic
 * representation suitable for the speech synthesis engine.
 *
 * Pipeline stages:
 *   1. Whitespace cleanup
 *   2. Number expansion (cardinal + ordinal)
 *   3. Date expansion
 *   4. Time expansion
 *   5. Currency expansion
 *   6. Abbreviation expansion
 *   7. Punctuation parsing (mark phrase boundaries)
 *   8. Pause insertion (commas → short pause, periods → long pause)
 *   9. Emotion tag handling (optional)
 */

export interface NormalizedToken {
  text: string
  type: 'word' | 'number' | 'date' | 'time' | 'currency' | 'punctuation' | 'pause' | 'emotion' | 'whitespace'
  pauseMs?: number
  emotion?: string
  raw?: string
}

export interface NormalizedScript {
  tokens: NormalizedToken[]
  plainText: string
  pauseMap: { index: number; ms: number }[]
  estimatedDurationSec: number
  wordCount: number
}

const ABBREVIATIONS: Record<string, string> = {
  'mr.': 'mister',
  'mrs.': 'missus',
  'ms.': 'miss',
  'dr.': 'doctor',
  'prof.': 'professor',
  'sr.': 'senior',
  'jr.': 'junior',
  'st.': 'saint',
  'mt.': 'mount',
  'ave.': 'avenue',
  'blvd.': 'boulevard',
  'rd.': 'road',
  'etc.': 'etcetera',
  'vs.': 'versus',
  'e.g.': 'for example',
  'i.e.': 'that is',
  'inc.': 'incorporated',
  'corp.': 'corporation',
  'ltd.': 'limited',
  'co.': 'company',
  'fig.': 'figure',
  'no.': 'number',
  'vol.': 'volume',
  'pp.': 'pages',
  'ch.': 'chapter',
}

const EMOTION_TAGS = /\[(neutral|happy|sad|angry|excited|calm|serious|whisper|shout)\]/gi

const ORDINAL_WORDS: Record<string, string> = {
  '1st': 'first',
  '2nd': 'second',
  '3rd': 'third',
  '4th': 'fourth',
  '5th': 'fifth',
  '6th': 'sixth',
  '7th': 'seventh',
  '8th': 'eighth',
  '9th': 'ninth',
  '10th': 'tenth',
}

/**
 * Expand a numeric string into its spoken-word form.
 * Supports integers up to 999,999,999 and basic decimals.
 */
export function expandNumber(num: number): string {
  if (num === 0) return 'zero'
  if (num < 0) return 'negative ' + expandNumber(-num)

  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

  function under1000(n: number): string {
    if (n === 0) return ''
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '')
    return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + under1000(n % 100) : '')
  }

  const parts: string[] = []
  const millions = Math.floor(num / 1_000_000)
  const thousands = Math.floor((num % 1_000_000) / 1000)
  const rest = num % 1000

  if (millions > 0) parts.push(under1000(millions) + ' million')
  if (thousands > 0) parts.push(under1000(thousands) + ' thousand')
  if (rest > 0) parts.push(under1000(rest))

  return parts.filter(Boolean).join(' ').trim()
}

/**
 * Expand a date string such as "2024-01-15" or "01/15/2024" into spoken form.
 */
export function expandDate(input: string): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  // ISO format: YYYY-MM-DD
  const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const [, y, m, d] = iso
    const month = months[parseInt(m, 10) - 1] || ''
    return `${month} ${expandNumber(parseInt(d, 10))}, ${expandNumber(parseInt(y, 10))}`
  }

  // US format: MM/DD/YYYY
  const us = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) {
    const [, m, d, y] = us
    const month = months[parseInt(m, 10) - 1] || ''
    return `${month} ${expandNumber(parseInt(d, 10))}, ${expandNumber(parseInt(y, 10))}`
  }

  return input
}

/**
 * Expand a time string such as "14:30" or "9:15am" into spoken form.
 */
export function expandTime(input: string): string {
  const match = input.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!match) return input

  const [, h, m, s, meridian] = match
  let hour = parseInt(h, 10)
  const minute = parseInt(m, 10)
  const second = s ? parseInt(s, 10) : 0

  const period = meridian ? meridian.toLowerCase() : (hour >= 12 ? 'pm' : 'am')
  if (!meridian) {
    hour = hour % 12 || 12
  }

  let result = `${expandNumber(hour)} ${minute === 0 ? "o'clock" : expandNumber(minute)}`
  if (second > 0) result += ` and ${expandNumber(second)} seconds`
  result += ` ${period}`
  return result
}

/**
 * Expand a currency string such as "$1,234.56" into spoken form.
 */
export function expandCurrency(input: string): string {
  const match = input.match(/^([€$£¥])\s*([\d,]+(?:\.\d+)?)$/)
  if (!match) return input

  const [, symbol, amount] = match
  const cleaned = amount.replace(/,/g, '')
  const [whole, frac] = cleaned.split('.')
  const currencyName: Record<string, string> = {
    '$': 'dollar',
    '€': 'euro',
    '£': 'pound',
    '¥': 'yen',
  }
  const cur = currencyName[symbol] || 'unit'
  const wholePart = expandNumber(parseInt(whole, 10))
  if (frac) {
    const cents = parseInt(frac.padEnd(2, '0').slice(0, 2), 10)
    return `${wholePart} ${cur}${parseInt(whole, 10) === 1 ? '' : 's'} and ${expandNumber(cents)} cent${cents === 1 ? '' : 's'}`
  }
  return `${wholePart} ${cur}${parseInt(whole, 10) === 1 ? '' : 's'}`
}

/**
 * Main normalization entry point.
 * Converts raw input text into a structured token stream with pause markers.
 */
export function normalizeScript(input: string): NormalizedScript {
  if (!input || !input.trim()) {
    return { tokens: [], plainText: '', pauseMap: [], estimatedDurationSec: 0, wordCount: 0 }
  }

  // Preserve emotion tags before any processing
  const emotionMatches = [...input.matchAll(EMOTION_TAGS)]
  let working = input.replace(EMOTION_TAGS, '<<EMOTION:$1>>')

  // Tokenize by whitespace and word boundaries
  const rawTokens = working.split(/(\s+)/)
  const tokens: NormalizedToken[] = []
  const pauseMap: { index: number; ms: number }[] = []
  let wordCount = 0

  for (const raw of rawTokens) {
    if (!raw) continue
    if (/^\s+$/.test(raw)) {
      tokens.push({ text: ' ', type: 'whitespace' })
      continue
    }

    // Emotion tag
    const emo = raw.match(/^<<EMOTION:(.+?)>>$/i)
    if (emo) {
      tokens.push({ text: '', type: 'emotion', emotion: emo[1].toLowerCase(), raw })
      continue
    }

    // Strip and remember trailing punctuation so we can match patterns
    // against the inner token, then re-append the punctuation as a pause.
    const trailingPunctMatch = raw.match(/[.,!?;:]+$/)
    const trailingPunct = trailingPunctMatch ? trailingPunctMatch[0] : ''
    const inner = trailingPunct ? raw.slice(0, raw.length - trailingPunct.length) : raw

    // Currency
    if (/^[€$£¥]\s*[\d,]+(?:\.\d+)?$/.test(inner)) {
      const expanded = expandCurrency(inner)
      tokens.push({ text: expanded, type: 'currency', raw })
      wordCount += expanded.split(/\s+/).length
      if (trailingPunct) {
        const pauseMs = /[.!?]/.test(trailingPunct) ? 500 : 250
        tokens.push({ text: trailingPunct, type: 'pause', pauseMs })
        pauseMap.push({ index: tokens.length - 1, ms: pauseMs })
      }
      continue
    }

    // Date ISO
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(inner)) {
      const expanded = expandDate(inner)
      tokens.push({ text: expanded, type: 'date', raw })
      wordCount += expanded.split(/\s+/).length
      if (trailingPunct) {
        const pauseMs = /[.!?]/.test(trailingPunct) ? 500 : 250
        tokens.push({ text: trailingPunct, type: 'pause', pauseMs })
        pauseMap.push({ index: tokens.length - 1, ms: pauseMs })
      }
      continue
    }

    // Date US
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(inner)) {
      const expanded = expandDate(inner)
      tokens.push({ text: expanded, type: 'date', raw })
      wordCount += expanded.split(/\s+/).length
      if (trailingPunct) {
        const pauseMs = /[.!?]/.test(trailingPunct) ? 500 : 250
        tokens.push({ text: trailingPunct, type: 'pause', pauseMs })
        pauseMap.push({ index: tokens.length - 1, ms: pauseMs })
      }
      continue
    }

    // Time
    if (/^\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?$/i.test(inner)) {
      const expanded = expandTime(inner)
      tokens.push({ text: expanded, type: 'time', raw })
      wordCount += expanded.split(/\s+/).length
      if (trailingPunct) {
        const pauseMs = /[.!?]/.test(trailingPunct) ? 500 : 250
        tokens.push({ text: trailingPunct, type: 'pause', pauseMs })
        pauseMap.push({ index: tokens.length - 1, ms: pauseMs })
      }
      continue
    }

    // Ordinal (1st, 2nd, 3rd, 4th...)
    const ordinal = inner.toLowerCase().match(/^(\d+)(st|nd|rd|th)$/)
    if (ordinal) {
      const word = ORDINAL_WORDS[inner.toLowerCase()] || expandNumber(parseInt(ordinal[1], 10)) + 'th'
      tokens.push({ text: word, type: 'number', raw })
      wordCount += word.split(/\s+/).length
      if (trailingPunct) {
        const pauseMs = /[.!?]/.test(trailingPunct) ? 500 : 250
        tokens.push({ text: trailingPunct, type: 'pause', pauseMs })
        pauseMap.push({ index: tokens.length - 1, ms: pauseMs })
      }
      continue
    }

    // Pure number
    if (/^[\d,]+(?:\.\d+)?$/.test(inner)) {
      const cleaned = inner.replace(/,/g, '')
      const expanded = expandNumber(parseFloat(cleaned))
      tokens.push({ text: expanded, type: 'number', raw })
      wordCount += expanded.split(/\s+/).length
      if (trailingPunct) {
        const pauseMs = /[.!?]/.test(trailingPunct) ? 500 : 250
        tokens.push({ text: trailingPunct, type: 'pause', pauseMs })
        pauseMap.push({ index: tokens.length - 1, ms: pauseMs })
      }
      continue
    }

    // Abbreviation (with trailing period)
    const abbr = raw.toLowerCase()
    if (ABBREVIATIONS[abbr]) {
      tokens.push({ text: ABBREVIATIONS[abbr], type: 'word', raw })
      wordCount++
      continue
    }

    // Punctuation → pause marker
    if (/^[.!?]+$/.test(raw)) {
      const pauseMs = 500
      tokens.push({ text: raw, type: 'pause', pauseMs })
      pauseMap.push({ index: tokens.length - 1, ms: pauseMs })
      continue
    }
    if (/^[,;:]$/.test(raw)) {
      const pauseMs = 250
      tokens.push({ text: raw, type: 'pause', pauseMs })
      pauseMap.push({ index: tokens.length - 1, ms: pauseMs })
      continue
    }
    if (/^[—–-]$/.test(raw)) {
      const pauseMs = 350
      tokens.push({ text: raw, type: 'pause', pauseMs })
      pauseMap.push({ index: tokens.length - 1, ms: pauseMs })
      continue
    }

    // Strip trailing punctuation for word classification
    const stripped = raw.replace(/[.,!?;:]+$/g, '')
    if (stripped) {
      tokens.push({ text: raw, type: 'word' })
      wordCount++
    }
  }

  // Estimated duration: average speaking rate of 2.5 words/sec + pauses
  const estimatedDurationSec = wordCount / 2.5 + pauseMap.reduce((sum, p) => sum + p.ms, 0) / 1000

  return {
    tokens,
    plainText: tokens.map(t => t.text).join('').replace(/\s+/g, ' ').trim(),
    pauseMap,
    estimatedDurationSec,
    wordCount,
  }
}

/**
 * Generate a downloadable SSML-like representation.
 * Useful for inspecting how the synthesizer will read the script.
 */
export function toSSML(script: NormalizedScript): string {
  const parts = ['<speak>']
  for (const token of script.tokens) {
    if (token.type === 'pause') {
      parts.push(`<break time="${token.pauseMs}ms"/>`)
    } else if (token.type === 'emotion') {
      parts.push(`<prosody emotion="${token.emotion}">`)
    } else if (token.type === 'whitespace') {
      parts.push(' ')
    } else {
      parts.push(token.text)
    }
  }
  parts.push('</speak>')
  return parts.join('')
}
