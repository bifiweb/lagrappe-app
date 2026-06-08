'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { CHARACTERS, avatarUrl, getCharacter } from '@/lib/gameCharacters'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Profile, Evening, Session, SessionPlayer, Wine } from '@/types'

const accent = '#8d323b'
const eveningAccent = '#6B4FAE'

export default function EveningLobbyPage() {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [evening, setEvening] = useState<Evening | null>(null)
  const [firstSession, setFirstSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<SessionPlayer[]>([])
  const [wines, setWines] = useState<Wine[]>([])

  const [guestAccess, setGuestAccess] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const [joined, setJoined] = useState(false)
  const [pseudo, setPseudo] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [joining, setJoining] = useState(false)

  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [copied, setCopied] = useState(false)

  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const eveningId = params.id as string
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()

      const { data: ev } = await supabase.from('evenings').select('*').eq('id', eveningId).single()
      setEvening(ev)

      if (!ev) { setLoading(false); return }

      // Vérifier guest_access avant d'exiger une connexion
      const { data: proj } = await supabase
        .from('projects').select('guest_access').eq('id', ev.project_id).single()
      const hasGuestAccess = proj?.guest_access ?? false
      setGuestAccess(hasGuestAccess)

      if (!u && !hasGuestAccess) {
        router.push(`/auth/login?redirect=/app/evening/${eveningId}`)
        return
      }

      if (u) {
        setUser(u)
        setIsLoggedIn(true)
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', u.id).single()
        setProfile(prof)
        if (prof?.display_name) setPseudo(prof.display_name)
        setSelectedAvatar(prof?.avatar ?? null)
      }

      const { data: w } = await supabase.from('wines')
        .select('*')
        .in('id', ev.bottle_order)
        .order('bottle_number')
      setWines(w ?? [])

      const { data: sess } = await supabase
        .from('sessions')
        .select('*')
        .eq('evening_id', eveningId)
        .eq('order_in_evening', 1)
        .single()
      setFirstSession(sess)

      if (sess) {
        const { data: pl } = await supabase
          .from('session_players').select('*').eq('session_id', sess.id)
        setPlayers(pl ?? [])

        if (u) {
          const existing = pl?.find((p: SessionPlayer) => p.user_id === u.id)
          setJoined(!!existing)
        }

        if (sess.status !== 'lobby') {
          router.push(`/app/session/${sess.id}`)
          return
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  // Subscribe to evening broadcast + session player updates
  useEffect(() => {
    if (!eveningId || !firstSession?.id) return

    // Broadcast channel for evening-wide events
    const broadcastChannel = supabase.channel(`evening:${eveningId}`)
    broadcastChannel
      .on('broadcast', { event: 'session_started' }, ({ payload }) => {
        router.push(`/app/session/${payload.sessionId}`)
      })
      .subscribe()

    // Postgres changes for new players
    const playersChannel = supabase.channel(`evening_lobby:${eveningId}`)
    playersChannel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_players', filter: `session_id=eq.${firstSession.id}` },
        (payload) => {
          setPlayers(prev => {
            const newPlayer = payload.new as SessionPlayer
            if (prev.find(p => p.id === newPlayer.id)) return prev
            return [...prev, newPlayer]
          })
        }
      )
      .subscribe()

    channelRef.current = broadcastChannel

    return () => {
      supabase.removeChannel(broadcastChannel)
      supabase.removeChannel(playersChannel)
    }
  }, [eveningId, firstSession?.id])

  async function joinEvening() {
    if (!pseudo.trim() || !firstSession) return
    setJoining(true)

    let userId: string | undefined

    if (!isLoggedIn) {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error || !data.user) { setJoining(false); return }
      userId = data.user.id
      await supabase.from('profiles')
        .update({ display_name: pseudo.trim(), ...(selectedAvatar ? { avatar: selectedAvatar } : {}) })
        .eq('id', userId)
    } else {
      if (!user) { setJoining(false); return }
      userId = user.id
      await supabase.from('profiles')
        .update({ display_name: pseudo.trim(), ...(selectedAvatar ? { avatar: selectedAvatar } : {}) })
        .eq('id', userId)
    }

    const { error } = await supabase.from('session_players').insert({
      session_id: firstSession.id,
      user_id: userId,
      pseudo: pseudo.trim(),
      avatar: selectedAvatar ?? null,
      is_chef: false,
      evening_id: eveningId,
    })

    if (!error) setJoined(true)
    setJoining(false)
  }

  async function launchEvening() {
    if (!firstSession || !channelRef.current) return
    setLaunching(true)

    await channelRef.current.send({
      type: 'broadcast',
      event: 'session_started',
      payload: { sessionId: firstSession.id },
    })

    router.push(`/app/session/${firstSession.id}`)
  }

  function getEveningUrl() {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/app/evening/${eveningId}`
  }

  async function copyLink() {
    await navigator.clipboard.writeText(getEveningUrl())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareLink() {
    const url = getEveningUrl()
    if (navigator.share) {
      navigator.share({ title: 'La Grappe — Soirée dégustation', text: 'Rejoins ma soirée de dégustation à l\'aveugle !', url })
    } else {
      copyLink()
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  const isOrganizer = evening?.chef_id === user?.id
  const orderedWines = evening ? wines.sort((a, b) => {
    const ai = (evening.bottle_order as unknown as string[]).indexOf(a.id)
    const bi = (evening.bottle_order as unknown as string[]).indexOf(b.id)
    return ai - bi
  }) : []

  const wineTypeLabel = (type: string) => {
    if (type === 'rouge') return '🍷'
    if (type === 'blanc') return '🥂'
    if (type === 'rose') return '🌸'
    return '🍾'
  }

  // Show join form if not yet joined
  if (!joined) {
    const char = selectedAvatar ? getCharacter(selectedAvatar) : null
    return (
      <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: eveningAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>🎉</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>Rejoindre la soirée</div>
              <div style={{ fontSize: '11px', color: '#888' }}>{orderedWines.length} bouteilles ce soir</div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>
          {!isLoggedIn && guestAccess && (
            <div style={{ background: '#faeeda', border: '0.5px solid #e0c080', borderRadius: '10px', padding: '10px 14px', marginBottom: '1.25rem', fontSize: '13px', color: '#633806' }}>
              👤 Tu rejoins en tant qu&apos;<strong>invité</strong> — pas besoin de compte !
            </div>
          )}
          <div style={{ background: '#edeaf8', border: '0.5px solid #c5b8f0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#5B3D9E', fontWeight: '500' }}>
              {players.length} joueur{players.length > 1 ? 's' : ''} déjà connecté{players.length > 1 ? 's' : ''}
            </div>
            {players.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {players.slice(0, 6).map(p => (
                  <PlayerAvatar key={p.id} avatar={p.avatar} pseudo={p.pseudo} size={28} />
                ))}
                {players.length > 6 && <div style={{ fontSize: '12px', color: '#888', alignSelf: 'center' }}>+{players.length - 6}</div>}
              </div>
            )}
          </div>

          {/* Avatar */}
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', display: 'block', marginBottom: '12px' }}>Ton personnage</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: editingAvatar ? '16px' : 0 }}>
              <div onClick={() => setEditingAvatar(v => !v)} style={{ position: 'relative', width: '52px', height: '52px', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: selectedAvatar ? 'transparent' : accent, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: `2px solid ${selectedAvatar ? accent : 'transparent'}` }}>
                  {selectedAvatar
                    ? <img src={avatarUrl(selectedAvatar, char?.skinColor)} width={52} height={52} alt="" style={{ objectFit: 'cover', display: 'block' }} />
                    : <span style={{ fontSize: '22px', color: '#fff' }}>🎭</span>}
                </div>
                {char && <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: '18px', lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>{char.emoji}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>{char ? char.label : 'Aucun personnage'}</div>
                <button onClick={() => setEditingAvatar(v => !v)} style={{ marginTop: '4px', padding: '4px 12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#888', fontSize: '12px', cursor: 'pointer' }}>
                  {editingAvatar ? 'Fermer' : '✏️ Changer'}
                </button>
              </div>
            </div>
            {editingAvatar && (
              <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', justifyItems: 'center' }}>
                {CHARACTERS.map(ch => (
                  <button key={ch.seed} onClick={() => { setSelectedAvatar(ch.seed); setEditingAvatar(false) }}
                    style={{ position: 'relative', width: '50px', height: '50px', padding: 0, borderRadius: '50%', overflow: 'visible', border: selectedAvatar === ch.seed ? `3px solid ${accent}` : '3px solid transparent', background: 'transparent', cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#f5ede8' }}>
                      <img src={avatarUrl(ch.seed, ch.skinColor)} width={50} height={50} alt={ch.label} loading="lazy" style={{ display: 'block' }} />
                    </div>
                    <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: '16px', lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>{ch.emoji}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pseudo */}
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', display: 'block', marginBottom: '6px' }}>Ton pseudo</label>
            <input type="text" value={pseudo} onChange={e => setPseudo(e.target.value)}
              placeholder="Ex: Sophie M., Le Sommelier..." maxLength={30}
              style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <button onClick={joinEvening} disabled={!pseudo.trim() || joining}
            style={{ width: '100%', padding: '14px', background: !pseudo.trim() || joining ? '#c0a0a0' : eveningAccent, color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: !pseudo.trim() || joining ? 'default' : 'pointer' }}>
            {joining ? 'Connexion...' : 'Rejoindre la soirée →'}
          </button>
        </div>
      </div>
    )
  }

  // Lobby view (already joined)
  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: eveningAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>🎉</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>Soirée continue</div>
            <div style={{ fontSize: '11px', color: '#888' }}>{orderedWines.length} bouteilles</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Preview des bouteilles */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>
            Au programme ce soir
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {orderedWines.map((wine, i) => (
              <div key={wine.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fdf8f5', borderRadius: '8px', padding: '6px 10px', border: '0.5px solid #e8d8c8' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>{i + 1}</span>
                <span style={{ fontSize: '14px' }}>{wineTypeLabel(wine.type)}</span>
                <span style={{ fontSize: '12px', fontWeight: '500', color: '#1a1a1a' }}>#{wine.bottle_number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Players */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>
            {players.length} joueur{players.length > 1 ? 's' : ''} connecté{players.length > 1 ? 's' : ''}
          </div>
          {players.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '0.5px solid #f5f5f5' }}>
              <PlayerAvatar avatar={p.avatar} pseudo={p.pseudo} size={30} />
              <div style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>{p.pseudo}</div>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B6D11' }} />
            </div>
          ))}
          {players.length === 0 && (
            <div style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '8px 0' }}>En attente de joueurs...</div>
          )}
        </div>

        {/* Barème des points */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '12px' }}>📊 Barème des points</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {[
              { emoji: '👁️', label: 'Robe',      pts: '500 si juste · 200 sinon' },
              { emoji: '👃', label: 'Arômes',    pts: '200 pts × nb joueurs même arôme · +200 si officiel' },
              { emoji: '👄', label: 'Bouche',    pts: '500 si juste · 200 sinon' },
              { emoji: '💰', label: 'Prix',      pts: '500 si exact · −50 pts/CHF d\'écart' },
              { emoji: '📅', label: 'Millésime', pts: '500 si exact · −50 pts par année d\'écart' },
              { emoji: '🍇', label: 'Cépage',    pts: '1 500 si juste · 300 sinon' },
              { emoji: '📍', label: 'Région',    pts: '500 si juste · 100 sinon' },
              { emoji: '🪣', label: 'Élevage',   pts: '500 si juste · 100 sinon' },
              { emoji: '💡', label: 'Aide',      pts: '−300 pts par aide utilisée' },
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

        {/* QR + Partage */}
        <div style={{ background: '#f5ede8', border: '0.5px solid #d0a090', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: accent, marginBottom: '4px' }}>🎉 Invite tes amis !</div>
          <div style={{ fontSize: '12px', color: '#7a4030', marginBottom: '12px' }}>
            Partage ce lien pour qu'ils rejoignent la soirée directement.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <div style={{ background: '#fff', border: '0.5px solid #d0a090', borderRadius: '12px', padding: '12px', display: 'inline-block' }}>
              <QRCodeSVG value={getEveningUrl()} size={160} fgColor={accent} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: accent, fontFamily: 'monospace', wordBreak: 'break-all', background: '#fff', border: '0.5px solid #d0a090', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>
            {getEveningUrl()}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={copyLink}
              style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: copied ? '#27500A' : accent, color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '500', transition: 'background .2s' }}>
              {copied ? '✓ Copié !' : '📋 Copier'}
            </button>
            <button onClick={shareLink}
              style={{ flex: 1, padding: '10px', border: '0.5px solid #d0a090', borderRadius: '8px', background: '#fff', color: accent, fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
              💬 Partager
            </button>
          </div>
        </div>

        {/* Lancer la soirée (organisateur only) */}
        {isOrganizer ? (
          <button onClick={launchEvening} disabled={launching || players.length === 0}
            style={{ width: '100%', padding: '14px', background: players.length === 0 ? '#c0a0a0' : eveningAccent, color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: players.length === 0 ? 'default' : 'pointer' }}>
            {launching ? 'Lancement...' : `Lancer la soirée (${players.length} joueur${players.length > 1 ? 's' : ''}) →`}
          </button>
        ) : (
          <div style={{ background: '#f0f4ff', border: '0.5px solid #c0ccee', borderRadius: '12px', padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#3C3489', fontWeight: '500' }}>⏳ En attente de l'organisateur...</div>
            <div style={{ fontSize: '12px', color: '#534AB7', marginTop: '4px' }}>La soirée démarrera quand il lancera le jeu</div>
          </div>
        )}

      </div>
    </div>
  )
}
