'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import type { Profile, Session, SessionPlayer, Evening, Project } from '@/types'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { QRCodeSVG } from 'qrcode.react'
import { useT } from '@/lib/i18n'

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

// Tirage pseudo-aléatoire dérivé de l'id de session : tous les joueurs obtiennent
// le même résultat sans se coordonner (Math.random donnait un chef différent par téléphone)
function seededIndex(seed: string, n: number): number {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % n
}

export default function SessionPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<SessionPlayer[]>([])
  const [phase, setPhase] = useState<'lobby' | 'voting' | 'chifoumi' | 'tirage' | 'countdown'>('lobby')
  const [myVote, setMyVote] = useState<string | null>(null)
  const [votesIn, setVotesIn] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)
  const [voteClosed, setVoteClosed] = useState(false)
  const [chef, setChef] = useState<SessionPlayer | null>(null)
  const [countdown, setCountdown] = useState(10)
  const [loading, setLoading] = useState(true)
  const [determiningChef, setDeterminingChef] = useState(false)
  const [copied, setCopied] = useState(false)
  const [evening, setEvening] = useState<Evening | null>(null)
  const [project, setProject] = useState<Project | null>(null)

  // Chifoumi
  const [tiedPlayerIds, setTiedPlayerIds] = useState<string[]>([])
  const [myChifoumiMove, setMyChifoumiMove] = useState<ChifoumiMove | null>(null)
  const [chifoumiMoves, setChifoumiMoves] = useState<Record<string, ChifoumiMove>>({})
  const [chifoumiRound, setChifoumiRound] = useState(1)
  const [chifoumiResult, setChifoumiResult] = useState<string | null>(null)

  // Tirage au sort (égalité 3+)
  const [tirageWinner, setTirageWinner] = useState<SessionPlayer | null>(null)
  const [tirageReason, setTirageReason] = useState<string | null>(null)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [wheelDone, setWheelDone] = useState(false)

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
  const t = useT()
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

      if (sess?.evening_id) {
        const { data: ev } = await supabase.from('evenings').select('*').eq('id', sess.evening_id).single()
        setEvening(ev)
      }

      if (sess?.project_id) {
        const { data: proj } = await supabase.from('projects').select('*').eq('id', sess.project_id).single()
        setProject(proj)

        // Routage pour le template cépage
        if (proj?.template === 'cepage') {
          if (sess.status === 'cepage_info') { router.push(`/app/session/${sessionId}/cepage-info`); return }
          if (sess.status === 'cepage_tasting') { router.push(`/app/session/${sessionId}/cepage-tasting`); return }
          if (sess.status === 'cepage_results') { router.push(`/app/session/${sessionId}/cepage-results`); return }
        }
      }

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
      if (sess?.status === 'tasting') {
        clearInterval(interval)
        router.push(`/app/tasting/${sessionId}`)
      }
      if (sess?.status === 'cepage_info') {
        clearInterval(interval)
        router.push(`/app/session/${sessionId}/cepage-info`)
      }
      if (sess?.status === 'cepage_tasting') {
        clearInterval(interval)
        router.push(`/app/session/${sessionId}/cepage-tasting`)
      }
      if (sess?.status === 'cepage_results') {
        clearInterval(interval)
        router.push(`/app/session/${sessionId}/cepage-results`)
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
      const voteClosed = !!sess?.vote_closed_at
      setVoteClosed(voteClosed)

      if ((newCount >= currentPlayers.length || voteClosed) && newCount > 0 && currentPlayers.length > 0) {
        clearInterval(interval)
        setDeterminingChef(true)
        await determineChef(currentPlayers, voteClosed)
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
      setChifoumiResult(t('Égalité ! Nouvelle manche...'))
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
      setChifoumiResult(t('{a} bat {b} — {nom} est le·la chef·fe !', { a: CHIFOUMI_EMOJI[winMove], b: CHIFOUMI_EMOJI[loseMove], nom: winnerPlayer?.pseudo ?? '' }))
      // Seul le premier tied player écrit en DB pour éviter les doublons
      if (profile?.id === ids[0]) {
        setTimeout(async () => {
          await supabase.from('session_players').update({ is_chef: false }).eq('session_id', sessionId)
          await supabase.from('session_players').update({ is_chef: true }).eq('session_id', sessionId).eq('user_id', winnerId)
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

  // Animation roue tirage
  useEffect(() => {
    if (phase !== 'tirage' || tiedPlayerIds.length < 3 || !tirageWinner) return
    const N = tiedPlayerIds.length
    const sliceAngle = 360 / N
    const winnerIdx = tiedPlayerIds.indexOf(tirageWinner.user_id)
    const landingAngle = (360 - (winnerIdx + 0.5) * sliceAngle + 360) % 360
    const target = landingAngle + 6 * 360
    const spin = setTimeout(() => setWheelRotation(target), 100)
    const done = setTimeout(() => setWheelDone(true), 4500)
    return () => { clearTimeout(spin); clearTimeout(done) }
  }, [phase, tirageWinner?.user_id])

  async function launchSubSession() {
    await supabase.from('sessions').update({ status: 'tasting' }).eq('id', sessionId)
    router.push(`/app/tasting/${sessionId}`)
  }

  async function launchCepageInfo() {
    await supabase.from('sessions').update({ status: 'cepage_info' }).eq('id', sessionId)
    router.push(`/app/session/${sessionId}/cepage-info`)
  }

  async function launchVote() {
    await supabase.from('sessions')
      .update({ status: 'voting' })
      .eq('id', sessionId)
    setPhase('voting')
  }

  async function leaveSession() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('session_players')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
    router.push('/app/dashboard')
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
      navigator.share({ title: t("La Grappe — Dégustation à l'aveugle"), text: t('Rejoins ma session de dégustation !'), url })
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${t('Rejoins ma session de dégustation La Grappe !')} ${url}`)}`, '_blank')
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

  async function closeVote() {
    if (!confirm(t('Continuer sans attendre les joueurs qui n\'ont pas voté ?'))) return
    await supabase.from('sessions').update({ vote_closed_at: new Date().toISOString() }).eq('id', sessionId)
  }

  async function determineChef(currentPlayers: SessionPlayer[], closed = false) {
    const { data: votes } = await supabase.from('votes').select('voter_id, voted_for').eq('session_id', sessionId)
    if (!votes || votes.length === 0) return

    // Vote clos : un joueur absent ne peut pas être élu, il ne lancerait jamais la révélation
    const voters = votes.map(v => v.voter_id)
    const present = votes.filter(v => voters.includes(v.voted_for)).map(v => v.voted_for)
    const candidates = !closed ? votes.map(v => v.voted_for) : present.length > 0 ? present : voters

    const tally: Record<string, number> = {}
    candidates.forEach(id => { tally[id] = (tally[id] || 0) + 1 })

    const maxVotes = Math.max(...Object.values(tally))
    // Tri : même ordre sur tous les téléphones (l'ordre des votes renvoyés par la DB n'est pas garanti)
    const winners = Object.entries(tally).filter(([, v]) => v === maxVotes).map(([id]) => id).sort()

    if (winners.length === 2) {
      // Égalité à 2 → chifoumi !
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

    if (winners.length > 2) {
      // Égalité à 3+ → roue de la fortune
      const winnerId = winners[seededIndex(sessionId, winners.length)]
      const winnerPlayer = currentPlayers.find(p => p.user_id === winnerId)
      const vars = { nom: winnerPlayer?.pseudo ?? '', n: winners.length }
      const reasons = [
        t(`L'algorithme a détecté que "{nom}" contient exactement le bon nombre de lettres pour commander un grand cru.`, vars),
        t(`Après analyse des ondes vibratoires du groupe, "{nom}" émet la fréquence la plus proche du Pinot Noir.`, vars),
        t(`Le hasard a parlé — et visiblement il avait très envie que "{nom}" tienne le tire-bouchon.`, vars),
        t(`"{nom}" a été désigné par les astres, la physique quantique, et une légère intuition de l'IA.`, vars),
        t(`Égalité parfaite entre {n} grands esprits. La roue a tranché : "{nom}" est le·la chef·fe du soir.`, vars),
      ]
      const reason = reasons[seededIndex(`${sessionId}-raison`, reasons.length)]
      setTiedPlayerIds(winners)
      setTirageWinner(winnerPlayer ?? null)
      setTirageReason(reason)
      setWheelRotation(0)
      setWheelDone(false)
      setPhase('tirage')
      setTimeout(async () => {
        await assignChef(winnerId, currentPlayers)
      }, 7000)
      return
    }

    await assignChef(winners[0], currentPlayers)
  }

  async function assignChef(chefId: string, currentPlayers: SessionPlayer[]) {
    const chefPlayer = currentPlayers.find(p => p.user_id === chefId)
    setChef(chefPlayer ?? null)
    await supabase.from('session_players').update({ is_chef: false }).eq('session_id', sessionId)
    await supabase.from('session_players').update({ is_chef: true }).eq('session_id', sessionId).eq('user_id', chefId)
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
      <div style={{ color: '#888', fontSize: '14px' }}>{t('Chargement...')}</div>
    </div>
  )

  const amInTiebreak = tiedPlayerIds.includes(profile?.id ?? '')
  const isEveningSession = !!session?.evening_id
  const isCepageSession = project?.template === 'cepage'
  const isChef = isEveningSession
    ? evening?.chef_id === profile?.id
    : players.find(p => p.user_id === profile?.id)?.is_chef ?? false
  const totalBottles = evening ? (evening.bottle_order as unknown as string[]).length : 1
  const cepageName = project?.cepage_name ?? t('Cépage')

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isCepageSession ? '#7a3a5a' : session?.evening_id ? '#6B4FAE' : '#8d323b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px' }}>{isCepageSession ? '🍇' : session?.evening_id ? '🎉' : '🍷'}</span>
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>
              {isCepageSession ? cepageName : t('Bouteille #{n}', { n: session?.bottle_number ?? '' })}
            </span>
            {session?.evening_id && (
              <div style={{ fontSize: '11px', color: '#6B4FAE', fontWeight: '500' }}>
                {t('Soirée')} — {session.order_in_evening}/{totalBottles}
              </div>
            )}
          </div>
          {session?.evening_id && (
            <div style={{ display: 'flex', gap: '3px' }}>
              {Array.from({ length: totalBottles }).map((_, i) => (
                <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i < (session.order_in_evening ?? 1) ? '#6B4FAE' : '#e0e0e0' }} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* LOBBY */}
        {phase === 'lobby' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>{t('Lobby')}</div>
              <div style={{ fontSize: '13px', color: '#888' }}>
                {players.length > 1 ? t('{n} joueurs connectés', { n: players.length }) : t('{n} joueur connecté', { n: players.length })}
              </div>
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              {players.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '0.5px solid #f0f0f0' }}>
                  <PlayerAvatar avatar={p.avatar} pseudo={p.pseudo} size={32} />
                  <div style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>{p.pseudo}</div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B6D11' }}></div>
                </div>
              ))}
            </div>

            {!isEveningSession && <div style={{ background: '#f5ede8', border: '0.5px solid #d0a090', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#8d323b', marginBottom: '4px' }}>
                {isCepageSession ? t('🍇 Partage le lien !') : t('🎉 Invite tes amis !')}
              </div>
              <div style={{ fontSize: '12px', color: '#7a4030', marginBottom: '12px' }}>
                {t("Plus on est de fous, plus le jeu est fun — partage le lien pour qu'ils rejoignent la session.")}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <div style={{ background: '#fff', border: '0.5px solid #d0a090', borderRadius: '12px', padding: '12px', display: 'inline-block' }}>
                  <QRCodeSVG value={getShareUrl()} size={160} fgColor="#8d323b" />
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#8d323b', fontFamily: 'monospace', wordBreak: 'break-all', background: '#fff', border: '0.5px solid #d0a090', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>
                {getShareUrl()}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={copyLink}
                  style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: copied ? '#27500A' : '#8d323b', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '500', transition: 'background .2s' }}>
                  {copied ? t('✓ Copié !') : t('📋 Copier')}
                </button>
                <button onClick={shareLink}
                  style={{ flex: 1, padding: '10px', border: '0.5px solid #d0a090', borderRadius: '8px', background: '#fff', color: '#8d323b', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                  {t('💬 Partager')}
                </button>
              </div>
            </div>}

            {!isEveningSession && !isCepageSession && <div style={{ background: '#fdf8f5', border: '0.5px solid #e8d8c8', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '8px' }}>
                {t('👑 Le rôle du·de la chef·fe')}
              </div>
              <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#555', lineHeight: 1.6 }}>
                {t("Le groupe vote pour désigner un·e chef·fe parmi les joueurs. Ce rôle est purement cérémoniel : tout le monde joue sur un pied d'égalité et marque des points de la même façon.")}
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: '#555', lineHeight: 1.6 }}>
                <strong>{t('Son seul privilège ?')}</strong> {t("C'est lui·elle — et lui·elle seul·e — qui peut lancer la révélation du vin mystère une fois que tout le monde a soumis sa dégustation. 🍾")}
              </p>
            </div>}

            {!isEveningSession && !isCepageSession && <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '12px' }}>
                {t('📊 Barème des points')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { emoji: '👁️', label: t('Robe'),      pts: t('500 si juste · 200 sinon') },
                  { emoji: '👃', label: t('Arômes'),    pts: t("jusqu'à 1 000 pts si les autres joueurs l'ont aussi · +200 si arôme des grappistes") },
                  { emoji: '👄', label: t('Bouche'),    pts: t('500 si juste · 350 si à côté · 200 sinon') },
                  { emoji: '💰', label: t('Prix'),      pts: t("500 si exact · −50 pts/CHF d'écart") },
                  { emoji: '📅', label: t('Millésime'), pts: t("500 si exact · −50 pts par année d'écart") },
                  { emoji: '🍇', label: t('Cépage'),    pts: t('1 500 si juste · 300 sinon') },
                  { emoji: '📍', label: t('Région'),    pts: t('500 si juste · 100 sinon') },
                  { emoji: '🪣', label: t('Élevage'),   pts: t('500 si juste · 100 sinon') },
                  { emoji: '💡', label: t('Aide'),      pts: t('−300 pts par aide utilisée') },
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
            </div>}

            {isCepageSession ? (
              <>
                <div style={{ background: '#f5ede8', border: '0.5px solid #d0a090', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>🍇</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#8d323b', marginBottom: '2px' }}>
                      {t("Dégustation {cepage} à l'aveugle", { cepage: cepageName })}
                    </div>
                    <div style={{ fontSize: '12px', color: '#7a4030', lineHeight: 1.5 }}>
                      {t("Chaque joueur a apporté une bouteille. L'organisateur lance quand tout le monde est prêt.")}
                    </div>
                  </div>
                </div>
                {isChef ? (
                  <button onClick={launchCepageInfo}
                    style={{ width: '100%', padding: '14px', background: '#8d323b', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
                    {t('Tout le monde est là ? Lancer →')}
                  </button>
                ) : (
                  <div style={{ background: '#f5f5f5', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', color: '#444', fontWeight: '500' }}>{t("⏳ En attente de l'organisateur·ice...")}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{t('La dégustation démarrera dans quelques instants')}</div>
                  </div>
                )}
              </>
            ) : isEveningSession ? (
              <>
                <div style={{ background: '#edeaf8', border: '0.5px solid #c5b8f0', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>🎉</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#5B3D9E', marginBottom: '2px' }}>
                      {session?.order_in_evening === 1
                        ? t('Bouteille {n}/{total} — Prêts à démarrer ?', { n: 1, total: totalBottles })
                        : t('Bouteille {n}/{total} — Même équipe !', { n: session?.order_in_evening ?? '', total: totalBottles })}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B4FAE', lineHeight: 1.5 }}>
                      {session?.order_in_evening === 1
                        ? t("Tout le monde est en place. L'organisateur·ice peut lancer la première dégustation.")
                        : t("Tout le monde est en place. L'organisateur·ice peut lancer la prochaine dégustation.")}
                    </div>
                  </div>
                </div>

                {isChef ? (
                  <button onClick={launchSubSession}
                    style={{ width: '100%', padding: '14px', background: '#6B4FAE', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
                    {t('Lancer la dégustation →')}
                  </button>
                ) : (
                  <div style={{ background: '#f0f4ff', border: '0.5px solid #c0ccee', borderRadius: '12px', padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', color: '#3C3489', fontWeight: '500' }}>{t("⏳ En attente de l'organisateur·ice...")}</div>
                    <div style={{ fontSize: '12px', color: '#534AB7', marginTop: '4px' }}>{t('La dégustation démarrera dans quelques instants')}</div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ background: '#f0f4ff', border: '0.5px solid #c0ccee', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>⏳</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#3C3489', marginBottom: '2px' }}>
                      {t('Attends que tout le monde soit là !')}
                    </div>
                    <div style={{ fontSize: '12px', color: '#534AB7', lineHeight: 1.5 }}>
                      {t('Prends le temps de lire les règles ci-dessus, puis lance le vote quand tous les joueurs sont connectés.')}
                    </div>
                  </div>
                </div>

                <button onClick={launchVote}
                  style={{ width: '100%', padding: '14px', background: '#8d323b', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
                  {t('Lancer le vote du·de la chef·fe →')}
                </button>

                {profile?.role === 'admin' && (
                  <button onClick={leaveSession}
                    style={{ width: '100%', marginTop: '10px', padding: '12px', background: 'transparent', color: '#aaa', border: '0.5px solid #e0e0e0', borderRadius: '12px', fontSize: '13px', cursor: 'pointer' }}>
                    {t('Quitter la session')}
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* VOTE */}
        {phase === 'voting' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>{t('Qui sera le·la chef·fe ? 👑')}</div>
              <div style={{ fontSize: '13px', color: '#888', lineHeight: 1.5 }}>
                {t('Tout le monde joue à égalité — le·la chef·fe sera simplement')}<br />{t('celui·celle qui appuiera sur le bouton de révélation 🍾')}
              </div>
            </div>

            {hasVoted ? (
              <div style={{ background: '#e8f0e8', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center', fontSize: '14px', color: '#27500A' }}>
                {t('✓ Vote enregistré — en attente des autres joueurs...')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
                {players.filter(p => p.user_id !== profile?.id).map(p => (
                  <div key={p.id}
                    onClick={() => setMyVote(p.user_id)}
                    style={{ background: '#fff', border: myVote === p.user_id ? '2px solid #8d323b' : '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <PlayerAvatar avatar={p.avatar} pseudo={p.pseudo} size={38} />
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
                {players.length === 1 ? t('Je suis le·la chef·fe, on commence ! →') : t('Confirmer mon vote')}
              </button>
            )}

            <div style={{ textAlign: 'center', fontSize: '12px', color: '#aaa', marginTop: '1rem' }}>
              {votesIn} / {players.length} {t('votes')}
            </div>

            {hasVoted && !voteClosed && votesIn < players.length && (
              <button onClick={closeVote}
                style={{ width: '100%', marginTop: '10px', padding: '12px', background: 'transparent', color: '#8d323b', border: '0.5px solid #d0a090', borderRadius: '12px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                {t('⚡ Continuer sans les absents')}
              </button>
            )}
          </>
        )}

        {/* TIRAGE AU SORT — roue (égalité 3+) */}
        {phase === 'tirage' && (() => {
          const WHEEL_COLORS = ['#8d323b','#c17a2a','#2a6e3a','#1a4a8a','#6a2a8a','#8a6a1a','#2a6a7a','#7a3a5a']
          const N = tiedPlayerIds.length
          const cx = 150, cy = 150, r = 130
          const sliceAngle = 360 / N
          const slices = tiedPlayerIds.map((userId, i) => {
            const startRad = (i * sliceAngle - 90) * Math.PI / 180
            const endRad = ((i + 1) * sliceAngle - 90) * Math.PI / 180
            const x1 = cx + r * Math.cos(startRad), y1 = cy + r * Math.sin(startRad)
            const x2 = cx + r * Math.cos(endRad),   y2 = cy + r * Math.sin(endRad)
            const path = `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${sliceAngle > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`
            const midRad = ((i + 0.5) * sliceAngle - 90) * Math.PI / 180
            const tr = r * 0.62
            const tx = cx + tr * Math.cos(midRad), ty = cy + tr * Math.sin(midRad)
            const textRot = (i + 0.5) * sliceAngle
            const pseudo = players.find(p => p.user_id === userId)?.pseudo ?? ''
            return { path, color: WHEEL_COLORS[i % WHEEL_COLORS.length], tx, ty, textRot, pseudo }
          })
          const fontSize = N <= 4 ? 13 : N <= 6 ? 11 : 9
          return (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '13px', color: '#888', marginBottom: '4px' }}>{t('Égalité à {n} joueurs', { n: N })}</div>
              <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a', marginBottom: '1.5rem' }}>
                {t('La roue décide ! 🎡')}
              </div>

              <div style={{ position: 'relative', display: 'inline-block' }}>
                {/* Pointeur */}
                <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '13px solid transparent', borderRight: '13px solid transparent', borderTop: '22px solid #8d323b', zIndex: 10 }} />
                {/* Roue SVG */}
                <svg width="300" height="300" viewBox="0 0 300 300"
                  style={{ display: 'block', transform: `rotate(${wheelRotation}deg)`, transition: wheelRotation > 0 ? 'transform 4s cubic-bezier(0.17, 0.67, 0.1, 0.99)' : 'none' }}>
                  {slices.map(({ path, color, tx, ty, textRot, pseudo }, i) => (
                    <g key={i}>
                      <path d={path} fill={color} stroke="#fff" strokeWidth="2" />
                      <text x={tx} y={ty} fill="#fff" fontSize={fontSize} fontWeight="600"
                        textAnchor="middle" dominantBaseline="middle"
                        transform={`rotate(${textRot}, ${tx.toFixed(1)}, ${ty.toFixed(1)})`}>
                        {pseudo.length > 9 ? pseudo.slice(0, 8) + '…' : pseudo}
                      </text>
                    </g>
                  ))}
                  <circle cx={cx} cy={cy} r={22} fill="#fff" />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="18">🍷</text>
                </svg>
              </div>

              {wheelDone && tirageWinner && (
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ fontSize: '26px', fontWeight: '700', color: '#8d323b', marginBottom: '8px' }}>
                    👑 {tirageWinner.pseudo} !
                  </div>
                  {tirageReason && (
                    <div style={{ background: '#faeeda', borderRadius: '16px', padding: '1rem 1.25rem', margin: '0 auto', maxWidth: '320px', fontSize: '13px', color: '#633806', lineHeight: 1.6 }}>
                      {tirageReason}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* CHIFOUMI */}
        {phase === 'chifoumi' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>
              {t('Manche {n}', { n: chifoumiRound })}
            </div>
            <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>
              {t('Égalité ! Chifoumi 🤜')}
            </div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '2rem' }}>
              {amInTiebreak
                ? t('Choisis ton coup pour devenir chef·fe !')
                : t('Duel en cours entre {noms}...', { noms: tiedPlayerIds.map(id => players.find(p => p.user_id === id)?.pseudo).join(t(' et ')) })}
            </div>

            {amInTiebreak && !myChifoumiMove && !chifoumiResult && (
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '2rem' }}>
                {(['pierre', 'feuille', 'ciseaux'] as ChifoumiMove[]).map(move => (
                  <button key={move} onClick={() => submitChifoumiMove(move)}
                    style={{ width: '88px', height: '88px', borderRadius: '20px', border: '0.5px solid #e0e0e0', background: '#fff', fontSize: '40px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'all .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.border = '2px solid #8d323b'; e.currentTarget.style.background = '#f5ede8' }}
                    onMouseLeave={e => { e.currentTarget.style.border = '0.5px solid #e0e0e0'; e.currentTarget.style.background = '#fff' }}>
                    {CHIFOUMI_EMOJI[move]}
                    <span style={{ fontSize: '10px', color: '#888', fontWeight: '500' }}>{t(move)}</span>
                  </button>
                ))}
              </div>
            )}

            {amInTiebreak && myChifoumiMove && !chifoumiResult && (
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '56px', marginBottom: '8px' }}>{CHIFOUMI_EMOJI[myChifoumiMove]}</div>
                <div style={{ fontSize: '13px', color: '#888' }}>
                  {t('Tu as choisi')} <strong>{t(myChifoumiMove)}</strong> — {t("en attente de l'adversaire...")}
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
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '1rem' }}>{t('Chef·fe désigné·e')}</div>
            <div style={{ fontSize: '48px', marginBottom: '.25rem' }}>👑</div>
            <div style={{ fontSize: '36px', fontWeight: '500', color: '#8d323b', marginBottom: '.5rem' }}>
              {chef?.pseudo}
            </div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.5rem' }}>
              {t('élu·e chef·fe par le groupe')}
            </div>
            <div style={{ fontSize: '72px', fontWeight: '500', color: '#8d323b', lineHeight: 1, margin: '1.5rem 0' }}>
              {countdown <= 0 ? '🍷' : countdown}
            </div>
            <div style={{ fontSize: '14px', color: '#888' }}>{t('La dégustation commence...')}</div>
          </div>
        )}

      </div>
    </div>
  )
}
