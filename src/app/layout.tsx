import type { Metadata } from 'next'
import { WineModeProvider } from '@/store/wineMode'
import WineMode from '@/components/WineMode'
import { LangProvider } from '@/lib/i18n'
import { getServerLang } from '@/lib/i18n/server'
import './wine-mode.css'

export function generateMetadata(): Metadata {
  return getServerLang() === 'de'
    ? { title: 'La grAPP — Blinddegustation von Schweizer Weinen', description: 'Degustiere und entdecke Schweizer Weine blind' }
    : { title: 'La grAPP — Dégustation de vins suisses à l\'aveugle', description: 'Déguste et découvre les vins suisses à l\'aveugle' }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getServerLang()
  return (
    <html lang={lang}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <LangProvider initial={lang}>
          <WineModeProvider>
            {children}
            <WineMode />
          </WineModeProvider>
        </LangProvider>
      </body>
    </html>
  )
}
