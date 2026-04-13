'use client'

import { useEffect, useState, useRef } from 'react'
import { useWineMode } from '@/store/wineMode'

const PARTICLES = ['🍷', '🍾', '🫧', '✨', '🎊', '🎉', '⭐', '💫', '🌟', '🫁']
const PARTICLE_COUNT = 22

interface Particle {
  id: number
  emoji: string
  left: number
  size: number
  duration: number
  delay: number
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    emoji: PARTICLES[Math.floor(Math.random() * PARTICLES.length)],
    left: Math.random() * 100,
    size: 18 + Math.random() * 28,
    duration: 5 + Math.random() * 8,
    delay: Math.random() * 6,
  }))
}

export default function WineMode() {
  const { wineMode, toggleWineMode } = useWineMode()
  const [particles, setParticles] = useState<Particle[]>([])
  const [mounted, setMounted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    setMounted(true)
    setParticles(generateParticles())
  }, [])

  // Regenerer les particules toutes les 12s pour variété
  useEffect(() => {
    if (!wineMode) return
    const interval = setInterval(() => setParticles(generateParticles()), 12000)
    return () => clearInterval(interval)
  }, [wineMode])

  // Gestion audio
  useEffect(() => {
    if (!mounted) return
    if (wineMode) {
      audioRef.current?.play().catch(() => {})
    } else {
      audioRef.current?.pause()
      if (audioRef.current) audioRef.current.currentTime = 0
    }
  }, [wineMode, mounted])

  // Injection police Pacifico
  useEffect(() => {
    const linkId = 'pacifico-font'
    if (wineMode) {
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link')
        link.id = linkId
        link.rel = 'stylesheet'
        link.href = 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap'
        document.head.appendChild(link)
      }
      document.documentElement.style.setProperty('--wine-font', "'Pacifico', cursive")
    } else {
      document.documentElement.style.removeProperty('--wine-font')
    }
  }, [wineMode])

  if (!mounted) return null

  return (
    <>
      {/* Audio disco */}
      <audio ref={audioRef} loop style={{ display: 'none' }}>
        <source src="/music/disco.mp3" type="audio/mpeg" />
      </audio>

      {/* ── Fond disco animé (derrière tout) ── */}
      {wineMode && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'linear-gradient(135deg, #0d0020, #2d0050, #1a0040, #0d0030)',
          backgroundSize: '400% 400%',
          animation: 'disco-bg 6s ease infinite',
          overflow: 'hidden',
        }}>
          {/* Taches lumineuses disco */}
          <div style={{
            position: 'absolute', top: '20%', left: '30%',
            width: '300px', height: '300px', borderRadius: '50%',
            background: 'radial-gradient(circle, #FF006E33 0%, transparent 70%)',
            animation: 'overlay-spin 12s linear infinite',
          }} />
          <div style={{
            position: 'absolute', top: '60%', left: '60%',
            width: '400px', height: '400px', borderRadius: '50%',
            background: 'radial-gradient(circle, #8338EC44 0%, transparent 70%)',
            animation: 'overlay-spin 8s linear infinite reverse',
          }} />
          <div style={{
            position: 'absolute', top: '40%', left: '10%',
            width: '250px', height: '250px', borderRadius: '50%',
            background: 'radial-gradient(circle, #FFBE0B22 0%, transparent 70%)',
            animation: 'overlay-spin 15s linear infinite',
          }} />
        </div>
      )}

      {/* ── Overlay teinté sur le contenu (mix-blend-mode) ── */}
      {wineMode && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'linear-gradient(45deg, #FF006E18, #8338EC18, #FFBE0B14, #06D6A018)',
          backgroundSize: '300% 300%',
          animation: 'disco-bg 4s ease infinite',
          mixBlendMode: 'overlay',
        }} />
      )}

      {/* ── Particules flottantes ── */}
      {wineMode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9990, pointerEvents: 'none', overflow: 'hidden' }}>
          {particles.map(p => (
            <div key={p.id} style={{
              position: 'absolute',
              bottom: '-60px',
              left: `${p.left}%`,
              fontSize: `${p.size}px`,
              animation: `float-particle ${p.duration}s ease-in ${p.delay}s infinite`,
              userSelect: 'none',
            }}>
              {p.emoji}
            </div>
          ))}
        </div>
      )}

      {/* ── Toggle Wine Mode (fixe côté droit) ── */}
      <div style={{
        position: 'fixed',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}>
        {/* Label vertical */}
        <div style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          fontSize: '10px',
          fontWeight: '600',
          color: wineMode ? '#FFBE0B' : '#888',
          letterSpacing: '0.05em',
          fontFamily: 'system-ui, sans-serif',
          animation: wineMode ? 'label-pulse 2s ease infinite' : 'none',
          marginBottom: '4px',
          textTransform: 'uppercase',
        }}>
          {wineMode ? '🎊 Wine Mode ON' : 'Activer le Wine Mode ?'}
        </div>

        {/* Bouton toggle */}
        <button
          onClick={toggleWineMode}
          title={wineMode ? 'Désactiver le Wine Mode' : 'Activer le Wine Mode'}
          style={{
            width: '44px',
            height: '80px',
            borderRadius: '22px 0 0 22px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            transition: 'all 0.4s ease',
            ...(wineMode ? {
              background: 'linear-gradient(135deg, #FF006E, #8338EC, #FFBE0B)',
              backgroundSize: '200% 200%',
              animation: 'wine-pulse 2s ease infinite, shimmer 3s linear infinite',
              boxShadow: '0 0 20px #FF006E88',
            } : {
              background: '#fff',
              boxShadow: '-2px 0 12px rgba(0,0,0,0.1)',
            }),
          }}
        >
          <span style={{ fontSize: '20px', lineHeight: 1 }}>
            {wineMode ? '🎊' : '🍷'}
          </span>
          <span style={{
            fontSize: '8px',
            fontWeight: '700',
            color: wineMode ? '#fff' : '#888',
            letterSpacing: '0.05em',
            fontFamily: 'system-ui',
          }}>
            {wineMode ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>
    </>
  )
}
