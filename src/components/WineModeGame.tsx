'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface GamePlayer {
  userId: string
  pseudo: string
  avatar: string
  score: number
}

interface CorkThrow {
  userId: string
  x: number
  hit: boolean
  id: number
}

const GLASS_HIT_RADIUS = 18
const AVATAR_OPTIONS = ['🍷','🍾','🧀','🍇','🫧','🦅','🐺','🦁','🐉','🌹','🌊','🔥','⚡','🎩','🌙','🍓','🍑','🥂','🧙','🤠']

let throwIdCounter = 0

export default function WineModeGame({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const [me, setMe] = useState<GamePlayer | null>(null)
  const [players, setPlayers] = useState<Map<string, GamePlayer>>(new Map())
  const [corks, setCorks] = useState<CorkThrow[]>([])
  const [throwing, setThrowing] = useState(false)
  const [lastResult, setLastResult] = useState<'hit' | 'miss' | null>(null)
  const [needsAvatar, setNeedsAvatar] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [pendingPseudo, setPendingPseudo] = useState<string>('Joueur')
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const meRef = useRef<GamePlayer | null>(null)
  const lastThrowRef = useRef<number>(0)

  meRef.current = me

  function setupChannel(userId: string, player: GamePlayer) {
    const channel = supabase.channel('wine-game:global', {
      config: { presence: { key: userId } },
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ pseudo: string; avatar: string; score: number }>()
      const newMap = new Map<string, GamePlayer>()
      Object.entries(state).forEach(([uid, presences]) => {
        const p = presences[0]
        newMap.set(uid, {
          userId: uid,
          pseudo: p.pseudo,
          avatar: p.avatar,
          score: uid === userId ? (meRef.current?.score ?? 0) : (p.score ?? 0),
        })
      })
      setPlayers(newMap)
    })

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const p = newPresences[0] as { pseudo: string; avatar: string; score: number }
      setPlayers(prev => {
        const next = new Map(prev)
        next.set(key, { userId: key, pseudo: p.pseudo, avatar: p.avatar, score: p.score ?? 0 })
        return next
      })
    })

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      setPlayers(prev => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
    })

    channel.on('broadcast', { event: 'cork' }, ({ payload }) => {
      const { userId: uid, x, hit, id, score } = payload as { userId: string; x: number; hit: boolean; id: number; score: number }
      addCork({ userId: uid, x, hit, id })
      setPlayers(prev => {
        const next = new Map(prev)
        const existing = next.get(uid)
        if (existing) next.set(uid, { ...existing, score })
        return next
      })
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ pseudo: player.pseudo, avatar: player.avatar, score: 0 })
      }
    })

    channelRef.current = channel
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: prof } = await supabase
        .from('profiles').select('display_name, avatar').eq('id', user.id).single()

      if (!prof?.avatar) {
        setPendingUserId(user.id)
        setPendingPseudo(prof?.display_name ?? 'Joueur')
        setNeedsAvatar(true)
        return
      }

      const player: GamePlayer = {
        userId: user.id,
        pseudo: prof.display_name ?? 'Joueur',
        avatar: prof.avatar,
        score: 0,
      }
      setMe(player)
      setupChannel(user.id, player)
    }

    init()
    return () => {
      channelRef.current?.untrack()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  async function chooseAvatar(emoji: string) {
    if (!pendingUserId) return
    await supabase.from('profiles').update({ avatar: emoji }).eq('id', pendingUserId)
    const player: GamePlayer = { userId: pendingUserId, pseudo: pendingPseudo, avatar: emoji, score: 0 }
    setMe(player)
    setNeedsAvatar(false)
    setupChannel(pendingUserId, player)
  }

  function addCork(cork: CorkThrow) {
    setCorks(prev => [...prev.slice(-20), cork])
    setTimeout(() => setCorks(prev => prev.filter(c => c.id !== cork.id)), 1800)
  }

  async function throwCork() {
    if (!me || throwing) return
    const now = Date.now()
    if (now - lastThrowRef.current < 600) return
    lastThrowRef.current = now

    setThrowing(true)

    const x = (Math.random() - 0.5) * 90
    const hit = Math.abs(x) <= GLASS_HIT_RADIUS
    const newScore = me.score + (hit ? 1 : 0)
    const updatedMe = { ...me, score: newScore }
    setMe(updatedMe)

    const id = ++throwIdCounter
    addCork({ userId: me.userId, x, hit, id })
    setLastResult(hit ? 'hit' : 'miss')
    setTimeout(() => setLastResult(null), 900)

    await channelRef.current?.send({
      type: 'broadcast',
      event: 'cork',
      payload: { userId: me.userId, x, hit, id, score: newScore },
    })

    await channelRef.current?.track({ pseudo: me.pseudo, avatar: me.avatar, score: newScore })

    setTimeout(() => setThrowing(false), 350)
  }

  const allPlayers = Array.from(players.values())
  const sorted = [...allPlayers].sort((a, b) => b.score - a.score)

  // Avatar picker screen
  if (needsAvatar) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9995,
        background: 'linear-gradient(135deg, #0d0020 0%, #2d0050 30%, #1a003a 60%, #0d0020 100%)',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '2rem',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🍾</div>
        <div style={{ fontSize: '22px', fontWeight: '700', color: '#FFBE0B', marginBottom: '8px' }}>
          Choisis ton avatar !
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '28px', textAlign: 'center' }}>
          Il sera visible par les autres joueurs dans le Wine Mode
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', maxWidth: '320px' }}>
          {AVATAR_OPTIONS.map(emoji => (
            <button key={emoji} onClick={() => chooseAvatar(emoji)}
              style={{
                width: '56px', height: '56px', borderRadius: '50%', fontSize: '28px',
                border: '2px solid rgba(255,190,11,0.3)', background: 'rgba(255,255,255,0.08)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,190,11,0.2)'; e.currentTarget.style.borderColor = '#FFBE0B' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,190,11,0.3)' }}
            >
              {emoji}
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: '24px', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.5)', borderRadius: '20px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer' }}>
          Annuler
        </button>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9995,
      background: 'linear-gradient(135deg, #0d0020 0%, #2d0050 30%, #1a003a 60%, #0d0020 100%)',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#FFBE0B', letterSpacing: '.02em' }}>
          🍾 Lancer de Bouchons
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: '20px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer' }}>
          ✕ Fermer
        </button>
      </div>

      {/* Scoreboard */}
      <div style={{ display: 'flex', gap: '8px', padding: '10px 16px', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {sorted.length > 0 ? sorted.map((p, i) => (
          <div key={p.userId} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            minWidth: '64px', padding: '8px 10px', borderRadius: '12px',
            background: p.userId === me?.userId ? 'rgba(255,190,11,0.18)' : 'rgba(255,255,255,0.06)',
            border: p.userId === me?.userId ? '1px solid rgba(255,190,11,0.4)' : '1px solid transparent',
            flexShrink: 0,
          }}>
            {i === 0 && p.score > 0 && <div style={{ fontSize: '10px', color: '#FFBE0B' }}>👑</div>}
            <div style={{ fontSize: '26px', lineHeight: 1 }}>{p.avatar}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pseudo}</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFBE0B' }}>{p.score}</div>
          </div>
        )) : (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '8px' }}>
            En attente des autres joueurs...
          </div>
        )}
      </div>

      {/* Game area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Flying corks */}
        {corks.map(c => (
          <div key={c.id} style={{
            position: 'absolute',
            bottom: 0,
            left: `calc(50% + ${c.x * 0.7}%)`,
            transform: 'translateX(-50%)',
            fontSize: '22px',
            animation: 'cork-fly 1.6s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 2,
          }}>
            🪨
          </div>
        ))}

        {/* Central wine glass */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: '100px', lineHeight: 1,
            filter: 'drop-shadow(0 0 30px rgba(255,190,11,0.4))',
            animation: 'glass-pulse 3s ease infinite',
          }}>
            🍷
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>
            Vise le verre !
          </div>

          {/* Hit/miss feedback */}
          {lastResult && (
            <div style={{
              position: 'absolute', top: '-48px', left: '50%',
              fontSize: '20px', fontWeight: '700',
              animation: 'result-pop 0.9s ease forwards',
              whiteSpace: 'nowrap', color: lastResult === 'hit' ? '#FFBE0B' : 'rgba(255,255,255,0.5)',
            }}>
              {lastResult === 'hit' ? '🎯 Dans le verre !' : '💨 Raté...'}
            </div>
          )}
        </div>
      </div>

      {/* Throw button */}
      <div style={{ padding: '20px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={throwCork}
          disabled={throwing}
          style={{
            width: '100%', maxWidth: '320px', padding: '18px',
            background: throwing ? 'rgba(255,190,11,0.3)' : 'linear-gradient(135deg, #FF006E, #8338EC)',
            border: 'none', borderRadius: '16px', color: '#fff',
            fontSize: '18px', fontWeight: '700', cursor: throwing ? 'default' : 'pointer',
            boxShadow: throwing ? 'none' : '0 0 24px rgba(255,0,110,0.4)',
            transition: 'all .2s',
          }}>
          {throwing ? '💨 En vol...' : `${me?.avatar ?? '🍾'} Lancer !`}
        </button>
        <div style={{ marginTop: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
          Mon score : <strong style={{ color: '#FFBE0B' }}>{me?.score ?? 0}</strong>
        </div>
      </div>

      <style>{`
        @keyframes cork-fly {
          0%   { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
          35%  { transform: translateX(-50%) translateY(-52vh) scale(1.3); opacity: 1; }
          65%  { transform: translateX(-50%) translateY(-44vh) scale(0.85); opacity: 0.85; }
          100% { transform: translateX(-50%) translateY(-20vh) scale(0.5); opacity: 0; }
        }
        @keyframes glass-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 30px rgba(255,190,11,0.4)); }
          50%       { transform: scale(1.05); filter: drop-shadow(0 0 50px rgba(255,190,11,0.7)); }
        }
        @keyframes result-pop {
          0%   { opacity: 0; transform: translateX(-50%) scale(0.6) translateY(8px); }
          25%  { opacity: 1; transform: translateX(-50%) scale(1.1) translateY(-4px); }
          70%  { opacity: 1; transform: translateX(-50%) scale(1) translateY(-10px); }
          100% { opacity: 0; transform: translateX(-50%) scale(0.9) translateY(-22px); }
        }
      `}</style>
    </div>
  )
}
