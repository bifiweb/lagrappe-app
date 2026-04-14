'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Constants ────────────────────────────────────────────────────────────────

const GLASS_X = 50   // % from left
const GLASS_Y = 38   // % from top
const HIT_THRESHOLD = 15 // % of container width — half-width of hit zone
const MIN_SWIPE_UP = 4   // min % upward movement to register throw

const AVATAR_SEEDS = [
  'Warrior','Pirate','Ninja','Wizard','Viking',
  'Vampire','Cowboy','Samurai','Hunter','Knight',
  'Rogue','Mage','Bard','Ranger','Monk',
  'Druid','Berserker','Assassin','Sorcerer','Paladin',
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface GamePlayer { userId: string; pseudo: string; avatar: string; score: number }
interface FlyingCork { id: number; hit: boolean; missRight: boolean }
interface AimState { startX: number; startY: number; curX: number; curY: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarUrl(seed: string) {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

function AvatarImg({ seed, size = 44 }: { seed: string; size?: number }) {
  return (
    <img src={avatarUrl(seed)} width={size} height={size}
      style={{ borderRadius: '50%', objectFit: 'cover', display: 'block', flexShrink: 0 }}
      alt={seed} loading="lazy" />
  )
}

function CorkShape({ rotate = -15 }: { rotate?: number }) {
  return (
    <div style={{
      width: '16px', height: '28px',
      background: 'linear-gradient(160deg, #e8b07c 0%, #c07838 45%, #8b4513 100%)',
      borderRadius: '5px 5px 4px 4px',
      border: '1.5px solid #6b3a2a',
      boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.3), inset 1px 0 3px rgba(255,220,180,0.3), 0 3px 10px rgba(0,0,0,0.6)',
      position: 'relative', overflow: 'hidden',
      transform: `rotate(${rotate}deg)`,
    }}>
      {[24, 50, 76].map(pct => (
        <div key={pct} style={{ position: 'absolute', top: `${pct}%`, left: '20%', right: '20%', height: '1px', background: 'rgba(0,0,0,0.18)' }} />
      ))}
    </div>
  )
}

function DiscoBall() {
  const COLS = 7; const ROWS = 7
  const COLORS = ['#FF006E','#8338EC','#FFBE0B','#06D6A0','#ffffff','#FF6B9D','#00B4D8']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '2px', height: '18px', background: 'rgba(255,255,255,0.25)' }} />
      <div style={{
        width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden',
        display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        boxShadow: '0 0 18px rgba(255,190,11,0.35), 0 0 36px rgba(131,56,236,0.2)',
        animation: 'disco-spin 6s linear infinite',
      }}>
        {Array.from({ length: COLS * ROWS }, (_, i) => (
          <div key={i} style={{
            background: COLORS[(i * 3 + Math.floor(i / COLS)) % COLORS.length],
            opacity: 0.7 + (i % 3) * 0.1,
          }} />
        ))}
      </div>
    </div>
  )
}

let corkSeq = 0

// ─── Main component ───────────────────────────────────────────────────────────

export default function WineModeGame({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const [me, setMe]               = useState<GamePlayer | null>(null)
  const [players, setPlayers]     = useState<Map<string, GamePlayer>>(new Map())
  const [corks, setCorks]         = useState<FlyingCork[]>([])
  const [aim, setAim]             = useState<AimState | null>(null)
  const [throwing, setThrowing]   = useState(false)
  const [result, setResult]       = useState<{ type: 'hit' | 'miss'; seq: number } | null>(null)
  const [glassHit, setGlassHit]   = useState(false)
  const [needsAvatar, setNeedsAvatar] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pendingPseudo, setPendingPseudo] = useState('Joueur')

  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const meRef        = useRef<GamePlayer | null>(null)
  const lastThrowRef = useRef(0)

  meRef.current = me

  // Sparkles (stable across renders)
  const sparkles = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: 5 + (i * 4.7 + 11) % 90,
    y: 5 + (i * 3.3 + 7) % 68,
    size: 3 + (i % 4),
    delay: (i * 0.37) % 5,
    dur: 1.4 + (i % 5) * 0.4,
    color: ['#FF006E','#8338EC','#FFBE0B','#06D6A0','#fff','#FF6B9D'][i % 6],
  })), [])

  // ── Channel ──────────────────────────────────────────────────
  function setupChannel(userId: string, player: GamePlayer) {
    if (channelRef.current) {
      channelRef.current.untrack()
      supabase.removeChannel(channelRef.current)
    }
    const ch = supabase.channel('wine-game:global', { config: { presence: { key: userId } } })

    // Preserve scores — they come only from broadcast, not presence
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ pseudo: string; avatar: string }>()
      setPlayers(prev => {
        const next = new Map<string, GamePlayer>()
        Object.entries(state).forEach(([uid, presences]) => {
          const p = presences[0]
          const existing = prev.get(uid)
          next.set(uid, {
            userId: uid, pseudo: p.pseudo, avatar: p.avatar,
            score: uid === userId ? (meRef.current?.score ?? 0) : (existing?.score ?? 0),
          })
        })
        return next
      })
    })

    ch.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const p = newPresences[0] as { pseudo: string; avatar: string }
      setPlayers(prev => {
        const next = new Map(prev)
        const ex = next.get(key)
        next.set(key, { userId: key, pseudo: p.pseudo, avatar: p.avatar, score: ex?.score ?? 0 })
        return next
      })
    })

    ch.on('presence', { event: 'leave' }, ({ key }) => {
      setPlayers(prev => { const n = new Map(prev); n.delete(key); return n })
    })

    ch.on('broadcast', { event: 'cork' }, ({ payload }) => {
      const { userId: uid, hit, missRight, id, score } = payload as { userId: string; hit: boolean; missRight: boolean; id: number; score: number }
      spawnCork({ id, hit, missRight })
      setPlayers(prev => {
        const next = new Map(prev)
        const ex = next.get(uid)
        if (ex) next.set(uid, { ...ex, score })
        return next
      })
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ pseudo: player.pseudo, avatar: player.avatar })
      }
    })
    channelRef.current = ch
  }

  // ── Init ─────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('display_name, avatar').eq('id', user.id).single()
      if (!prof?.avatar) {
        setPendingId(user.id)
        setPendingPseudo(prof?.display_name ?? 'Joueur')
        setNeedsAvatar(true)
        return
      }
      const player: GamePlayer = { userId: user.id, pseudo: prof.display_name ?? 'Joueur', avatar: prof.avatar, score: 0 }
      setMe(player)
      setupChannel(user.id, player)
    }
    init()
    return () => {
      channelRef.current?.untrack()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  async function chooseAvatar(seed: string) {
    if (!pendingId) return
    await supabase.from('profiles').update({ avatar: seed }).eq('id', pendingId)
    const player: GamePlayer = { userId: pendingId, pseudo: pendingPseudo, avatar: seed, score: 0 }
    setMe(player)
    setNeedsAvatar(false)
    setupChannel(pendingId, player)
  }

  // ── Cork spawning ─────────────────────────────────────────────
  function spawnCork(cork: FlyingCork) {
    setCorks(prev => [...prev.slice(-10), cork])
    setTimeout(() => setCorks(prev => prev.filter(c => c.id !== cork.id)), 1900)
  }

  // ── Swipe-to-throw (Pokémon Go style) ───────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (throwing || !me) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setAim({ startX: x, startY: y, curX: x, curY: y })
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!aim) return
    const rect = e.currentTarget.getBoundingClientRect()
    setAim(prev => prev ? { ...prev, curX: ((e.clientX - rect.left) / rect.width) * 100, curY: ((e.clientY - rect.top) / rect.height) * 100 } : null)
  }

  async function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!aim || !me) { setAim(null); return }
    const now = Date.now()
    if (now - lastThrowRef.current < 700) { setAim(null); return }

    const dyUp = aim.startY - aim.curY // positive = swiped upward
    if (dyUp < MIN_SWIPE_UP) { setAim(null); return }

    // Extrapolate swipe direction to glass Y level
    const dx = aim.curX - aim.startX
    const t = (aim.startY - GLASS_Y) / dyUp
    const predictedX = aim.startX + dx * t
    const hit = Math.abs(predictedX - GLASS_X) < HIT_THRESHOLD
    const missRight = predictedX > GLASS_X

    setAim(null)
    setThrowing(true)
    lastThrowRef.current = now

    const newScore = me.score + (hit ? 1 : 0)
    setMe(prev => prev ? { ...prev, score: newScore } : null)

    const id = ++corkSeq
    spawnCork({ id, hit, missRight })

    const seq = id
    setResult({ type: hit ? 'hit' : 'miss', seq })
    if (hit) { setGlassHit(true); setTimeout(() => setGlassHit(false), 600) }
    setTimeout(() => setResult(prev => prev?.seq === seq ? null : prev), 1300)

    await channelRef.current?.send({
      type: 'broadcast', event: 'cork',
      payload: { userId: me.userId, hit, missRight, id, score: newScore },
    })
    await channelRef.current?.track({ pseudo: me.pseudo, avatar: me.avatar })
    setTimeout(() => setThrowing(false), 700)
  }

  // ── Aim analysis for trajectory display ──────────────────────
  const aimActive = !!(aim && aim.startY > aim.curY + 1)
  let aimHit = false
  if (aimActive && aim) {
    const dyUp = aim.startY - aim.curY
    if (dyUp > 0) {
      const dx = aim.curX - aim.startX
      const t = (aim.startY - GLASS_Y) / dyUp
      aimHit = Math.abs(aim.startX + dx * t - GLASS_X) < HIT_THRESHOLD
    }
  }

  const sorted = Array.from(players.values()).sort((a, b) => b.score - a.score)

  // ── Avatar picker ─────────────────────────────────────────────
  if (needsAvatar) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9995,
        background: 'linear-gradient(135deg, #0d0020 0%, #2d0050 30%, #1a003a 100%)',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '2rem 1.5rem', overflowY: 'auto', justifyContent: 'center',
      }}>
        <div style={{ fontSize: '44px', marginBottom: '10px' }}>🍾</div>
        <div style={{ fontSize: '22px', fontWeight: '700', color: '#FFBE0B', marginBottom: '6px' }}>Choisis ton personnage !</div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px', textAlign: 'center' }}>
          Il représente qui tu es dans le Wine Mode
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', maxWidth: '340px', width: '100%' }}>
          {AVATAR_SEEDS.map(seed => (
            <button key={seed} onClick={() => chooseAvatar(seed)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,190,11,0.18)',
                borderRadius: '14px', padding: '10px 6px 8px',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#FFBE0B'; e.currentTarget.style.background = 'rgba(255,190,11,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,190,11,0.18)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            >
              <AvatarImg seed={seed} size={58} />
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>{seed}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: '20px', background: 'rgba(255,255,255,0.07)', border: 'none', color: 'rgba(255,255,255,0.4)', borderRadius: '20px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer' }}>
          Annuler
        </button>
      </div>
    )
  }

  // ── Main game ─────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9995,
      fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a001a',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,0.35)', zIndex: 10, flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFBE0B', letterSpacing: '.02em' }}>🍾 Lancer de Bouchons</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '20px', padding: '5px 13px', fontSize: '12px', cursor: 'pointer' }}>✕ Fermer</button>
      </div>

      {/* ── Scoreboard ── */}
      <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', overflowX: 'auto', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, zIndex: 10 }}>
        {sorted.length > 0 ? sorted.map((p, i) => (
          <div key={p.userId} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            minWidth: '62px', padding: '6px 8px', borderRadius: '10px', flexShrink: 0,
            background: p.userId === me?.userId ? 'rgba(255,190,11,0.15)' : 'rgba(255,255,255,0.06)',
            border: p.userId === me?.userId ? '1px solid rgba(255,190,11,0.4)' : '1px solid transparent',
          }}>
            {i === 0 && p.score > 0 && <span style={{ fontSize: '9px', color: '#FFBE0B', lineHeight: 1 }}>👑</span>}
            <AvatarImg seed={p.avatar} size={36} />
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', maxWidth: '58px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pseudo}</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#FFBE0B' }}>{p.score}</span>
          </div>
        )) : (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '8px 4px' }}>En attente des joueurs...</div>
        )}
      </div>

      {/* ── Game area ── */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setAim(null)}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', touchAction: 'none', cursor: throwing ? 'default' : 'crosshair' }}
      >

        {/* Animated background */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0d0020 0%, #2d0050 35%, #1a003a 65%, #0a0018 100%)', animation: 'disco-bg 10s ease infinite', zIndex: 0 }} />

        {/* Spotlight beams */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: '10%', width: '260px', height: '85%', background: 'linear-gradient(180deg, rgba(255,0,110,0.13) 0%, transparent 70%)', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', transformOrigin: 'top center', animation: 'spot-a 5s ease-in-out infinite alternate' }} />
          <div style={{ position: 'absolute', top: 0, right: '8%', width: '240px', height: '85%', background: 'linear-gradient(180deg, rgba(131,56,236,0.14) 0%, transparent 70%)', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', transformOrigin: 'top center', animation: 'spot-b 4s ease-in-out infinite alternate-reverse' }} />
          <div style={{ position: 'absolute', top: 0, left: '42%', width: '200px', height: '75%', background: 'linear-gradient(180deg, rgba(255,190,11,0.07) 0%, transparent 65%)', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', transformOrigin: 'top center', animation: 'spot-a 7s ease-in-out infinite alternate 2s' }} />
          {/* Floor glow */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(0deg, rgba(131,56,236,0.1) 0%, transparent 100%)' }} />
          {/* Colored radial glows */}
          <div style={{ position: 'absolute', top: '20%', left: '10%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,0,110,0.06) 0%, transparent 70%)', animation: 'disco-bg 8s ease infinite' }} />
          <div style={{ position: 'absolute', top: '40%', right: '5%', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(131,56,236,0.08) 0%, transparent 70%)', animation: 'disco-bg 11s ease infinite reverse' }} />
        </div>

        {/* Sparkles */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
          {sparkles.map(s => (
            <div key={s.id} style={{
              position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
              width: `${s.size}px`, height: `${s.size}px`, borderRadius: '50%',
              background: s.color, boxShadow: `0 0 ${s.size * 3}px ${s.color}`,
              animation: `sparkle-blink ${s.dur}s ease-in-out ${s.delay}s infinite`,
            }} />
          ))}
        </div>

        {/* Disco ball */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 3, pointerEvents: 'none' }}>
          <DiscoBall />
        </div>

        {/* Glass */}
        <div style={{
          position: 'absolute', left: `${GLASS_X}%`, top: `${GLASS_Y}%`,
          transform: 'translate(-50%, -50%)', zIndex: 4, textAlign: 'center', pointerEvents: 'none',
        }}>
          {/* Hit zone ring */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '110px', height: '110px', borderRadius: '50%',
            border: `2px dashed ${aimActive ? (aimHit ? 'rgba(6,214,160,0.6)' : 'rgba(255,0,110,0.45)') : 'rgba(255,255,255,0.12)'}`,
            transition: 'border-color .15s',
          }} />
          <div style={{
            fontSize: '88px', lineHeight: 1,
            filter: glassHit
              ? 'drop-shadow(0 0 50px #FFBE0B) brightness(1.6)'
              : 'drop-shadow(0 0 18px rgba(255,190,11,0.25))',
            animation: glassHit ? 'glass-wobble .5s ease' : 'glass-float 3.5s ease-in-out infinite',
            transition: 'filter .1s',
          }}>
            🍷
          </div>
        </div>

        {/* SVG aim trajectory */}
        {aimActive && aim && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
            <line
              x1={`${aim.curX}%`} y1={`${aim.curY}%`}
              x2={`${GLASS_X}%`} y2={`${GLASS_Y}%`}
              stroke={aimHit ? '#06D6A0' : '#FF006E'}
              strokeWidth="2.5" strokeDasharray="10 7" opacity="0.6"
            />
            {/* Target dot */}
            <circle cx={`${GLASS_X}%`} cy={`${GLASS_Y}%`} r="5"
              fill={aimHit ? '#06D6A0' : '#FF006E'} opacity="0.5" />
          </svg>
        )}

        {/* Cork following finger */}
        {aimActive && aim && (
          <div style={{
            position: 'absolute', left: `${aim.curX}%`, top: `${aim.curY}%`,
            transform: 'translate(-50%, -50%)', zIndex: 6, pointerEvents: 'none',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))',
          }}>
            <CorkShape rotate={-25} />
          </div>
        )}

        {/* Flying corks */}
        {corks.map(c => (
          <div key={c.id} style={{
            position: 'absolute',
            left: `${GLASS_X}%`, top: '92%',
            transform: 'translate(-50%, -50%)',
            animation: c.hit ? 'cork-hit 1.7s cubic-bezier(.2,.8,.3,1) forwards' : (c.missRight ? 'cork-miss-r 1.6s cubic-bezier(.2,.8,.3,1) forwards' : 'cork-miss-l 1.6s cubic-bezier(.2,.8,.3,1) forwards'),
            zIndex: 7, pointerEvents: 'none',
          }}>
            <CorkShape rotate={-20} />
          </div>
        ))}

        {/* Hit/miss result */}
        {result && (
          <div style={{
            position: 'absolute', left: '50%', top: '22%',
            transform: 'translateX(-50%)',
            fontSize: '19px', fontWeight: '800', whiteSpace: 'nowrap',
            color: result.type === 'hit' ? '#FFBE0B' : 'rgba(255,255,255,0.55)',
            textShadow: result.type === 'hit' ? '0 0 24px #FFBE0B, 0 0 48px rgba(255,190,11,0.4)' : 'none',
            animation: 'result-pop 1.2s ease forwards',
            zIndex: 8, pointerEvents: 'none',
          }}>
            {result.type === 'hit' ? '🎯 Dans le verre !' : '💨 Raté !'}
          </div>
        )}

        {/* Idle instruction */}
        {!aimActive && !throwing && me && (
          <div style={{ position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 4 }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px', letterSpacing: '.03em' }}>
              Glisse vers le haut pour lancer !
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', animation: 'cork-idle 2s ease-in-out infinite' }}>
              <CorkShape rotate={-15} />
            </div>
          </div>
        )}

        {/* My score badge */}
        {me && (
          <div style={{
            position: 'absolute', bottom: '4%', right: '4%', zIndex: 9,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            borderRadius: '12px', padding: '5px 12px', border: '1px solid rgba(255,190,11,0.2)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <AvatarImg seed={me.avatar} size={22} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              Score <strong style={{ color: '#FFBE0B' }}>{me.score}</strong>
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spot-a {
          from { transform: rotate(-30deg); }
          to   { transform: rotate(30deg); }
        }
        @keyframes spot-b {
          from { transform: rotate(25deg); }
          to   { transform: rotate(-25deg); }
        }
        @keyframes disco-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes sparkle-blink {
          0%, 100% { opacity: 0; transform: scale(0.4); }
          50%       { opacity: 1; transform: scale(1.4); }
        }
        @keyframes glass-float {
          0%, 100% { transform: translateY(0) scale(1); }
          50%       { transform: translateY(-5px) scale(1.03); }
        }
        @keyframes glass-wobble {
          0%   { transform: scale(1) rotate(0deg); }
          20%  { transform: scale(1.3) rotate(-10deg); }
          45%  { transform: scale(1.15) rotate(7deg); }
          65%  { transform: scale(1.08) rotate(-4deg); }
          85%  { transform: scale(1.03) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes cork-hit {
          0%   { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
          55%  { transform: translate(-50%, calc(-50% - 54vh)) rotate(200deg) scale(1.25); opacity: 1; }
          78%  { transform: translate(-50%, calc(-50% - 47vh)) rotate(320deg) scale(0.85); opacity: 0.8; }
          100% { transform: translate(-50%, calc(-50% - 44vh)) rotate(400deg) scale(0.4); opacity: 0; }
        }
        @keyframes cork-miss-r {
          0%   { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
          45%  { transform: translate(-50%, calc(-50% - 46vh)) rotate(170deg) scale(1.05); opacity: 1; }
          100% { transform: translate(calc(-50% + 100px), calc(-50% - 28vh)) rotate(350deg) scale(0.5); opacity: 0; }
        }
        @keyframes cork-miss-l {
          0%   { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
          45%  { transform: translate(-50%, calc(-50% - 46vh)) rotate(170deg) scale(1.05); opacity: 1; }
          100% { transform: translate(calc(-50% - 100px), calc(-50% - 28vh)) rotate(350deg) scale(0.5); opacity: 0; }
        }
        @keyframes result-pop {
          0%   { opacity: 0; transform: translateX(-50%) scale(0.6) translateY(12px); }
          20%  { opacity: 1; transform: translateX(-50%) scale(1.15) translateY(-4px); }
          65%  { opacity: 1; transform: translateX(-50%) scale(1) translateY(-8px); }
          100% { opacity: 0; transform: translateX(-50%) scale(0.9) translateY(-24px); }
        }
        @keyframes cork-idle {
          0%, 100% { transform: translateY(0) rotate(-15deg); }
          50%       { transform: translateY(-8px) rotate(-5deg); }
        }
      `}</style>
    </div>
  )
}
