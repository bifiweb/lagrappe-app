'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useSessionRealtime } from '@/hooks/useRealtime'
import { useWineMode } from '@/store/wineMode'
import type { Session, SessionPlayer } from '@/types'
import { PlayerAvatar } from '@/components/PlayerAvatar'

export default function WaitingPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<SessionPlayer[]>([])
  const [isChef, setIsChef] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flash, setFlash] = useState(false)
  const isRevealingRef = useRef(false)
  const { wineMode } = useWineMode()
  const revealChannelRef = useRef<ReturnType<typeof createClient>['channel'] extends (name: string, ...args: any[]) => infer R ? R : never | null>(null as any)
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

      const { data: pl } = await supabase
        .from('session_players').select('*').eq('session_id', sessionId)
      setPlayers(pl ?? [])

      const myPlayer = pl?.find(p => p.user_id === user.id)
      setIsChef(myPlayer?.is_chef ?? false)
    }
    load()
  }, [])

  // Canal broadcast pour le signal de révélation (instantané, sans passer par postgres_changes)
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase.channel(`reveal:${sessionId}`)
    channel.on('broadcast', { event: 'countdown' }, () => {
      beginCountdown(false)
    })
    channel.subscribe()
    revealChannelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  useSessionRealtime(sessionId, {
    onPlayerUpdate: (p) => setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, ...p } : x)),
    // Fallback : si un joueur recharge la page après que le reveal soit lancé
    onReveal: () => { if (!isRevealingRef.current) router.push(`/app/session/${sessionId}/reveal`) },
  })

  const doneCount = players.filter(p => p.tasting_done).length
  const allDone = doneCount === players.length && players.length > 0

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
        if (wineMode) {
          // Flash dramatique avant la redirection
          setFlash(true)
          setTimeout(() => {
            if (chefWrites) supabase.from('sessions').update({ status: 'revealed' }).eq('id', sessionId)
            router.push(`/app/session/${sessionId}/reveal`)
          }, 800)
        } else {
          if (chefWrites) supabase.from('sessions').update({ status: 'revealed' }).eq('id', sessionId)
          router.push(`/app/session/${sessionId}/reveal`)
        }
      }
    }, 1000)
  }

  async function startReveal() {
    if (isRevealingRef.current) return
    // Envoyer le signal à tous les autres via broadcast
    await revealChannelRef.current?.send({
      type: 'broadcast',
      event: 'countdown',
      payload: {},
    })
    // Le chef démarre son propre décompte et sera responsable d'écrire en DB
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

        {/* Flash dramatique Wine Mode */}
        {flash && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'linear-gradient(135deg, #FF006E, #8338EC, #FFBE0B)',
            animation: 'disco-bg 0.4s ease',
            pointerEvents: 'none',
          }} />
        )}

        {/* Décompte — affiché sur tous les appareils simultanément */}
        {countdown !== null && !flash && (
          wineMode ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', position: 'relative' }}>
              <div style={{ fontSize: '14px', color: '#FFBE0B', marginBottom: '1rem', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                🎊 Le vin mystère se révèle...
              </div>
              <div style={{
                fontSize: '160px', fontWeight: '900', lineHeight: 1,
                transition: 'all .15s',
                background: countdown <= 0
                  ? 'linear-gradient(135deg, #FF006E, #FFBE0B)'
                  : countdown === 1
                  ? 'linear-gradient(135deg, #FF006E, #8338EC)'
                  : countdown === 2
                  ? 'linear-gradient(135deg, #FFBE0B, #FF006E)'
                  : 'linear-gradient(135deg, #06D6A0, #8338EC)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: `drop-shadow(0 0 30px ${countdown <= 1 ? '#FF006E' : '#8338EC'})`,
                animation: 'timer-pulse 0.5s ease infinite',
              }}>
                {countdown <= 0 ? '🍾' : countdown}
              </div>
              {/* Confettis mini autour du chiffre */}
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  top: `${20 + Math.random() * 60}%`,
                  left: `${10 + i * 11}%`,
                  fontSize: `${16 + Math.random() * 16}px`,
                  animation: `float-particle ${1.5 + Math.random()}s ease infinite`,
                  pointerEvents: 'none',
                }}>
                  {['🎊', '✨', '🍷', '💫', '🎉', '⭐', '🍾', '🎶'][i]}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <div style={{ fontSize: '14px', color: '#888', marginBottom: '1.5rem' }}>
                Le vin mystère se révèle...
              </div>
              <div style={{
                fontSize: '120px', fontWeight: '700',
                color: countdown <= 0 ? '#8d323b' : '#1a1a1a',
                lineHeight: 1, transition: 'all .2s',
              }}>
                {countdown <= 0 ? '🍾' : countdown}
              </div>
            </div>
          )
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
                  <PlayerAvatar avatar={p.avatar} pseudo={p.pseudo} size={32} />
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
              <>
                {allDone && (
                  <div style={{ background: '#fdf8f5', border: '0.5px solid #e8d8c8', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', textAlign: 'center', fontSize: '12px', color: '#7a5020', lineHeight: 1.5 }}>
                    👑 Tu es le chef — c'est toi qui lances la révélation !
                  </div>
                )}
                <button
                  onClick={startReveal}
                  disabled={!allDone}
                  style={{
                    width: '100%', padding: '14px',
                    background: allDone ? '#8d323b' : '#c0a0a0',
                    color: '#fff', border: 'none',
                    borderRadius: '12px', fontSize: '15px', fontWeight: '500',
                    cursor: allDone ? 'pointer' : 'default',
                  }}>
                  {allDone ? 'Révéler le vin mystère ! 🍾' : `En attente... (${doneCount}/${players.length})`}
                </button>
              </>
            )}

            {!isChef && allDone && (
              <div style={{ background: '#fdf8f5', border: '0.5px solid #e8d8c8', borderRadius: '12px', padding: '1rem 1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>👑</div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>
                  En attente du chef...
                </div>
                <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.5 }}>
                  Tout le monde a terminé ! C'est au chef de lancer<br />la révélation du vin mystère. 🍾
                </div>
              </div>
            )}

            {!isChef && !allDone && (
              <div style={{ textAlign: 'center', fontSize: '13px', color: '#888', padding: '1rem' }}>
                Ta dégustation est soumise — en attente des autres joueurs...
              </div>
            )}

            {/* Wine Mode promo banner */}
            {!wineMode && (
              <div style={{
                marginTop: '1.5rem', padding: '1rem 1.25rem',
                background: 'linear-gradient(135deg, #1a003a, #2d0050)',
                borderRadius: '16px', textAlign: 'center',
                border: '1px solid rgba(255,190,11,0.25)',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>🍾✨</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#FFBE0B', marginBottom: '4px' }}>
                  En attendant... Wine Mode !
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>
                  Lance un jeu de bouchons multijoueur en temps réel avec les autres joueurs !
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,190,11,0.7)' }}>
                  Clique sur le bouton 🍷 à droite de l'écran pour activer le Wine Mode
                </div>
              </div>
            )}

            {wineMode && (
              <div style={{
                marginTop: '1.5rem', padding: '1rem 1.25rem',
                background: 'linear-gradient(135deg, #1a003a, #2d0050)',
                borderRadius: '16px', textAlign: 'center',
                border: '1px solid rgba(255,190,11,0.5)',
                animation: 'wine-pulse 2s ease infinite',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>🍾</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#FFBE0B', marginBottom: '4px' }}>
                  Wine Mode activé !
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                  Clique sur 🍾 à droite pour lancer le jeu de bouchons !
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
