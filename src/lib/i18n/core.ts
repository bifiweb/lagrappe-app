import { DE } from './de'

export type Lang = 'fr' | 'de'
export const LANG_COOKIE = 'lang'

export function translate(lang: Lang, fr: string, vars?: Record<string, string | number>) {
  let s = lang === 'de' ? (DE[fr] ?? fr) : fr
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]))
  return s
}

// Langue par défaut : cookie choisi, sinon langue du navigateur
export function detectLang(cookie: string | undefined, acceptLanguage: string | null): Lang {
  if (cookie === 'fr' || cookie === 'de') return cookie
  const first = (acceptLanguage ?? '').split(',')[0].trim().toLowerCase()
  return first.startsWith('de') || first.startsWith('gsw') ? 'de' : 'fr'
}
