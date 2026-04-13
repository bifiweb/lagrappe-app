'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'

interface WineModeContextType {
  wineMode: boolean
  toggleWineMode: () => void
}

const WineModeContext = createContext<WineModeContextType>({
  wineMode: false,
  toggleWineMode: () => {},
})

export function WineModeProvider({ children }: { children: ReactNode }) {
  const [wineMode, setWineMode] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Init audio une seule fois côté client
  useEffect(() => {
    const audio = new Audio('/music/disco.mp3')
    audio.loop = true
    audio.volume = 0.45
    audioRef.current = audio

    // Si Wine Mode était déjà actif (rechargement de page), relancer l'audio
    // Note : ça ne fonctionnera pas sans geste utilisateur — l'utilisateur devra cliquer le toggle
    return () => { audio.pause() }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('wineMode') === 'true'
    setWineMode(saved)
  }, [])

  useEffect(() => {
    if (wineMode) {
      document.documentElement.setAttribute('data-wine', 'true')
    } else {
      document.documentElement.removeAttribute('data-wine')
    }
  }, [wineMode])

  function toggleWineMode() {
    setWineMode(prev => {
      const next = !prev
      localStorage.setItem('wineMode', String(next))

      // Jouer/mettre en pause directement ici — dans un handler de clic (geste utilisateur)
      if (next) {
        audioRef.current?.play().catch(err => console.warn('Audio play blocked:', err))
      } else {
        audioRef.current?.pause()
        if (audioRef.current) audioRef.current.currentTime = 0
      }

      return next
    })
  }

  return (
    <WineModeContext.Provider value={{ wineMode, toggleWineMode }}>
      {children}
    </WineModeContext.Provider>
  )
}

export const useWineMode = () => useContext(WineModeContext)
