'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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
