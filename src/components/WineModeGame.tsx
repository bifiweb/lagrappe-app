'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CHARACTERS, avatarUrl, getCharacter } from '@/lib/gameCharacters'

// ─── Constants ────────────────────────────────────────────────────────────────

const GLASS_Y      = 36   // % from top (fixed vertical)
const GLASS_X_BASE = 50   // % center
const HIT_RADIUS   = 10   // % — smaller = harder
const MIN_SWIPE    = 3    // minimum % upward movement

// Glass oscillation: x(t) = 50 + A1·sin(ω1·t) + A2·sin(ω2·t + φ)
const OSC_A1 = 24; const OSC_W1 = 0.62
const OSC_A2 =  9; const OSC_W2 = 0.27; const OSC_PHI = 1.4

// ─── Types ────────────────────────────────────────────────────────────────────

interface GamePlayer { userId: string; pseudo: string; avatar: string; score: number }
interface FlyingCork { id: number; hit: boolean; missRight: boolean }

// ─── Small components ─────────────────────────────────────────────────────────

/** DiceBear character with emoji badge overlay */
function AvatarBadge({ seed, size = 44 }: { seed: string; size?: number }) {
  const char = getCharacter(seed)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <img src={avatarUrl(seed, char?.skinColor)} width={size} height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        alt={char?.label ?? seed} loading="lazy" />
      {char && (
        <span style={{
          position: 'absolute', bottom: -1, right: -2,
          fontSize: `${Math.round(size * 0.36)}px`, lineHeight: 1,
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))',
        }}>{char.emoji}</span>
      )}
    </div>
  )
}

function CorkShape({ rotate = -15 }: { rotate?: number }) {
  return (
    <div style={{
      width: '15px', height: '26px',
      background: 'linear-gradient(160deg, #e8b07c 0%, #c07838 50%, #8b4513 100%)',
      borderRadius: '4px 4px 3px 3px',
      border: '1.5px solid #6b3a2a',
      boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.3), inset 1px 0 3px rgba(255,210,160,0.25), 0 3px 8px rgba(0,0,0,0.6)',
      transform: `rotate(${rotate}deg)`,
      position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      {[24, 50, 76].map(p => (
        <div key={p} style={{ position: 'absolute', top: `${p}%`, left: '18%', right: '18%', height: '1px', background: 'rgba(0,0,0,0.18)' }} />
      ))}
    </div>
  )
}

function DiscoBall() {
  const COLS = 7; const ROWS = 7
  const CLRS = ['#FF006E','#8338EC','#FFBE0B','#06D6A0','#fff','#FF6B9D','#00B4D8']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '2px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
      <div style={{
        width: '50px', height: '50px', borderRadius: '50%', overflow: 'hidden',
        display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        boxShadow: '0 0 16px rgba(255,190,11,0.3), 0 0 32px rgba(131,56,236,0.15)',
        animation: 'disco-spin 6s linear infinite',
      }}>
        {Array.from({ length: COLS * ROWS }, (_, i) => (
          <div key={i} style={{ background: CLRS[(i * 3 + Math.floor(i / COLS)) % CLRS.length], opacity: 0.72 + (i % 3) * 0.09 }} />
        ))}
      </div>
    </div>
  )
}

let corkSeq = 0

// ─── Main component ───────────────────────────────────────────────────────────

export default function WineModeGame({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const [me, setMe]             = useState<GamePlayer | null>(null)
  const [players, setPlayers]   = useState<Map<string, GamePlayer>>(new Map())
  const [corks, setCorks]       = useState<FlyingCork[]>([])
  const [aim, setAim]           = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null)
  const [throwing, setThrowing] = useState(false)
  const [result, setResult]     = useState<{ type: 'hit' | 'miss'; seq: number } | null>(null)
  const [glassHit, setGlassHit] = useState(false)
  const [needsAvatar, setNeedsAvatar] = useState(false)
  const [pendingId, setPendingId]     = useState<string | null>(null)
  const [pendingPseudo, setPendingPseudo] = useState('Joueur')

  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const meRef        = useRef<GamePlayer | null>(null)
  const lastThrowRef = useRef(0)
  // Moving glass
  const glassElemRef = useRef<HTMLDivElement>(null)
  const glassXRef    = useRef(GLASS_X_BASE)
  const rafRef       = useRef<number>()
  const startTimeRef = useRef(Date.now())
  // Hit ring color (direct DOM update on pointer move)
  const ringRef      = useRef<HTMLDivElement>(null)

  meRef.current = me

  // Stable sparkles
  const sparkles = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    id: i, x: 5 + (i * 4.3 + 9) % 88, y: 5 + (i * 3.7 + 6) % 66,
    size: 3 + (i % 4), delay: (i * 0.41) % 5.2, dur: 1.3 + (i % 5) * 0.38,
    color: ['#FF006E','#8338EC','#FFBE0B','#06D6A0','#fff','#FF6B9D'][i % 6],
  })), [])

  // ── Moving glass (direct DOM, no React state) ──────────────
  useEffect(() => {
    function tick() {
      const t = (Date.now() - startTimeRef.current) / 1000
      const x = GLASS_X_BASE + Math.sin(t * OSC_W1) * OSC_A1 + Math.sin(t * OSC_W2 + OSC_PHI) * OSC_A2
      glassXRef.current = x
      if (glassElemRef.current) glassElemRef.current.style.left = `${x}%`
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  // ── Supabase channel ──────────────────────────────────────
  function setupChannel(userId: string, player: GamePlayer) {
    if (channelRef.current) { channelRef.current.untrack(); supabase.removeChannel(channelRef.current) }
    const ch = supabase.channel('wine-game:global', { config: { presence: { key: userId } } })

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ pseudo: string; avatar: string }>()
      setPlayers(prev => {
        const next = new Map<string, GamePlayer>()
        Object.entries(state).forEach(([uid, presences]) => {
          const p = presences[0]
          const ex = prev.get(uid)
          next.set(uid, {
            userId: uid, pseudo: p.pseudo, avatar: p.avatar,
            // Always use local me ref for own score (avoids stale closure race)
            score: uid === userId ? (meRef.current?.score ?? 0) : (ex?.score ?? 0),
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
      if (status === 'SUBSCRIBED') await ch.track({ pseudo: player.pseudo, avatar: player.avatar })
    })
    channelRef.current = ch
  }

  // ── Init ────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('display_name, avatar').eq('id', user.id).single()
      if (!prof?.avatar) {
        setPendingId(user.id); setPendingPseudo(prof?.display_name ?? 'Joueur'); setNeedsAvatar(true); return
      }
      const player: GamePlayer = { userId: user.id, pseudo: prof.display_name ?? 'Joueur', avatar: prof.avatar, score: 0 }
      meRef.current = player
      setMe(player)
      setupChannel(user.id, player)
    }
    init()
    return () => { channelRef.current?.untrack(); if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  async function chooseAvatar(seed: string) {
    if (!pendingId) return
    await supabase.from('profiles').update({ avatar: seed }).eq('id', pendingId)
    const player: GamePlayer = { userId: pendingId, pseudo: pendingPseudo, avatar: seed, score: 0 }
    meRef.current = player
    setMe(player)
    setNeedsAvatar(false)
    setupChannel(pendingId, player)
  }

  function spawnCork(cork: FlyingCork) {
    setCorks(prev => [...prev.slice(-10), cork])
    setTimeout(() => setCorks(prev => prev.filter(c => c.id !== cork.id)), 2000)
  }

  // ── Helper: compute hit from aim vectors ─────────────────────
  function computeHit(startX: number, startY: number, curX: number, curY: number): { hit: boolean; predictedX: number } {
    const dyUp = startY - curY
    if (dyUp <= 0) return { hit: false, predictedX: startX }
    const dx = curX - startX
    const t = (startY - GLASS_Y) / dyUp
    const predictedX = startX + dx * t
    return { hit: Math.abs(predictedX - glassXRef.current) < HIT_RADIUS, predictedX }
  }

  // ── Pointer handlers ─────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (throwing || !me) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setAim({ startX: x, startY: y, curX: x, curY: y })
    if (ringRef.current) ringRef.current.style.borderColor = 'rgba(255,255,255,0.18)'
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!aim) return
    const rect = e.currentTarget.getBoundingClientRect()
    const curX = ((e.clientX - rect.left) / rect.width) * 100
    const curY = ((e.clientY - rect.top) / rect.height) * 100
    setAim(prev => prev ? { ...prev, curX, curY } : null)

    // Update ring color directly (no React re-render needed)
    if (ringRef.current) {
      const { hit } = computeHit(aim.startX, aim.startY, curX, curY)
      const dyUp = aim.startY - curY
      if (dyUp > MIN_SWIPE) {
        ringRef.current.style.borderColor = hit ? 'rgba(6,214,160,0.75)' : 'rgba(255,0,110,0.6)'
        ringRef.current.style.boxShadow   = hit ? '0 0 22px rgba(6,214,160,0.5)' : '0 0 18px rgba(255,0,110,0.4)'
      } else {
        ringRef.current.style.borderColor = 'rgba(255,255,255,0.18)'
        ringRef.current.style.boxShadow   = 'none'
      }
    }
  }

  async function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!aim || !me) { setAim(null); return }
    const now = Date.now()
    if (now - lastThrowRef.current < 700) { setAim(null); return }

    const dyUp = aim.startY - aim.curY
    if (dyUp < MIN_SWIPE) { setAim(null); return }

    const { hit, predictedX } = computeHit(aim.startX, aim.startY, aim.curX, aim.curY)
    const missRight = predictedX > glassXRef.current

    setAim(null)
    if (ringRef.current) { ringRef.current.style.borderColor = 'rgba(255,255,255,0.12)'; ringRef.current.style.boxShadow = 'none' }
    setThrowing(true)
    lastThrowRef.current = now

    const newScore = me.score + (hit ? 1 : 0)
    // Update ref BEFORE state (avoids sync handler stale read)
    meRef.current = { ...me, score: newScore }
    setMe(meRef.current)

    const id = ++corkSeq
    spawnCork({ id, hit, missRight })

    const seq = id
    setResult({ type: hit ? 'hit' : 'miss', seq })
    if (hit) { setGlassHit(true); setTimeout(() => setGlassHit(false), 600) }
    setTimeout(() => setResult(prev => prev?.seq === seq ? null : prev), 1400)

    await channelRef.current?.send({ type: 'broadcast', event: 'cork', payload: { userId: me.userId, hit, missRight, id, score: newScore } })
    await channelRef.current?.track({ pseudo: me.pseudo, avatar: me.avatar })
    setTimeout(() => setThrowing(false), 700)
  }

  // Scoreboard: merge me's live score into players map
  const displayPlayers = Array.from(players.values()).map(p =>
    p.userId === me?.userId ? { ...p, score: me.score } : p
  )
  const sorted = displayPlayers.sort((a, b) => b.score - a.score)

  // ── Avatar picker ─────────────────────────────────────────────
  if (needsAvatar) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9995, background: 'linear-gradient(135deg, #0d0020 0%, #2d0050 30%, #1a003a 100%)', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1.5rem', overflowY: 'auto', justifyContent: 'center' }}>
        <div style={{ fontSize: '44px', marginBottom: '10px' }}>🍾</div>
        <div style={{ fontSize: '22px', fontWeight: '700', color: '#FFBE0B', marginBottom: '6px' }}>Choisis ton personnage !</div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px', textAlign: 'center' }}>Il représente qui tu es dans le Wine Mode</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', maxWidth: '340px', width: '100%' }}>
          {CHARACTERS.map(char => (
            <button key={char.seed} onClick={() => chooseAvatar(char.seed)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,190,11,0.18)', borderRadius: '14px', padding: '10px 6px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#FFBE0B'; e.currentTarget.style.background = 'rgba(255,190,11,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,190,11,0.18)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            >
              <AvatarBadge seed={char.seed} size={56} />
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>{char.label}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: '20px', background: 'rgba(255,255,255,0.07)', border: 'none', color: 'rgba(255,255,255,0.4)', borderRadius: '20px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer' }}>Annuler</button>
      </div>
    )
  }

  // ── Main game ─────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9995, fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a001a' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,0.35)', zIndex: 10, flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFBE0B' }}>🍾 Lancer de Bouchons</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '20px', padding: '5px 13px', fontSize: '12px', cursor: 'pointer' }}>✕ Fermer</button>
      </div>

      {/* Scoreboard — me inclus avec score live */}
      <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', overflowX: 'auto', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, zIndex: 10 }}>
        {sorted.length > 0 ? sorted.map((p, i) => (
          <div key={p.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '60px', padding: '5px 7px', borderRadius: '10px', flexShrink: 0, background: p.userId === me?.userId ? 'rgba(255,190,11,0.15)' : 'rgba(255,255,255,0.06)', border: p.userId === me?.userId ? '1px solid rgba(255,190,11,0.4)' : '1px solid transparent' }}>
            {i === 0 && p.score > 0 && <span style={{ fontSize: '9px', color: '#FFBE0B', lineHeight: 1 }}>👑</span>}
            <AvatarBadge seed={p.avatar} size={34} />
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', maxWidth: '56px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pseudo}</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#FFBE0B' }}>{p.score}</span>
          </div>
        )) : (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '8px 4px' }}>En attente des joueurs...</div>
        )}
      </div>

      {/* Game area */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { setAim(null); if (ringRef.current) { ringRef.current.style.borderColor = 'rgba(255,255,255,0.12)'; ringRef.current.style.boxShadow = 'none' } }}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', touchAction: 'none', cursor: throwing ? 'default' : 'crosshair' }}
      >
        {/* Background gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0d0020 0%, #2d0050 35%, #1a003a 65%, #0a0018 100%)', animation: 'disco-bg 10s ease infinite', zIndex: 0 }} />

        {/* Spotlight beams */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: '8%', width: '250px', height: '88%', background: 'linear-gradient(180deg, rgba(255,0,110,0.13) 0%, transparent 68%)', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', transformOrigin: 'top center', animation: 'spot-a 5s ease-in-out infinite alternate' }} />
          <div style={{ position: 'absolute', top: 0, right: '6%', width: '230px', height: '88%', background: 'linear-gradient(180deg, rgba(131,56,236,0.14) 0%, transparent 68%)', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', transformOrigin: 'top center', animation: 'spot-b 4.3s ease-in-out infinite alternate-reverse' }} />
          <div style={{ position: 'absolute', top: 0, left: '40%', width: '210px', height: '78%', background: 'linear-gradient(180deg, rgba(255,190,11,0.07) 0%, transparent 62%)', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', transformOrigin: 'top center', animation: 'spot-a 7s ease-in-out infinite alternate 1.8s' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(0deg, rgba(131,56,236,0.09) 0%, transparent 100%)' }} />
          <div style={{ position: 'absolute', top: '18%', left: '8%', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,0,110,0.05) 0%, transparent 70%)', animation: 'disco-bg 9s ease infinite' }} />
          <div style={{ position: 'absolute', top: '42%', right: '4%', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(131,56,236,0.07) 0%, transparent 70%)', animation: 'disco-bg 12s ease infinite reverse' }} />
        </div>

        {/* Sparkles */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
          {sparkles.map(s => (
            <div key={s.id} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, width: `${s.size}px`, height: `${s.size}px`, borderRadius: '50%', background: s.color, boxShadow: `0 0 ${s.size * 3}px ${s.color}`, animation: `sparkle-blink ${s.dur}s ease-in-out ${s.delay}s infinite` }} />
          ))}
        </div>

        {/* Disco ball */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 3, pointerEvents: 'none' }}>
          <DiscoBall />
        </div>

        {/* Moving glass (position updated via direct DOM) */}
        <div ref={glassElemRef} style={{ position: 'absolute', top: `${GLASS_Y}%`, left: `${GLASS_X_BASE}%`, transform: 'translate(-50%, -50%)', zIndex: 4, pointerEvents: 'none', textAlign: 'center' }}>
          {/* Hit ring (color updated via direct DOM on pointer move) */}
          <div ref={ringRef} style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '96px', height: '96px', borderRadius: '50%',
            border: '2px dashed rgba(255,255,255,0.12)',
            transition: 'border-color .1s, box-shadow .1s',
          }} />
          <div style={{
            fontSize: '82px', lineHeight: 1,
            filter: glassHit ? 'drop-shadow(0 0 50px #FFBE0B) brightness(1.7)' : 'drop-shadow(0 0 15px rgba(255,190,11,0.2))',
            animation: glassHit ? 'glass-wobble .5s ease' : 'glass-float 3.5s ease-in-out infinite',
            transition: 'filter .1s',
          }}>🍷</div>
        </div>

        {/* SVG aim trajectory line (finger → glass current position) */}
        {aim && aim.startY > aim.curY + MIN_SWIPE && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
            <line
              x1={`${aim.curX}%`} y1={`${aim.curY}%`}
              x2={`${glassXRef.current}%`} y2={`${GLASS_Y}%`}
              stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="8 6"
            />
          </svg>
        )}

        {/* Cork following finger */}
        {aim && (
          <div style={{ position: 'absolute', left: `${aim.curX}%`, top: `${aim.curY}%`, transform: 'translate(-50%, -50%)', zIndex: 6, pointerEvents: 'none', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.7))' }}>
            <CorkShape rotate={-25} />
          </div>
        )}

        {/* Flying corks */}
        {corks.map(c => (
          <div key={c.id} style={{ position: 'absolute', left: `${glassXRef.current}%`, top: '92%', transform: 'translate(-50%, -50%)', animation: c.hit ? 'cork-hit 1.8s cubic-bezier(.18,.8,.28,1) forwards' : (c.missRight ? 'cork-miss-r 1.6s cubic-bezier(.18,.8,.28,1) forwards' : 'cork-miss-l 1.6s cubic-bezier(.18,.8,.28,1) forwards'), zIndex: 7, pointerEvents: 'none' }}>
            <CorkShape rotate={-18} />
          </div>
        ))}

        {/* Hit/miss feedback */}
        {result && (
          <div style={{ position: 'absolute', left: '50%', top: '20%', transform: 'translateX(-50%)', fontSize: '18px', fontWeight: '800', whiteSpace: 'nowrap', color: result.type === 'hit' ? '#FFBE0B' : 'rgba(255,255,255,0.5)', textShadow: result.type === 'hit' ? '0 0 24px #FFBE0B, 0 0 50px rgba(255,190,11,0.3)' : 'none', animation: 'result-pop 1.3s ease forwards', zIndex: 8, pointerEvents: 'none' }}>
            {result.type === 'hit' ? '🎯 Dans le verre !' : '💨 Raté !'}
          </div>
        )}

        {/* Idle instruction */}
        {!aim && !throwing && me && (
          <div style={{ position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 4 }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '10px', letterSpacing: '.04em' }}>
              Vise le verre et glisse vers le haut !
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', animation: 'cork-idle 2.2s ease-in-out infinite' }}>
              <CorkShape rotate={-12} />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spot-a  { from { transform: rotate(-32deg); } to { transform: rotate(32deg); } }
        @keyframes spot-b  { from { transform: rotate(26deg);  } to { transform: rotate(-26deg); } }
        @keyframes disco-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sparkle-blink {
          0%, 100% { opacity: 0; transform: scale(0.3); }
          50%       { opacity: 1; transform: scale(1.5); }
        }
        @keyframes glass-float {
          0%, 100% { transform: translateY(0) scale(1); }
          50%       { transform: translateY(-6px) scale(1.03); }
        }
        @keyframes glass-wobble {
          0%   { transform: scale(1) rotate(0deg); }
          18%  { transform: scale(1.35) rotate(-12deg); }
          42%  { transform: scale(1.18) rotate(8deg); }
          64%  { transform: scale(1.08) rotate(-5deg); }
          82%  { transform: scale(1.03) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes cork-hit {
          0%   { transform: translate(-50%,-50%) rotate(0deg)   scale(1);    opacity:1; }
          52%  { transform: translate(-50%,calc(-50% - 54vh)) rotate(210deg) scale(1.3); opacity:1; }
          76%  { transform: translate(-50%,calc(-50% - 47vh)) rotate(330deg) scale(0.8); opacity:0.8; }
          100% { transform: translate(-50%,calc(-50% - 44vh)) rotate(410deg) scale(0.4); opacity:0; }
        }
        @keyframes cork-miss-r {
          0%   { transform: translate(-50%,-50%) rotate(0deg)   scale(1); opacity:1; }
          45%  { transform: translate(-50%,calc(-50% - 45vh)) rotate(165deg) scale(1.05); opacity:1; }
          100% { transform: translate(calc(-50% + 110px),calc(-50% - 27vh)) rotate(340deg) scale(0.45); opacity:0; }
        }
        @keyframes cork-miss-l {
          0%   { transform: translate(-50%,-50%) rotate(0deg)   scale(1); opacity:1; }
          45%  { transform: translate(-50%,calc(-50% - 45vh)) rotate(165deg) scale(1.05); opacity:1; }
          100% { transform: translate(calc(-50% - 110px),calc(-50% - 27vh)) rotate(340deg) scale(0.45); opacity:0; }
        }
        @keyframes result-pop {
          0%   { opacity:0; transform: translateX(-50%) scale(0.6) translateY(14px); }
          22%  { opacity:1; transform: translateX(-50%) scale(1.18) translateY(-5px); }
          65%  { opacity:1; transform: translateX(-50%) scale(1)    translateY(-9px); }
          100% { opacity:0; transform: translateX(-50%) scale(0.9)  translateY(-26px); }
        }
        @keyframes cork-idle {
          0%, 100% { transform: translateY(0) rotate(-12deg); }
          50%       { transform: translateY(-9px) rotate(-4deg); }
        }
      `}</style>
    </div>
  )
}
