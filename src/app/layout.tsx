import type { Metadata } from 'next'
import { WineModeProvider } from '@/store/wineMode'
import WineMode from '@/components/WineMode'
import './wine-mode.css'

export const metadata: Metadata = {
  title: 'La grAPP — Dégustation de vins suisses à l\'aveugle',
  description: 'Déguste et découvre les vins suisses à l\'aveugle',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <WineModeProvider>
          {children}
          <WineMode />
        </WineModeProvider>
      </body>
    </html>
  )
}
