'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useSessionRealtime } from '@/hooks/useRealtime'
import type { Session, SessionPlayer } from '@/types'

export default function WaitingPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<SessionPlayer[]>([])
  const [isChef, setIsChef] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const isRevealingRef = useRef(false)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const sessionId = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: sess } = await supabase
        .from('sessions').select('*').eq('id', sessionId).single()
      setSession(sess)

      // Si déjà en cours de révélation (rechargement de page), lancer le décompte
      if (sess?.status === 'revealing') {
        beginCountdown(false)
        return
      }

      const { data: pl } = await supabase
        .from('session_players').select('*').eq('session_id', sessionId)
      setPlayers(pl ?? [])

      const myPlayer = pl?.find(p => p.user_id === user.id)
      setIsChef(myPlayer?.is_chef ?? false)
    }
    load()
  }, [])

  function beginCountdown(chefWrites: boolean) {
    if (isRevealingRef.current) return
    isRevealingRef.current = true
    let n = 3
    setCountdown(3)
    const interval = setInterval(() => {
      n--
      setCountdown(n)
      if (n <= 0) {
        clearInterval(interval)
        if (chefWrites) {
          supabase.from('sessions').update({ status: 'revealed' }).eq('id', sessionId)
        }
        router.push(`/app/session/${sessionId}/reveal`)
      }
    }, 1000)
  }

  useSessionRealtime(sessionId, {
    onPlayerUpdate: (p) => setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, ...p } : x)),
    onRevealing: () => beginCountdown(false),
    onReveal: () => router.push(`/app/session/${sessionId}/reveal`),
  })

  const doneCount = players.filter(p => p.tasting_done).length
  const allDone = doneCount === players.length && players.length > 0

  async function startReveal() {
    if (isRevealingRef.current) return
    // Mettre le status à 'revealing' → tous les clients démarrent leur décompte
    await supabase.from('sessions').update({ status: 'revealing' }).eq('id', sessionId)
    // Le chef démarre aussi immédiatement (sans attendre l'écho postgres_changes)
    // et sera responsable de passer à 'revealed' en fin de décompte
    beginCountdown(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#8d323b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px' }}>🍷</span>
          </div>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>
            Bouteille #{session?.bottle_number}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Décompte révélation — affiché sur tous les appareils */}
        {countdown !== null && (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div style={{ fontSize: '14px', color: '#888', marginBottom: '1.5rem' }}>
              Le vin mystère se révèle...
            </div>
            <div style={{
              fontSize: '120px', fontWeight: '700', color: countdown <= 0 ? '#8d323b' : '#1a1a1a',
              lineHeight: 1, transition: 'all .3s',
            }}>
              {countdown <= 0 ? '🍾' : countdown}
            </div>
          </div>
        )}

        {/* Attente normale */}
        {countdown === null && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>
                {allDone ? 'Tout le monde a terminé !' : 'En attente des joueurs...'}
              </div>
              <div style={{ fontSize: '13px', color: '#888' }}>
                {doneCount} / {players.length} dégustations soumises
              </div>
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
              {players.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '0.5px solid #f0f0f0' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '500', color: '#8d323b' }}>
                    {p.pseudo[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>
                    {p.pseudo}
                    {p.is_chef && <span style={{ marginLeft: '6px', fontSize: '12px', color: '#888' }}>👑</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.tasting_done ? '#3B6D11' : '#e0c070' }}></div>
                    <span style={{ fontSize: '12px', color: p.tasting_done ? '#3B6D11' : '#888' }}>
                      {p.tasting_done ? 'Terminé' : 'En cours...'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {isChef && (
              <button
                onClick={startReveal}
                disabled={!allDone}
                style={{
                  width: '100%', padding: '14px',
                  background: allDone ? '#8d323b' : '#c0a0a0',
                  color: '#fff', border: 'none',
                  borderRadius: '12px', fontSize: '15px',
                  fontWeight: '500',
                  cursor: allDone ? 'pointer' : 'default',
                }}>
                {allDone ? 'Révéler le vin mystère ! 🍾' : `En attente... (${doneCount}/${players.length})`}
              </button>
            )}

            {!isChef && allDone && (
              <div style={{ textAlign: 'center', fontSize: '13px', color: '#888', padding: '1rem' }}>
                En attente que le chef révèle le vin...
              </div>
            )}

            {!isChef && !allDone && (
              <div style={{ textAlign: 'center', fontSize: '13px', color: '#888', padding: '1rem' }}>
                Ta dégustation est soumise — en attente des autres joueurs...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
