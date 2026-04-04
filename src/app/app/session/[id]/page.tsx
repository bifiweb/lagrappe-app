'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { resolveTiebreak } from '@/lib/scoring'
import type { Profile, Session, SessionPlayer } from '@/types'

export default function SessionPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<SessionPlayer[]>([])
  const [phase, setPhase] = useState<'lobby' | 'voting' | 'countdown'>('lobby')
  const [myVote, setMyVote] = useState<string | null>(null)
  const [votesIn, setVotesIn] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)
  const [chef, setChef] = useState<SessionPlayer | null>(null)
  const [countdown, setCountdown] = useState(5)
  const [tiebreakMsg, setTiebreakMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [determiningChef, setDeterminingChef] = useState(false)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const sessionId = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: sess } = await supabase
        .from('sessions').select('*').eq('id', sessionId).single()
      setSession(sess)

      console.log('Session status on load:', sess?.status)

      if (sess?.status === 'voting') setPhase('voting')
      if (sess?.status === 'revealed') {
        router.push(`/app/session/${sessionId}/reveal`)
        return
      }

      const { data: pl } = await supabase
        .from('session_players').select('*').eq('session_id', sessionId)
      setPlayers(pl ?? [])

      const { data: existingVote } = await supabase
        .from('votes').select('*').eq('session_id', sessionId).eq('voter_id', user.id).maybeSingle()
      if (existingVote) setHasVoted(true)

      const { count } = await supabase
        .from('votes').select('*', { count: 'exact', head: true }).eq('session_id', sessionId)
      setVotesIn(count ?? 0)

      setLoading(false)
    }
    load()
  }, [])

  // Polling lobby
  useEffect(() => {
    if (!sessionId || phase !== 'lobby') return
    console.log('Starting lobby polling')
    const interval = setInterval(async () => {
      const { data: pl } = await supabase
        .from('session_players').select('*').eq('session_id', sessionId)
      setPlayers(pl ?? [])

      const { data: sess } = await supabase
        .from('sessions').select('*').eq('id', sessionId).single()
      console.log('Lobby polling - session status:', sess?.status)
      if (sess?.status === 'voting') {
        console.log('Switching to voting phase!')
        setPhase('voting')
        clearInterval(interval)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [sessionId, phase])

  // Polling votes
  useEffect(() => {
    if (!sessionId || phase !== 'voting' || determiningChef) return
    console.log('Starting vote polling')
    const interval = setInterval(async () => {
      const { count } = await supabase
        .from('votes').select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
      const newCount = count ?? 0
      setVotesIn(newCount)

      const { data: pl } = await supabase
        .from('session_players').select('*').eq('session_id', sessionId)
      const currentPlayers = pl ?? []
      setPlayers(currentPlayers)

      console.log('Vote polling:', newCount, '/', currentPlayers.length)

      if (newCount >= currentPlayers.length && currentPlayers.length > 0) {
        console.log('All votes in! Determining chef...')
        clearInterval(interval)
        setDeterminingChef(true)
        await determineChef(currentPlayers)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [sessionId, phase, determiningChef])

  async function launchVote() {
    await supabase.from('sessions')
      .update({ status: 'voting' })
      .eq('id', sessionId)
    setPhase('voting')
  }

  async function submitVote() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || hasVoted) return

    if (players.length === 1) {
      const soloPlayer = players[0]
      setChef(soloPlayer)
      await supabase.from('session_players')
        .update({ is_chef: true })
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
      setPhase('countdown')
      startCountdown()
      return
    }

    if (!myVote) return

    const { error } = await supabase.from('votes').insert({
      session_id: sessionId,
      voter_id: user.id,
      voted_for: myVote,
    })

    if (!error) setHasVoted(true)
  }

  async function determineChef(currentPlayers: SessionPlayer[]) {
    const { data: votes } = await supabase
      .from('votes').select('voted_for').eq('session_id', sessionId)

    if (!votes || votes.length === 0) return

    const tally: Record<string, number> = {}
    votes.forEach(v => { tally[v.voted_for] = (tally[v.voted_for] || 0) + 1 })

    const maxVotes = Math.max(...Object.values(tally))
    const winners = Object.entries(tally)
      .filter(([, v]) => v === maxVotes).map(([id]) => id)

    let chefId = winners[0]

    if (winners.length > 1) {
      const winnerPlayers = currentPlayers.filter(p => winners.includes(p.user_id))
      const names = winnerPlayers.map(p => p.pseudo)
      const result = resolveTiebreak(names)
      const winnerPlayer = winnerPlayers.find(p => p.pseudo === result.winner)
      chefId = winnerPlayer?.user_id ?? winners[0]
      setTiebreakMsg(result.reason)
    }

    const chefPlayer = currentPlayers.find(p => p.user_id === chefId)
    setChef(chefPlayer ?? null)

    await supabase.from('session_players')
      .update({ is_chef: true })
      .eq('session_id', sessionId)
      .eq('user_id', chefId)

    setPhase('countdown')
    startCountdown()
  }

  function startCountdown() {
    let n = 5
    setCountdown(5)
    const interval = setInterval(() => {
      n--
      setCountdown(n)
      if (n <= 0) {
        clearInterval(interval)
        router.push(`/app/tasting/${sessionId}`)
      }
    }, 1000)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#8d323b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px' }}>🍷</span>
          </div>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>
            Bouteille #{session?.bottle_number}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* LOBBY */}
        {phase === 'lobby' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>Lobby</div>
              <div style={{ fontSize: '13px', color: '#888' }}>
                {players.length} joueur{players.length > 1 ? 's' : ''} connecté{players.length > 1 ? 's' : ''}
              </div>
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              {players.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '0.5px solid #f0f0f0' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '500', color: '#8d323b' }}>
                    {p.pseudo[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>{p.pseudo}</div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B6D11' }}></div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>Partage ce lien à tes amis</div>
              <div style={{ fontSize: '12px', color: '#8d323b', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {typeof window !== 'undefined' ? `${window.location.origin}/app/session/${sessionId}/join` : ''}
              </div>
            </div>

            <button onClick={launchVote}
              style={{ width: '100%', padding: '14px', background: '#8d323b', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
              Lancer le vote du chef →
            </button>
          </>
        )}

        {/* VOTE */}
        {phase === 'voting' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>Qui sera le chef ?</div>
              <div style={{ fontSize: '13px', color: '#888' }}>Le chef lancera la révélation du vin mystère</div>
            </div>

            {hasVoted ? (
              <div style={{ background: '#e8f0e8', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center', fontSize: '14px', color: '#27500A' }}>
                ✓ Vote enregistré — en attente des autres joueurs...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
                {players.filter(p => p.user_id !== profile?.id).map(p => (
                  <div key={p.id}
                    onClick={() => setMyVote(p.user_id)}
                    style={{
                      background: '#fff',
                      border: myVote === p.user_id ? '2px solid #8d323b' : '0.5px solid #e0e0e0',
                      borderRadius: '12px', padding: '1rem',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '500', color: '#8d323b' }}>
                      {p.pseudo[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>{p.pseudo}</div>
                    {myVote === p.user_id && <div style={{ color: '#8d323b', fontSize: '18px' }}>✓</div>}
                  </div>
                ))}
              </div>
            )}

            {tiebreakMsg && (
              <div style={{ background: '#faeeda', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontSize: '13px', color: '#633806', fontStyle: 'italic' }}>
                🎲 Égalité ! {tiebreakMsg}
              </div>
            )}

            {!hasVoted && (
              <button onClick={submitVote}
                disabled={!myVote && players.length > 1}
                style={{
                  width: '100%', padding: '14px',
                  background: (!myVote && players.length > 1) ? '#c0a0a0' : '#8d323b',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '15px', fontWeight: '500',
                  cursor: (!myVote && players.length > 1) ? 'default' : 'pointer'
                }}>
                {players.length === 1 ? 'Je suis le chef, on commence ! →' : 'Confirmer mon vote'}
              </button>
            )}

            <div style={{ textAlign: 'center', fontSize: '12px', color: '#aaa', marginTop: '1rem' }}>
              {votesIn} / {players.length} votes
            </div>
          </>
        )}

        {/* COUNTDOWN */}
        {phase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: '14px', color: '#888', marginBottom: '1rem' }}>
              {chef?.pseudo} lance la dégustation !
            </div>
            <div style={{ fontSize: '80px', fontWeight: '500', color: '#8d323b', lineHeight: 1 }}>
              {countdown <= 0 ? '🍷' : countdown}
            </div>
            <div style={{ fontSize: '14px', color: '#888', marginTop: '1rem' }}>
              La dégustation commence...
            </div>
          </div>
        )}

      </div>
    </div>
  )
}