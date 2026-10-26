'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { LANG_COOKIE, translate, type Lang } from './core'

export type { Lang } from './core'

interface LangContext {
  lang: Lang
  setLang: (lang: Lang) => void
}

const Ctx = createContext<LangContext>({ lang: 'fr', setLang: () => {} })

// Langue initiale lue côté serveur (cookie ou Accept-Language) pour éviter un flash au chargement
export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`
  }, [])

  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>
}

export function useLang() {
  return useContext(Ctx)
}

// t('Texte français', { var }) → texte dans la langue courante (le français sert de clé)
export function useT() {
  const { lang } = useContext(Ctx)
  return useCallback(
    (fr: string, vars?: Record<string, string | number>) => translate(lang, fr, vars),
    [lang],
  )
}

// Sélecteur FR / DE
export function LangSwitch({ style }: { style?: React.CSSProperties }) {
  const { lang, setLang } = useLang()
  return (
    <div style={{ display: 'inline-flex', border: '0.5px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', background: '#fff', ...style }}>
      {(['fr', 'de'] as const).map(l => (
        <button key={l} onClick={() => setLang(l)}
          style={{ padding: '4px 9px', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            background: lang === l ? '#8d323b' : 'transparent', color: lang === l ? '#fff' : '#888' }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
