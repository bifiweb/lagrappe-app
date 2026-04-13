'use client'

import { useEffect, useState, useRef } from 'react'
import { useWineMode } from '@/store/wineMode'

const PARTICLES = ['🍷', '🍾', '🫧', '✨', '🎊', '🎉', '⭐', '💫', '🌟', '🍇']
const PARTICLE_COUNT = 22

interface Particle {
  id: number; emoji: string; left: number; size: number; duration: number; delay: number
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

  useEffect(() => { setMounted(true); setParticles(generateParticles()) }, [])

  useEffect(() => {
    if (!wineMode) return
    const interval = setInterval(() => setParticles(generateParticles()), 12000)
    return () => clearInterval(interval)
  }, [wineMode])

  useEffect(() => {
    if (!mounted) return
    if (wineMode) { audioRef.current?.play().catch(() => {}) }
    else { audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0 }
  }, [wineMode, mounted])

  useEffect(() => {
    const linkId = 'pacifico-font'
    if (wineMode) {
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link')
        link.id = linkId; link.rel = 'stylesheet'
        link.href = 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap'
        document.head.appendChild(link)
      }
    }
  }, [wineMode])

  if (!mounted) return null

  return (
    <>
      <audio ref={audioRef} loop style={{ display: 'none' }}>
        <source src="/music/disco.mp3" type="audio/mpeg" />
      </audio>

      {/* Overlay festif — pointer-events: none pour ne pas bloquer l'app */}
      {wineMode && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9980, pointerEvents: 'none',
          background: 'linear-gradient(45deg, #FF006E12, #8338EC12, #FFBE0B0e, #06D6A012)',
          backgroundSize: '300% 300%',
          animation: 'disco-bg 4s ease infinite',
        }}>
          {/* Taches lumineuses disco */}
          <div style={{ position: 'absolute', top: '15%', left: '20%', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, #FF006E22 0%, transparent 70%)', animation: 'disco-bg 10s ease infinite' }} />
          <div style={{ position: 'absolute', top: '55%', left: '65%', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle, #8338EC2a 0%, transparent 70%)', animation: 'disco-bg 7s ease infinite reverse' }} />
          <div style={{ position: 'absolute', top: '35%', left: '5%', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle, #FFBE0B1a 0%, transparent 70%)', animation: 'disco-bg 13s ease infinite' }} />
        </div>
      )}

      {/* Particules */}
      {wineMode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9990, pointerEvents: 'none', overflow: 'hidden' }}>
          {particles.map(p => (
            <div key={p.id} style={{
              position: 'absolute', bottom: '-60px', left: `${p.left}%`,
              fontSize: `${p.size}px`,
              animation: `float-particle ${p.duration}s ease-in ${p.delay}s infinite`,
              userSelect: 'none',
            }}>{p.emoji}</div>
          ))}
        </div>
      )}

      {/* Toggle flottant */}
      <div style={{
        position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      }}>
        <div style={{
          writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)',
          fontSize: '10px', fontWeight: '600', letterSpacing: '0.05em',
          color: wineMode ? '#FFBE0B' : '#888', fontFamily: 'system-ui, sans-serif',
          animation: wineMode ? 'label-pulse 2s ease infinite' : 'none',
          marginBottom: '4px', textTransform: 'uppercase',
        }}>
          {wineMode ? '🎊 Wine Mode ON' : 'Activer le Wine Mode ?'}
        </div>

        <button onClick={toggleWineMode} title={wineMode ? 'Désactiver le Wine Mode' : 'Activer le Wine Mode'}
          style={{
            width: '44px', height: '80px', borderRadius: '22px 0 0 22px',
            border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
            transition: 'all 0.4s ease',
            ...(wineMode ? {
              background: 'linear-gradient(135deg, #FF006E, #8338EC, #FFBE0B)',
              animation: 'wine-pulse 2s ease infinite',
              boxShadow: '0 0 20px #FF006E88',
            } : {
              background: '#fff',
              boxShadow: '-2px 0 12px rgba(0,0,0,0.1)',
            }),
          }}>
          <span style={{ fontSize: '20px', lineHeight: 1 }}>{wineMode ? '🎊' : '🍷'}</span>
          <span style={{ fontSize: '8px', fontWeight: '700', color: wineMode ? '#fff' : '#888', letterSpacing: '0.05em', fontFamily: 'system-ui' }}>
            {wineMode ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>
    </>
  )
}
