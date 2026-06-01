'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Evening, Session, SessionPlayer, Wine } from '@/types'

type FinalEntry = {
  user_id: string
  pseudo: string
  avatar: string | null
  total_points: number
  per_bottle: number[]
}

const CONFETTI_COLORS = ['#6B4FAE', '#8d323b', '#f5c518', '#27a348', '#3b82f6', '#ec4899']
const CONFETTI_COUNT = 40

export default function EveningFinalePage() {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [evening, setEvening] = useState<Evening | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [leaderboard, setLeaderboard] = useState<FinalEntry[]>([])
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)
  const [showPodium, setShowPodium] = useState(false)

  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const eveningId = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push('/auth/login'); return }
      setUser(u)

      const { data: ev } = await supabase.from('evenings').select('*').eq('id', eveningId).single()
      setEvening(ev)

      if (!ev) { setLoading(false); return }

      const { data: allSessions } = await supabase
        .from('sessions').select('*').eq('evening_id', eveningId).order('order_in_evening')
      setSessions(allSessions ?? [])

      const { data: wineData } = await supabase
        .from('wines').select('*').in('id', ev.bottle_order as unknown as string[])
      setWines(wineData ?? [])

      if (allSessions?.length) {
        const sessionIds = allSessions.map((s: Session) => s.id)
        const { data: allPlayers } = await supabase
          .from('session_players').select('*').in('session_id', sessionIds)

        const byUser: Record<string, FinalEntry> = {}
        const completedSessions = allSessions.filter(s => s.status === 'revealed')

        // Use the last completed session's points_evening for total
        const lastSession = completedSessions[completedSessions.length - 1]
        const lastPlayers = allPlayers?.filter(p => p.session_id === lastSession?.id) ?? []

        for (const p of lastPlayers) {
          byUser[p.user_id] = {
            user_id: p.user_id,
            pseudo: p.pseudo,
            avatar: p.avatar,
            total_points: p.points_evening ?? 0,
            per_bottle: [],
          }
        }

        // Fill per_bottle
        for (const sess of completedSessions) {
          const sessPlayers = allPlayers?.filter(p => p.session_id === sess.id) ?? []
          for (const p of sessPlayers) {
            if (byUser[p.user_id]) {
              byUser[p.user_id].per_bottle.push(p.points_session ?? 0)
            }
          }
        }

        const sorted = Object.values(byUser).sort((a, b) => b.total_points - a.total_points)
        setLeaderboard(sorted)
      }

      setLoading(false)
      setTimeout(() => setShowPodium(true), 300)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement du podium...</div>
    </div>
  )

  const bottleOrder = (evening?.bottle_order as unknown as string[]) ?? []
  const completedSessions = sessions.filter(s => s.status === 'revealed')
  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)

  const podiumOrder = top3.length >= 2
    ? [top3[1], top3[0], top3[2]].filter(Boolean)
    : top3
  const podiumHeights = [100, 140, 80]
  const podiumColorsBg = ['#e8e4f8', '#f5c518', '#f0ede8']
  const podiumColorsText = ['#6B4FAE', '#8a6900', '#7a5a3a']
  const podiumLabels = ['2ème', '1er', '3ème']

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative' }}>

      {/* Confetti */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
          const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
          const left = `${(i * 37 + 5) % 100}%`
          const size = 6 + (i % 5)
          const delay = `${(i * 0.13) % 3}s`
          const dur = `${2.5 + (i % 3) * 0.7}s`
          return (
            <div key={i} style={{
              position: 'absolute',
              left,
              top: '-10px',
              width: `${size}px`,
              height: `${size}px`,
              background: color,
              borderRadius: i % 2 === 0 ? '50%' : '2px',
              animation: `confettiFall ${dur} ${delay} ease-in infinite`,
              opacity: showPodium ? 0.85 : 0,
              transition: 'opacity 0.5s',
              transform: `rotate(${i * 30}deg)`,
            }} />
          )
        })}
      </div>

      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-10px) rotate(0deg); }
          100% { transform: translateY(110vh) rotate(720deg); }
        }
        @keyframes podiumRise {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f5c518', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🏆</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>Soirée terminée !</div>
            <div style={{ fontSize: '11px', color: '#888' }}>{completedSessions.length} bouteilles dégustées</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem', position: 'relative', zIndex: 1 }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 6px' }}>Bravo à tous !</h1>
          <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
            {leaderboard[0]?.pseudo} remporte la soirée avec {leaderboard[0]?.total_points.toLocaleString()} pts
          </p>
        </div>

        {/* Podium */}
        {top3.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', height: '220px' }}>
              {podiumOrder.map((entry, i) => {
                const rank = top3.indexOf(entry)
                const height = podiumHeights[i]
                const bgColor = podiumColorsBg[i]
                const textColor = podiumColorsText[i]
                const label = podiumLabels[i]
                const isMe = entry?.user_id === user?.id
                return (
                  <div key={entry?.user_id ?? i} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    animation: showPodium ? `podiumRise 0.6s ease ${i * 0.15}s forwards` : 'none',
                    opacity: showPodium ? undefined : 0,
                    flex: 1, maxWidth: '160px',
                  }}>
                    <div style={{ marginBottom: '8px', textAlign: 'center' }}>
                      {['🥇', '🥈', '🥉'][rank] && <div style={{ fontSize: '28px' }}>{['🥇', '🥈', '🥉'][rank]}</div>}
                      <PlayerAvatar avatar={entry?.avatar ?? null} pseudo={entry?.pseudo ?? ''} size={rank === 0 ? 48 : 38} />
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#1a1a1a', marginTop: '4px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry?.pseudo}{isMe ? ' 🫵' : ''}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: textColor }}>
                        {entry?.total_points.toLocaleString()}
                      </div>
                    </div>
                    <div style={{
                      width: '100%',
                      height: `${height}px`,
                      background: bgColor,
                      borderRadius: '10px 10px 0 0',
                      border: `0.5px solid ${isMe ? '#6B4FAE' : '#e0e0e0'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: textColor }}>{label}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ height: '8px', background: '#e0e0e0', borderRadius: '0 0 8px 8px', width: '100%' }} />
          </div>
        )}

        {/* Reste du classement */}
        {rest.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            {rest.map((entry, i) => (
              <div key={entry.user_id} style={{
                background: entry.user_id === user?.id ? '#edeaf8' : '#fff',
                border: entry.user_id === user?.id ? '1.5px solid #c5b8f0' : '0.5px solid #e0e0e0',
                borderRadius: '12px', padding: '12px 14px', marginBottom: '6px',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#888', width: '24px', textAlign: 'center' }}>{i + 4}</div>
                <PlayerAvatar avatar={entry.avatar} pseudo={entry.pseudo} size={32} />
                <div style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>
                  {entry.pseudo}{entry.user_id === user?.id ? ' (moi)' : ''}
                </div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#6B4FAE' }}>
                  {entry.total_points.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Détail par bouteille */}
        {completedSessions.length > 0 && leaderboard.length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '12px' }}>
              Détail par bouteille
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#888', fontWeight: '500' }}>Joueur</th>
                  {completedSessions.map((sess, i) => (
                    <th key={sess.id} style={{ textAlign: 'center', padding: '4px 6px', color: '#888', fontWeight: '500', minWidth: '48px' }}>
                      🍾{i + 1}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '4px 6px', color: '#6B4FAE', fontWeight: '600' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, rank) => (
                  <tr key={entry.user_id} style={{ borderTop: '0.5px solid #f5f5f5' }}>
                    <td style={{ padding: '6px 6px', fontWeight: '500', color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                      {rank < 3 && <span style={{ marginRight: '4px' }}>{['🥇', '🥈', '🥉'][rank]}</span>}
                      {entry.pseudo}
                    </td>
                    {entry.per_bottle.map((pts, i) => (
                      <td key={i} style={{ textAlign: 'center', padding: '6px', color: pts > 0 ? '#27a348' : '#c0392b', fontWeight: '500' }}>
                        {pts > 0 ? '+' : ''}{pts.toLocaleString()}
                      </td>
                    ))}
                    {/* Fill empty cells if this player missed a session */}
                    {Array.from({ length: completedSessions.length - entry.per_bottle.length }).map((_, i) => (
                      <td key={`empty-${i}`} style={{ textAlign: 'center', color: '#ccc' }}>—</td>
                    ))}
                    <td style={{ textAlign: 'right', padding: '6px', fontWeight: '700', color: '#6B4FAE' }}>
                      {entry.total_points.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={() => router.push('/app/dashboard')}
          style={{ width: '100%', padding: '14px', background: '#6B4FAE', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: 'pointer', marginBottom: '8px' }}>
          Retour au dashboard
        </button>

      </div>
    </div>
  )
}
