'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Evening, Session, SessionPlayer, Wine } from '@/types'

type LeaderboardEntry = {
  user_id: string
  pseudo: string
  avatar: string | null
  is_chef: boolean
  total_points: number
  points_this_bottle: number
  per_bottle: number[]
  current_rank: number
  prev_rank: number
  rank_change: number
}

const RANK_MEDALS = ['🥇', '🥈', '🥉']
const CARD_SLOT = 80 // px per rank slot (card ~68px tall + 12px gap)

type AnimPhase = 'hidden' | 'prev' | 'current'

export default function EveningLeaderboardPage() {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [evening, setEvening] = useState<Evening | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [phase, setPhase] = useState<AnimPhase>('hidden')

  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const eveningId = params.id as string
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push('/auth/login'); return }
      setUser(u)

      const { data: ev } = await supabase.from('evenings').select('*').eq('id', eveningId).single()
      setEvening(ev)

      if (!ev) { setLoading(false); return }

      const { data: allSessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('evening_id', eveningId)
        .order('order_in_evening')
      setSessions(allSessions ?? [])

      const { data: wineData } = await supabase
        .from('wines')
        .select('*')
        .in('id', ev.bottle_order as unknown as string[])
      setWines(wineData ?? [])

      if (allSessions && allSessions.length > 0) {
        const sessionIds = allSessions.map((s: Session) => s.id)
        const { data: allPlayers } = await supabase
          .from('session_players')
          .select('*')
          .in('session_id', sessionIds)

        setLeaderboard(buildLeaderboard(allSessions, allPlayers ?? []))
      }

      const completedCount = (allSessions ?? []).filter(s => s.status === 'revealed').length
      setLoading(false)

      if (completedCount > 1) {
        // Phase 1: cards appear at previous rank positions
        setTimeout(() => setPhase('prev'), 120)
        // Phase 2: cards animate to current rank positions
        setTimeout(() => setPhase('current'), 1500)
      } else {
        // First bottle — no prev rank to show, just reveal at current
        setTimeout(() => setPhase('current'), 120)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!eveningId) return

    const channel = supabase.channel(`evening:${eveningId}`)
    channel
      .on('broadcast', { event: 'next_session' }, ({ payload }) => {
        router.push(`/app/session/${payload.sessionId}`)
      })
      .on('broadcast', { event: 'finale' }, () => {
        router.push(`/app/evening/${eveningId}/finale`)
      })
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [eveningId])

  function buildLeaderboard(allSessions: Session[], allPlayers: SessionPlayer[]): LeaderboardEntry[] {
    const completedSessions = allSessions.filter(s => s.status === 'revealed')
    const currentSession = completedSessions[completedSessions.length - 1]
    const prevSessions = completedSessions.slice(0, -1)

    const byUser: Record<string, LeaderboardEntry> = {}

    const currentPlayers = allPlayers.filter(p => p.session_id === currentSession?.id)
    for (const p of currentPlayers) {
      byUser[p.user_id] = {
        user_id: p.user_id,
        pseudo: p.pseudo,
        avatar: p.avatar,
        is_chef: p.is_chef,
        total_points: p.points_evening ?? 0,
        points_this_bottle: p.points_session ?? 0,
        per_bottle: [],
        current_rank: 0,
        prev_rank: 0,
        rank_change: 0,
      }
    }

    for (const sess of completedSessions) {
      const sessPlayers = allPlayers.filter(p => p.session_id === sess.id)
      for (const p of sessPlayers) {
        if (byUser[p.user_id]) byUser[p.user_id].per_bottle.push(p.points_session ?? 0)
      }
    }

    const entries = Object.values(byUser)

    const sorted = [...entries].sort((a, b) => b.total_points - a.total_points)
    sorted.forEach((e, i) => { e.current_rank = i + 1 })

    const prevTotals: Record<string, number> = {}
    for (const sess of prevSessions) {
      const sessPlayers = allPlayers.filter(p => p.session_id === sess.id)
      for (const p of sessPlayers) {
        prevTotals[p.user_id] = (prevTotals[p.user_id] ?? 0) + (p.points_session ?? 0)
      }
    }

    const prevSorted = [...entries].sort((a, b) => (prevTotals[b.user_id] ?? 0) - (prevTotals[a.user_id] ?? 0))
    prevSorted.forEach((e, i) => { e.prev_rank = i + 1 })

    for (const e of entries) e.rank_change = e.prev_rank - e.current_rank

    return sorted
  }

  async function createNextSession() {
    if (!evening || !sessions.length) return
    setCreating(true)

    const completedSessions = sessions.filter(s => s.status === 'revealed')
    const lastSession = completedSessions[completedSessions.length - 1]
    const nextOrder = (lastSession?.order_in_evening ?? 0) + 1
    const bottleOrder = evening.bottle_order as unknown as string[]
    const nextWineId = bottleOrder[nextOrder - 1]

    if (!nextWineId) { setCreating(false); return }
    const nextWine = wines.find(w => w.id === nextWineId)
    if (!nextWine) { setCreating(false); return }

    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({
        project_id: lastSession.project_id,
        wine_id: nextWineId,
        bottle_number: nextWine.bottle_number,
        evening_id: eveningId,
        order_in_evening: nextOrder,
        status: 'lobby',
      })
      .select().single()

    if (error || !newSession) { setCreating(false); return }

    const { data: prevPlayers } = await supabase
      .from('session_players').select('*').eq('session_id', lastSession.id)

    const chefPlayer = prevPlayers?.find(p => p.is_chef)

    const newPlayers = (prevPlayers ?? []).map(p => ({
      session_id: newSession.id,
      user_id: p.user_id,
      pseudo: p.pseudo,
      avatar: p.avatar,
      is_chef: p.user_id === chefPlayer?.user_id,
      evening_id: eveningId,
      tasting_done: false,
      points_session: 0,
      points_evening: p.points_evening,
    }))

    await supabase.from('session_players').insert(newPlayers)

    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'next_session',
        payload: { sessionId: newSession.id },
      })
    }

    router.push(`/app/session/${newSession.id}`)
    setCreating(false)
  }

  async function goToFinale() {
    if (channelRef.current) {
      await channelRef.current.send({ type: 'broadcast', event: 'finale', payload: {} })
    }
    router.push(`/app/evening/${eveningId}/finale`)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Calcul des scores...</div>
    </div>
  )

  const completedSessions = sessions.filter(s => s.status === 'revealed')
  const currentSessionOrder = completedSessions.length
  const totalBottles = (evening?.bottle_order as unknown as string[])?.length ?? 0
  const isLastBottle = currentSessionOrder >= totalBottles
  const isOrganizer = evening?.chef_id === user?.id
  const progressPct = (currentSessionOrder / totalBottles) * 100
  const showRankChange = completedSessions.length > 1

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#6B4FAE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>🏆</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>Classement</div>
            <div style={{ fontSize: '11px', color: '#6B4FAE', fontWeight: '500' }}>
              Bouteille {currentSessionOrder}/{totalBottles} terminée
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Progress bar */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '500', color: '#1a1a1a' }}>Progression de la soirée</span>
            <span style={{ fontSize: '12px', color: '#6B4FAE', fontWeight: '600' }}>{currentSessionOrder}/{totalBottles}</span>
          </div>
          <div style={{ height: '8px', background: '#f0edf8', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: '#6B4FAE', borderRadius: '4px', transition: 'width 1s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Array.from({ length: totalBottles }).map((_, i) => {
              const done = i < currentSessionOrder
              const current = i === currentSessionOrder - 1
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: done ? '#edeaf8' : '#f5f5f5',
                  borderRadius: '8px', padding: '4px 8px',
                  border: current ? '1.5px solid #6B4FAE' : '0.5px solid #e0e0e0',
                }}>
                  <span style={{ fontSize: '12px' }}>{done ? '✓' : '○'}</span>
                  <span style={{ fontSize: '11px', fontWeight: done ? '600' : '400', color: done ? '#6B4FAE' : '#bbb' }}>
                    #{wines.find(w => w.id === (evening?.bottle_order as unknown as string[])?.[i])?.bottle_number ?? (i + 1)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Leaderboard — absolute-position animated cards */}
        <div style={{
          position: 'relative',
          height: `${leaderboard.length * CARD_SLOT}px`,
          marginBottom: '1.25rem',
        }}>
          {leaderboard.map((entry) => {
            const displayRank = phase === 'current' ? entry.current_rank : entry.prev_rank
            const topPx = (displayRank - 1) * CARD_SLOT
            const isMe = entry.user_id === user?.id
            const medal = entry.current_rank <= 3 ? RANK_MEDALS[entry.current_rank - 1] : null

            const changeAbs = Math.abs(entry.rank_change)
            const wentUp = entry.rank_change > 0
            const wentDown = entry.rank_change < 0
            const changeLabel = wentUp ? `↑${changeAbs}` : wentDown ? `↓${changeAbs}` : null
            const changePillColor = wentUp ? '#27a348' : '#c0392b'
            const changePillBg = wentUp ? '#dcf5e4' : '#fde8e8'

            return (
              <div key={entry.user_id} style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${topPx}px`,
                transition: 'top 0.7s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease',
                opacity: phase === 'hidden' ? 0 : 1,
                background: isMe ? '#edeaf8' : '#fff',
                border: isMe ? '1.5px solid #c5b8f0' : '0.5px solid #e0e0e0',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>

                {/* Rank badge */}
                <div style={{ width: '32px', textAlign: 'center', flexShrink: 0 }}>
                  {medal
                    ? <span style={{ fontSize: '22px' }}>{medal}</span>
                    : <span style={{ fontSize: '16px', fontWeight: '700', color: '#888' }}>{entry.current_rank}</span>
                  }
                </div>

                {/* Avatar + name + per-bottle */}
                <PlayerAvatar avatar={entry.avatar} pseudo={entry.pseudo} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.pseudo}{isMe ? ' (moi)' : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                    {entry.per_bottle.map((pts, i) => (
                      <span key={i} style={{ marginRight: '6px' }}>
                        🍾{i + 1}: <strong style={{ color: pts > 0 ? '#27a348' : pts < 0 ? '#c0392b' : '#888' }}>
                          {pts > 0 ? '+' : ''}{pts.toLocaleString()}
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Score + rank change pill */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#6B4FAE' }}>
                    {entry.total_points.toLocaleString()}
                  </div>
                  {entry.points_this_bottle !== 0 && (
                    <div style={{ fontSize: '11px', color: entry.points_this_bottle > 0 ? '#27a348' : '#c0392b', fontWeight: '600' }}>
                      {entry.points_this_bottle > 0 ? '+' : ''}{entry.points_this_bottle.toLocaleString()}
                    </div>
                  )}
                  {showRankChange && changeLabel && (
                    <div style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: changePillBg,
                      color: changePillColor,
                      fontSize: '12px',
                      fontWeight: '700',
                    }}>
                      {changeLabel}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Action buttons */}
        {isOrganizer ? (
          isLastBottle ? (
            <button onClick={goToFinale}
              style={{ width: '100%', padding: '14px', background: '#6B4FAE', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
              Voir le podium final 🏆
            </button>
          ) : (
            <button onClick={createNextSession} disabled={creating}
              style={{ width: '100%', padding: '14px', background: creating ? '#a08ab8' : '#6B4FAE', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: creating ? 'default' : 'pointer' }}>
              {creating ? 'Préparation...' : `Bouteille ${currentSessionOrder + 1}/${totalBottles} →`}
            </button>
          )
        ) : (
          <div style={{ background: '#f0f4ff', border: '0.5px solid #c0ccee', borderRadius: '12px', padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#3C3489', fontWeight: '500' }}>
              {isLastBottle ? '🏆 En attente du podium...' : '⏳ En attente de la prochaine bouteille...'}
            </div>
            <div style={{ fontSize: '12px', color: '#534AB7', marginTop: '4px' }}>
              L'organisateur va lancer {isLastBottle ? 'le podium final' : 'la suite'}
            </div>
          </div>
        )}

        {!isOrganizer && isLastBottle && (
          <button onClick={() => router.push(`/app/evening/${eveningId}/finale`)}
            style={{ width: '100%', marginTop: '8px', padding: '12px', border: '0.5px solid #c5b8f0', borderRadius: '12px', background: '#fff', color: '#6B4FAE', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
            Voir le podium →
          </button>
        )}

        <button onClick={() => router.push('/app/dashboard')}
          style={{ width: '100%', marginTop: '8px', padding: '12px', border: '0.5px solid #e0e0e0', borderRadius: '12px', background: '#fff', color: '#aaa', fontSize: '13px', cursor: 'pointer' }}>
          Retour au dashboard
        </button>

      </div>
    </div>
  )
}
