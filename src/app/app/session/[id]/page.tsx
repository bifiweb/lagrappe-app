'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import type { Profile, Session, SessionPlayer } from '@/types'

type ChifoumiMove = 'pierre' | 'feuille' | 'ciseaux'
const CHIFOUMI_EMOJI: Record<ChifoumiMove, string> = { pierre: '✊', feuille: '🖐️', ciseaux: '✌️' }

function getChifoumiWinner(moves: Record<string, ChifoumiMove>, tiedIds: string[]): string | 'tie' {
  if (tiedIds.length !== 2) return tiedIds[0]
  const [a, b] = tiedIds
  const ma = moves[a], mb = moves[b]
  if (ma === mb) return 'tie'
  if (
    (ma === 'pierre' && mb === 'ciseaux') ||
    (ma === 'feuille' && mb === 'pierre') ||
    (ma === 'ciseaux' && mb === 'feuille')
  ) return a
  return b
}

export default function SessionPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<SessionPlayer[]>([])
  const [phase, setPhase] = useState<'lobby' | 'voting' | 'chifoumi' | 'countdown'>('lobby')
  const [myVote, setMyVote] = useState<string | null>(null)
  const [votesIn, setVotesIn] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)
  const [chef, setChef] = useState<SessionPlayer | null>(null)
  const [countdown, setCountdown] = useState(10)
  const [loading, setLoading] = useState(true)
  const [determiningChef, setDeterminingChef] = useState(false)
  const [copied, setCopied] = useState(false)

  // Chifoumi
  const [tiedPlayerIds, setTiedPlayerIds] = useState<string[]>([])
  const [myChifoumiMove, setMyChifoumiMove] = useState<ChifoumiMove | null>(null)
  const [chifoumiMoves, setChifoumiMoves] = useState<Record<string, ChifoumiMove>>({})
  const [chifoumiRound, setChifoumiRound] = useState(1)
  const [chifoumiResult, setChifoumiResult] = useState<string | null>(null)

  // Refs pour les callbacks broadcast (évite les closures périmées)
  const tiedPlayerIdsRef = useRef<string[]>([])
  const chifoumiMovesRef = useRef<Record<string, ChifoumiMove>>({})
  const chifoumiRoundRef = useRef(1)
  const currentPlayersRef = useRef<SessionPlayer[]>([])
  const chifoumiChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const chifoumiResolvedRef = useRef(false) // garde anti-double-résolution

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

      if (sess?.status === 'voting') setPhase('voting')
      if (sess?.status === 'tasting') {
        router.push(`/app/tasting/${sessionId}`)
        return
      }
      if (sess?.status === 'revealed') {
        router.push(`/app/session/${sessionId}/reveal`)
        return
      }

      const { data: pl } = await supabase
        .from('session_players').select('*').eq('session_id', sessionId)
      setPlayers(pl ?? [])
      currentPlayersRef.current = pl ?? []

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
    const interval = setInterval(async () => {
      const { data: pl } = await supabase
        .from('session_players').select('*').eq('session_id', sessionId)
      setPlayers(pl ?? [])
      currentPlayersRef.current = pl ?? []

      const { data: sess } = await supabase
        .from('sessions').select('*').eq('id', sessionId).single()
      if (sess?.status === 'voting') {
        setPhase('voting')
        clearInterval(interval)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [sessionId, phase])

  // Polling votes
  useEffect(() => {
    if (!sessionId || phase !== 'voting' || determiningChef) return
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
      currentPlayersRef.current = currentPlayers

      const { data: sess } = await supabase
        .from('sessions').select('*').eq('id', sessionId).single()
      if (sess?.status === 'countdown') {
        const chefPlayer = currentPlayers.find(p => p.is_chef)
        if (chefPlayer) {
          setChef(chefPlayer)
          setPhase('countdown')
          clearInterval(interval)
          startCountdown()
        }
        return
      }

      if (newCount >= currentPlayers.length && currentPlayers.length > 0) {
        clearInterval(interval)
        setDeterminingChef(true)
        await determineChef(currentPlayers)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [sessionId, phase, determiningChef])

  // Résolution chifoumi — appelée depuis le broadcast ET depuis submitChifoumiMove
  function resolveChifoumi(moves: Record<string, ChifoumiMove>, ids: string[]) {
    if (chifoumiResolvedRef.current) return
    const allMoved = ids.every(id => moves[id])
    if (!allMoved) return
    chifoumiResolvedRef.current = true

    const winnerId = getChifoumiWinner(moves, ids)

    if (winnerId === 'tie') {
      setChifoumiResult('Égalité ! Nouvelle manche...')
      setTimeout(() => {
        chifoumiResolvedRef.current = false
        chifoumiRoundRef.current += 1
        chifoumiMovesRef.current = {}
        setChifoumiMoves({})
        setMyChifoumiMove(null)
        setChifoumiRound(r => r + 1)
        setChifoumiResult(null)
      }, 1800)
    } else {
      const winnerPlayer = currentPlayersRef.current.find(p => p.user_id === winnerId)
      const loserIds = ids.filter(id => id !== winnerId)
      const winMove = moves[winnerId]
      const loseMove = moves[loserIds[0]]
      setChifoumiResult(`${CHIFOUMI_EMOJI[winMove]} bat ${CHIFOUMI_EMOJI[loseMove]} — ${winnerPlayer?.pseudo} est le chef !`)
      // Seul le premier tied player écrit en DB pour éviter les doublons
      if (profile?.id === ids[0]) {
        setTimeout(async () => {
          await supabase.from('session_players').update({ is_chef: false }).eq('session_id', sessionId)
          await supabase.from('session_players').update({ is_chef: true }).eq('session_id', sessionId).eq('user_id', winnerId)
          await supabase.from('sessions').update({ status: 'countdown' }).eq('id', sessionId)
        }, 1500)
      }
      setTimeout(() => {
        setChef(winnerPlayer ?? null)
        setPhase('countdown')
        startCountdown()
      }, 2200)
    }
  }

  // Setup canal chifoumi via Realtime Broadcast
  useEffect(() => {
    if (phase !== 'chifoumi' || !profile) return

    // Nettoyage canal précédent si re-manche
    if (chifoumiChannelRef.current) {
      supabase.removeChannel(chifoumiChannelRef.current)
    }

    const channel = supabase.channel(`chifoumi-${sessionId}-r${chifoumiRoundRef.current}`)

    channel.on('broadcast', { event: 'move' }, ({ payload }: { payload: { userId: string; move: ChifoumiMove; round: number } }) => {
      if (payload.round !== chifoumiRoundRef.current) return
      chifoumiMovesRef.current = { ...chifoumiMovesRef.current, [payload.userId]: payload.move }
      setChifoumiMoves({ ...chifoumiMovesRef.current })
      resolveChifoumi(chifoumiMovesRef.current, tiedPlayerIdsRef.current)
    })

    channel.subscribe()
    chifoumiChannelRef.current = channel

    return () => { supabase.removeChannel(channel) }
  }, [phase, chifoumiRound, profile])

  async function launchVote() {
    await supabase.from('sessions')
      .update({ status: 'voting' })
      .eq('id', sessionId)
    setPhase('voting')
  }

  function getShareUrl() {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/app/session/${sessionId}/join`
  }

  async function copyLink() {
    await navigator.clipboard.writeText(getShareUrl())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareLink() {
    const url = getShareUrl()
    if (navigator.share) {
      navigator.share({ title: 'La Grappe — Dégustation à l\'aveugle', text: 'Rejoins ma session de dégustation !', url })
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`Rejoins ma session de dégustation La Grappe ! ${url}`)}`, '_blank')
    }
  }

  async function submitVote() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || hasVoted) return

    if (players.length === 1) {
      const soloPlayer = players[0]
      setChef(soloPlayer)
      await supabase.from('session_players').update({ is_chef: false }).eq('session_id', sessionId)
      await supabase.from('session_players').update({ is_chef: true }).eq('session_id', sessionId).eq('user_id', user.id)
      await supabase.from('sessions').update({ status: 'countdown' }).eq('id', sessionId)
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

    if (!error) {
      setHasVoted(true)
      setTimeout(async () => {
        const { count } = await supabase
          .from('votes').select('*', { count: 'exact', head: true }).eq('session_id', sessionId)
        const newCount = count ?? 0
        setVotesIn(newCount)

        const { data: pl } = await supabase.from('session_players').select('*').eq('session_id', sessionId)
        const currentPlayers = pl ?? []
        currentPlayersRef.current = currentPlayers

        if (newCount >= currentPlayers.length && currentPlayers.length > 0) {
          setDeterminingChef(true)
          await determineChef(currentPlayers)
        }
      }, 1000)
    }
  }

  async function determineChef(currentPlayers: SessionPlayer[]) {
    const { data: votes } = await supabase.from('votes').select('voted_for').eq('session_id', sessionId)
    if (!votes || votes.length === 0) return

    const tally: Record<string, number> = {}
    votes.forEach(v => { tally[v.voted_for] = (tally[v.voted_for] || 0) + 1 })

    const maxVotes = Math.max(...Object.values(tally))
    const winners = Object.entries(tally).filter(([, v]) => v === maxVotes).map(([id]) => id)

    if (winners.length > 1) {
      // Égalité → chifoumi !
      tiedPlayerIdsRef.current = winners
      chifoumiMovesRef.current = {}
      chifoumiRoundRef.current = 1
      setTiedPlayerIds(winners)
      setChifoumiMoves({})
      setChifoumiRound(1)
      setMyChifoumiMove(null)
      setPhase('chifoumi')
      return
    }

    await assignChef(winners[0], currentPlayers)
  }

  async function assignChef(chefId: string, currentPlayers: SessionPlayer[]) {
    const chefPlayer = currentPlayers.find(p => p.user_id === chefId)
    setChef(chefPlayer ?? null)
    await supabase.from('session_players').update({ is_chef: false }).eq('session_id', sessionId)
    await supabase.from('session_players').update({ is_chef: true }).eq('session_id', sessionId).eq('user_id', chefId)
    await supabase.from('sessions').update({ status: 'countdown' }).eq('id', sessionId)
    setPhase('countdown')
    startCountdown()
  }

  async function submitChifoumiMove(move: ChifoumiMove) {
    if (myChifoumiMove || !profile) return
    setMyChifoumiMove(move)
    // Ajouter son propre coup localement (le broadcast ne revient pas à l'émetteur)
    chifoumiMovesRef.current = { ...chifoumiMovesRef.current, [profile.id]: move }
    setChifoumiMoves({ ...chifoumiMovesRef.current })
    // Vérifier immédiatement si tous ont joué (cas où l'adversaire a déjà broadcasté)
    resolveChifoumi(chifoumiMovesRef.current, tiedPlayerIdsRef.current)
    chifoumiChannelRef.current?.send({
      type: 'broadcast',
      event: 'move',
      payload: { userId: profile.id, move, round: chifoumiRoundRef.current },
    })
  }

  function startCountdown() {
    let n = 10
    setCountdown(10)
    const interval = setInterval(() => {
      n--
      setCountdown(n)
      if (n <= 0) {
        clearInterval(interval)
        supabase.from('sessions').update({ status: 'tasting' }).eq('id', sessionId)
          .then(() => router.push(`/app/tasting/${sessionId}`))
      }
    }, 1000)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  const amInTiebreak = tiedPlayerIds.includes(profile?.id ?? '')

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
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Invite tes amis à rejoindre</div>
              <div style={{ fontSize: '11px', color: '#8d323b', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '10px' }}>
                {getShareUrl()}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={copyLink}
                  style={{ flex: 1, padding: '9px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: copied ? '#e8f0e8' : '#fff', color: copied ? '#27500A' : '#1a1a1a', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                  {copied ? '✓ Copié !' : '📋 Copier le lien'}
                </button>
                <button onClick={shareLink}
                  style={{ flex: 1, padding: '9px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#1a1a1a', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                  💬 Partager
                </button>
              </div>
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '12px' }}>
                📊 Barème des points
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { emoji: '👁️', label: 'Robe',      pts: '300 si juste · 100 sinon' },
                  { emoji: '👃', label: 'Arômes',    pts: '300 pts × nb joueurs même arôme · +300 si officiel' },
                  { emoji: '👄', label: 'Bouche',    pts: '300 si juste · 100 sinon' },
                  { emoji: '💰', label: 'Prix',      pts: '1 000 si exact · −100/CHF d\'écart' },
                  { emoji: '📅', label: 'Millésime', pts: '400 si juste · 100 sinon' },
                  { emoji: '🍇', label: 'Cépage',    pts: '1 000 si juste · 200 sinon' },
                  { emoji: '📍', label: 'Région',    pts: '1 000 si juste · 200 sinon' },
                  { emoji: '💡', label: 'Aide',      pts: '−100 pts par aide utilisée' },
                ].map(({ emoji, label, pts }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '14px', lineHeight: 1.4, flexShrink: 0 }}>{emoji}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>{label}</span>
                      <span style={{ fontSize: '11px', color: '#888', marginLeft: '6px' }}>{pts}</span>
                    </div>
                  </div>
                ))}
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
                    style={{ background: '#fff', border: myVote === p.user_id ? '2px solid #8d323b' : '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '500', color: '#8d323b' }}>
                      {p.pseudo[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>{p.pseudo}</div>
                    {myVote === p.user_id && <div style={{ color: '#8d323b', fontSize: '18px' }}>✓</div>}
                  </div>
                ))}
              </div>
            )}

            {!hasVoted && (
              <button onClick={submitVote}
                disabled={!myVote && players.length > 1}
                style={{ width: '100%', padding: '14px', background: (!myVote && players.length > 1) ? '#c0a0a0' : '#8d323b', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: (!myVote && players.length > 1) ? 'default' : 'pointer' }}>
                {players.length === 1 ? 'Je suis le chef, on commence ! →' : 'Confirmer mon vote'}
              </button>
            )}

            <div style={{ textAlign: 'center', fontSize: '12px', color: '#aaa', marginTop: '1rem' }}>
              {votesIn} / {players.length} votes
            </div>
          </>
        )}

        {/* CHIFOUMI */}
        {phase === 'chifoumi' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>
              Manche {chifoumiRound}
            </div>
            <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>
              Égalité ! Chifoumi 🤜
            </div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '2rem' }}>
              {amInTiebreak
                ? 'Choisis ton coup pour devenir chef !'
                : `Duel en cours entre ${tiedPlayerIds.map(id => players.find(p => p.user_id === id)?.pseudo).join(' et ')}...`}
            </div>

            {amInTiebreak && !myChifoumiMove && !chifoumiResult && (
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '2rem' }}>
                {(['pierre', 'feuille', 'ciseaux'] as ChifoumiMove[]).map(move => (
                  <button key={move} onClick={() => submitChifoumiMove(move)}
                    style={{ width: '88px', height: '88px', borderRadius: '20px', border: '0.5px solid #e0e0e0', background: '#fff', fontSize: '40px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'all .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.border = '2px solid #8d323b'; e.currentTarget.style.background = '#f5ede8' }}
                    onMouseLeave={e => { e.currentTarget.style.border = '0.5px solid #e0e0e0'; e.currentTarget.style.background = '#fff' }}>
                    {CHIFOUMI_EMOJI[move]}
                    <span style={{ fontSize: '10px', color: '#888', fontWeight: '500' }}>{move}</span>
                  </button>
                ))}
              </div>
            )}

            {amInTiebreak && myChifoumiMove && !chifoumiResult && (
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '56px', marginBottom: '8px' }}>{CHIFOUMI_EMOJI[myChifoumiMove]}</div>
                <div style={{ fontSize: '13px', color: '#888' }}>
                  Tu as choisi <strong>{myChifoumiMove}</strong> — en attente de l'adversaire...
                </div>
              </div>
            )}

            {!amInTiebreak && !chifoumiResult && (
              <div style={{ fontSize: '48px', marginBottom: '1rem' }}>⏳</div>
            )}

            {/* Résultat de la manche */}
            {chifoumiResult && (
              <div style={{ background: '#faeeda', borderRadius: '16px', padding: '1.25rem', margin: '0 auto', maxWidth: '320px', fontSize: '15px', color: '#633806', fontWeight: '500' }}>
                {chifoumiResult}
              </div>
            )}

            {/* Coups joués (visibles pour tous une fois les deux coups posés) */}
            {Object.keys(chifoumiMoves).length === tiedPlayerIds.length && tiedPlayerIds.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '1.5rem' }}>
                {tiedPlayerIds.map(id => {
                  const p = players.find(pl => pl.user_id === id)
                  const move = chifoumiMoves[id]
                  return (
                    <div key={id} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '36px' }}>{move ? CHIFOUMI_EMOJI[move] : '❓'}</div>
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{p?.pseudo}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* COUNTDOWN */}
        {phase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '1rem' }}>Chef désigné</div>
            <div style={{ fontSize: '48px', marginBottom: '.25rem' }}>👑</div>
            <div style={{ fontSize: '36px', fontWeight: '500', color: '#8d323b', marginBottom: '.5rem' }}>
              {chef?.pseudo}
            </div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.5rem' }}>
              élu chef par le groupe
            </div>
            <div style={{ fontSize: '72px', fontWeight: '500', color: '#8d323b', lineHeight: 1, margin: '1.5rem 0' }}>
              {countdown <= 0 ? '🍷' : countdown}
            </div>
            <div style={{ fontSize: '14px', color: '#888' }}>La dégustation commence...</div>
          </div>
        )}

      </div>
    </div>
  )
}
