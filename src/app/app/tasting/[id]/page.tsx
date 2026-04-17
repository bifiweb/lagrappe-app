'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { WINE_CONTENT, MAX_AROMES, ELEVAGE_OPTIONS } from '@/types'
import { getAromeIcon } from '@/lib/arome-icons'
import { getAccordIcon } from '@/lib/accord-icons'
import { CEPAGE_INFO } from '@/lib/cepage-info'
import type { Session, Wine } from '@/types'


const ROBE_COLORS: Record<string, string> = {
  'Violacée':        '#6B2D8B',
  'Rouge pâle':      '#C0504D',
  'Rouge dense':     '#8B1A1A',
  'Tuilée':          '#B5651D',
  'Jaune pâle':      '#F0E68C',
  'Or / Paille':     '#D4B96A',
  'Ambrée':          '#C68642',
  'Rosée':           '#FFB7C5',
  'Rose pâle':       '#FFD1DC',
  'Rose saumon':     '#FF9B8A',
  'Rose vif':        '#FF6B8A',
  'Rose orangé':     '#FF8C69',
  'Blanc de blancs': '#F0EDD0',
}

const SCORE_EMOJIS = ['😫','😞','😕','😐','😏','🙂','😊','😋','😁','🤩','😍']
const SCORE_LABELS = ['Imbuvable','Très mauvais','Mauvais','Bof','Correct','Moyen','Bien','Très bien','Excellent','Sublime','Légendaire !']


function HintBanner({ used, onUse }: { used: number, onUse: () => void }) {
  if (used >= 2) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#fffbf0', border: '1px solid #f0d080', borderRadius: '10px', marginBottom: '12px' }}>
      <span style={{ fontSize: '18px' }}>💡</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#7a5000' }}>
          Aide disponible {used > 0 ? `(${used}/2 utilisée)` : ''}
        </div>
        <div style={{ fontSize: '11px', color: '#a07820', lineHeight: 1.3 }}>
          Élimine ~1/3 des mauvaises réponses · coûte <strong>100 pts</strong>
        </div>
      </div>
      <button onClick={onUse} style={{ padding: '6px 14px', background: '#f0a000', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        Utiliser
      </button>
    </div>
  )
}

function haptic(duration = 8) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(duration)
  }
}

function WineGlass({ color, size = 48, animate = false }: { color: string, size?: number, animate?: boolean }) {
  const [filled, setFilled] = useState(false)
  const safeId = color.replace('#', '').replace(/[^a-zA-Z0-9]/g, '')

  useEffect(() => {
    if (animate) {
      setFilled(false)
      const t = setTimeout(() => setFilled(true), 50)
      return () => clearTimeout(t)
    } else {
      setFilled(true)
    }
  }, [animate, color])

  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 48 67" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id={`gc-${safeId}-${size}`}>
          <path d="M8 4 C8 4 4 20 4 28 C4 38 13 46 24 46 C35 46 44 38 44 28 C44 20 40 4 40 4 Z" />
        </clipPath>
      </defs>
      {/* Fond verre */}
      <path d="M8 4 C8 4 4 20 4 28 C4 38 13 46 24 46 C35 46 44 38 44 28 C44 20 40 4 40 4 Z" fill="white" stroke="#e0e0e0" strokeWidth="1.5"/>
      {/* Vin animé */}
      <g clipPath={`url(#gc-${safeId}-${size})`}>
        <rect
          x="0" y="0" width="48" height="48"
          fill={color}
          opacity="0.85"
          style={{
            transform: filled ? 'translateY(20px)' : 'translateY(50px)',
            transition: animate ? 'transform .6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
          }}
        />
      </g>
      {/* Contour verre par dessus */}
      <path d="M8 4 C8 4 4 20 4 28 C4 38 13 46 24 46 C35 46 44 38 44 28 C44 20 40 4 40 4 Z" fill="none" stroke="#d0d0d0" strokeWidth="1"/>
      {/* Pied */}
      <line x1="24" y1="46" x2="24" y2="60" stroke="#d0d0d0" strokeWidth="1.5"/>
      <line x1="14" y1="60" x2="34" y2="60" stroke="#d0d0d0" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function TastingPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [wine, setWine] = useState<Wine | null>(null)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left')
  const [gifOpenStep, setGifOpenStep] = useState<number | null>(null)
  const [showBareme, setShowBareme] = useState(false)

  const [robe, setRobe] = useState<string | null>(null)
  const [nezIntensite, setNezIntensite] = useState(3)
  const [aromes, setAromes] = useState<string[]>([])
  const [boucheIndex, setBoucheIndex] = useState(1)
  const [accord, setAccord] = useState<string | null>(null)
  const [prix, setPrix] = useState('')
  const [millesime, setMillesime] = useState('')
  const [cepage, setCepage] = useState<string | null>(null)
  const [region, setRegion] = useState<string | null>(null)
  const [scorePerso, setScorePerso] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [elevage, setElevage] = useState<string | null>(null)

  // Système d'aide
  const [hintsUsed, setHintsUsed] = useState(0)
  const [hintCounts, setHintCounts] = useState({ aromes: 0, cepage: 0, region: 0 })
  const [eliminatedAromes, setEliminatedAromes] = useState<string[]>([])
  const [eliminatedCepages, setEliminatedCepages] = useState<string[]>([])
  const [eliminatedRegions, setEliminatedRegions] = useState<string[]>([])

  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const sessionId = params.id as string

  const steps = ['Vue', 'Nez', 'Bouche', 'Accords', 'Notes', 'Devinette']
  const stepIcons = ['👁️', '👃', '👄', '🍴', '📝', '🔮']

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: sess } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
      setSession(sess)
      if (sess) {
        const { data: w } = await supabase.from('wines').select('*').eq('id', sess.wine_id).single()
        setWine(w)
      }
      setLoading(false)
    }
    load()
  }, [])

  function toggleArome(a: string) {
    haptic()
    if (aromes.includes(a)) setAromes(aromes.filter(x => x !== a))
    else if (aromes.length < MAX_AROMES) setAromes([...aromes, a])
  }

  function goStep(n: number) {
    setSlideDirection(n > step ? 'left' : 'right')
    setAnimating(true)
    setGifOpenStep(null)
    haptic()
    setTimeout(() => {
      setStep(n)
      setAnimating(false)
    }, 200)
  }

  async function useHint(section: 'aromes' | 'cepage' | 'region') {
    if (hintCounts[section] >= 2 || !wine) return
    haptic(20)

    const eliminated: string[] = section === 'aromes' ? eliminatedAromes
      : section === 'cepage' ? eliminatedCepages
      : eliminatedRegions

    const wineContent = WINE_CONTENT[wine.type]
    const allOptions: string[] = section === 'aromes' ? wineContent.aromes
      : section === 'cepage' ? wineContent.cepages
      : wineContent.regions

    const alreadyExcluded = section === 'aromes'
      ? [...eliminated, ...aromes]
      : eliminated

    const { data: newEliminated } = await supabase.rpc('get_hint', {
      p_wine_id: wine.id,
      p_section: section,
      p_all_options: allOptions,
      p_already_eliminated: alreadyExcluded,
    })

    if (!newEliminated) return

    if (section === 'aromes') setEliminatedAromes(prev => [...prev, ...newEliminated])
    else if (section === 'cepage') setEliminatedCepages(prev => [...prev, ...newEliminated])
    else setEliminatedRegions(prev => [...prev, ...newEliminated])

    setHintCounts(prev => ({ ...prev, [section]: prev[section] + 1 }))
    setHintsUsed(prev => prev + 1)
  }

  async function submitTasting() {
    haptic(50)
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('tastings').upsert({
      session_id: sessionId,
      user_id: user.id,
      robe,
      nez_intensite: nezIntensite,
      aromes,
      bouche: WINE_CONTENT[wine!.type].bouche[boucheIndex],
      accords: accord ? [accord] : [],
      prix_estime: prix.trim() || null,
      millesime_estime: millesime ? parseInt(millesime) : null,
      cepage_guess: cepage,
      region_guess: region,
      score_perso: scorePerso,
      notes_libres: notes,
      elevage_guess: elevage,
      hints_used: hintsUsed,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'session_id,user_id' })
    await supabase.from('session_players')
      .update({ tasting_done: true })
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
    router.push(`/app/session/${sessionId}/waiting`)
    setSaving(false)
  }

  if (loading || !wine) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  const content = WINE_CONTENT[wine.type]
  const accent = wine.type === 'rouge' ? '#8d323b' : '#7a6a1a'
  const bg = wine.type === 'rouge' ? '#f5ede8' : '#f5f3e0'

  // Validation par étape — tous les champs obligatoires
  const stepValid = (() => {
    if (step === 0) return robe !== null
    if (step === 1) return aromes.length > 0
    if (step === 3) return accord !== null
    if (step === 4) return scorePerso !== null
    if (step === 5) return cepage !== null && region !== null && millesime.trim() !== '' && prix.trim() !== '' && elevage !== null
    return true
  })()

  const stepMissing = (() => {
    if (step === 0 && !robe) return 'Sélectionne une robe pour continuer'
    if (step === 1 && aromes.length === 0) return 'Sélectionne au moins un arôme'
    if (step === 3 && !accord) return 'Choisis un accord mets-vin'
    if (step === 4 && scorePerso === null) return 'Donne une note pour continuer'
    if (step === 5) {
      const missing: string[] = []
      if (!cepage) missing.push('cépage')
      if (!region) missing.push('région')
      if (!millesime.trim()) missing.push('millésime')
      if (!prix.trim()) missing.push('prix')
      if (!elevage) missing.push('élevage')
      if (missing.length > 0) return `Il manque : ${missing.join(', ')}`
    }
    return null
  })()

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px' }}>🍷</span>
          </div>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>Bouteille #{session?.bottle_number}</span>
          <button onClick={() => setShowBareme(v => !v)}
            title="Barème des points"
            style={{ background: showBareme ? accent : '#f5f5f5', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', color: showBareme ? '#fff' : '#888', cursor: 'pointer', fontWeight: '500' }}>
            📊
          </button>
          <span style={{ fontSize: '13px', color: '#888' }}>{step + 1} / {steps.length}</span>
        </div>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', gap: '4px', paddingBottom: '12px' }}>
          {steps.map((s, i) => (
            <div key={i} onClick={() => i < step && goStep(i)}
              style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= step ? accent : '#e0e0e0', transition: 'background .3s', cursor: i < step ? 'pointer' : 'default' }}
              title={i < step ? `Retour à ${s}` : s} />
          ))}
        </div>
      </div>

      {/* Barème des points */}
      {showBareme && (
        <div style={{ maxWidth: '500px', margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ background: '#fff', border: `0.5px solid ${accent}30`, borderRadius: '12px', padding: '1rem', margin: '12px 0 0' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: accent, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.04em' }}>📊 Barème des points</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              {[
                { icon: '👁️', label: 'Robe', detail: '300 pts si juste · 100 pts sinon' },
                { icon: '👃', label: 'Arômes', detail: '300 pts × nb joueurs même arôme · +300 pts si officiel' },
                { icon: '👄', label: 'Bouche', detail: '300 pts si juste · 100 pts sinon' },
                { icon: '🍇', label: 'Cépage', detail: '1 000 pts si juste · 200 pts sinon' },
                { icon: '📍', label: 'Région', detail: '500 pts si juste · 100 pts sinon' },
                { icon: '📅', label: 'Millésime', detail: '500 pts si juste · 100 pts sinon' },
                { icon: '🪣', label: 'Élevage', detail: '300 pts si juste · 100 pts sinon' },
                { icon: '💰', label: 'Prix', detail: '1 000 pts si exact · −100 pts par CHF d\'écart' },
                { icon: '💡', label: 'Aide', detail: '−100 pts par aide utilisée' },
              ].map(({ icon, label, detail }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '13px', flexShrink: 0 }}>{icon}</span>
                  <span style={{ fontWeight: '500', color: '#1a1a1a', minWidth: '70px' }}>{label}</span>
                  <span style={{ color: '#666' }}>{detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recap étapes précédentes */}
      {step > 0 && (
        <div style={{ maxWidth: '500px', margin: '0 auto', padding: '0.75rem 1.5rem 0' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {step > 0 && robe && (
              <span onClick={() => goStep(0)} style={{ cursor: 'pointer', fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#fff', border: '0.5px solid #e0e0e0', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="10" height="14" viewBox="0 0 48 67" fill="none">
                  <path d="M8 4 C8 4 4 20 4 28 C4 38 13 46 24 46 C35 46 44 38 44 28 C44 20 40 4 40 4 Z" fill="white" stroke="#e0e0e0" strokeWidth="3"/>
                  <path d="M7 28 C7 28 6 32 7 35 C9 41 16 46 24 46 C32 46 39 41 41 35 C42 32 41 28 41 28 Z" fill={ROBE_COLORS[robe] ?? '#ccc'}/>
                  <line x1="24" y1="46" x2="24" y2="60" stroke="#e0e0e0" strokeWidth="4"/>
                  <line x1="14" y1="60" x2="34" y2="60" stroke="#e0e0e0" strokeWidth="4" strokeLinecap="round"/>
                </svg>
                {robe}
              </span>
            )}
            {step > 1 && aromes.length > 0 && (
              <span onClick={() => goStep(1)} style={{ cursor: 'pointer', fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#fff', border: '0.5px solid #e0e0e0', color: '#666' }}>
                👃 {aromes.length} arôme{aromes.length > 1 ? 's' : ''}
              </span>
            )}
            {step > 2 && (
              <span onClick={() => goStep(2)} style={{ cursor: 'pointer', fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#fff', border: '0.5px solid #e0e0e0', color: '#666' }}>
                👄 {content.bouche[boucheIndex]}
              </span>
            )}
            {step > 3 && accord && (
              <span onClick={() => goStep(3)} style={{ cursor: 'pointer', fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#fff', border: '0.5px solid #e0e0e0', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {getAccordIcon(accord)
                  ? <img src={getAccordIcon(accord)!} alt={accord} style={{ width: '14px', height: '14px', objectFit: 'contain' }} />
                  : '🍴'}
                {accord}
              </span>
            )}
            {step > 4 && scorePerso !== null && (
              <span onClick={() => goStep(4)} style={{ cursor: 'pointer', fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#fff', border: '0.5px solid #e0e0e0', color: '#666' }}>
                {SCORE_EMOJIS[scorePerso]} {scorePerso}/10
              </span>
            )}
          </div>
        </div>
      )}

      <div style={{
        maxWidth: '500px', margin: '0 auto', padding: '1.5rem 1.5rem 6rem',
        opacity: animating ? 0 : 1,
        transform: animating ? `translateX(${slideDirection === 'left' ? '30px' : '-30px'})` : 'translateX(0)',
        transition: 'opacity .2s ease, transform .2s ease',
      }}>

        {/* En-tête étape */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            {stepIcons[step]}
          </div>
          <div>
            <div style={{ fontWeight: '500', fontSize: '18px', color: '#1a1a1a' }}>{steps[step]}</div>
            <div style={{ fontSize: '12px', color: '#888' }}>
              {step === 0 && 'Observe la couleur du vin'}
              {step === 1 && 'Fais tourner le verre et inspire'}
              {step === 2 && 'Garde le vin quelques secondes'}
              {step === 3 && 'Avec quoi tu boirais ce vin ?'}
              {step === 4 && 'Ton ressenti sans filtre'}
              {step === 5 && 'Montre ce que tu as dans le ventre !'}
            </div>
          </div>
        </div>

        {/* ÉTAPE 0 : VUE */}
        {step === 0 && (
          <>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
              {gifOpenStep === 0 && (
                <img src="/gif-vue.gif" alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} style={{ width: '100%', display: 'block' }} />
              )}
              <div style={{ padding: '1rem' }}>
                <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#555', lineHeight: 1.6 }}>
                  Un simple coup d'œil peut déjà te révéler plein d'indices : l'âge du vin, sa douceur ou même le type de cépage.
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ background: '#fffbf0', border: '0.5px solid #f0d080', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#7a5000', lineHeight: 1.5, flex: 1 }}>
                    💡 <strong>Astuce de pro :</strong> éclaire bien la pièce, place une feuille blanche derrière ton verre et incline-le légèrement… magie garantie ! ✨
                  </div>
                  <button onClick={() => setGifOpenStep(gifOpenStep === 0 ? null : 0)}
                    style={{ flexShrink: 0, padding: '6px 10px', background: gifOpenStep === 0 ? '#f0f0f0' : '#f5ede8', border: 'none', borderRadius: '8px', fontSize: '11px', color: gifOpenStep === 0 ? '#888' : accent, cursor: 'pointer', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    {gifOpenStep === 0 ? '✕ Fermer' : '▶ Voir'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>Un mot sur la robe ?</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>300 pts si juste · 100 pts sinon</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginBottom: '1.25rem' }}>
              {content.robes.map(r => {
                const selected = robe === r
                const robeColor = ROBE_COLORS[r] ?? '#ccc'
                return (
                  <div key={r} onClick={() => { setRobe(r); haptic() }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '10px', borderRadius: '12px', border: selected ? `2px solid ${accent}` : '0.5px solid #e0e0e0', background: selected ? '#fdf5f5' : '#fff', transition: 'all .15s ease', transform: selected ? 'scale(1.05)' : 'scale(1)', minWidth: '72px' }}>
                    <WineGlass color={robeColor} size={36} animate={selected} />
                    <span style={{ fontSize: '11px', fontWeight: selected ? '500' : '400', color: selected ? accent : '#666', textAlign: 'center', lineHeight: 1.2 }}>
                      {r}
                    </span>
                  </div>
                )
              })}
            </div>
            {robe && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#fff', border: `0.5px solid ${accent}30`, borderRadius: '12px' }}>
                <WineGlass color={ROBE_COLORS[robe] ?? '#ccc'} size={28} />
                <div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Robe sélectionnée</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: accent }}>{robe}</div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ÉTAPE 1 : NEZ */}
        {step === 1 && (
          <>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
              {gifOpenStep === 1 && (
                <img src="/gif-nez.gif" alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} style={{ width: '100%', display: 'block' }} />
              )}
              <div style={{ padding: '1rem' }}>
                <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#555', lineHeight: 1.6 }}>
                  C'est ton nez qui va révéler toute la palette d'arômes du vin.
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ background: '#fffbf0', border: '0.5px solid #f0d080', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#7a5000', lineHeight: 1.5, flex: 1 }}>
                    💡 <strong>Astuce :</strong> sens ton verre une première fois. Puis, fais-le tournoyer pour libérer ses arômes et sens-le à nouveau. Ce sont les fameux <strong>1er et 2ème nez</strong>.
                  </div>
                  <button onClick={() => setGifOpenStep(gifOpenStep === 1 ? null : 1)}
                    style={{ flexShrink: 0, padding: '6px 10px', background: gifOpenStep === 1 ? '#f0f0f0' : '#f5ede8', border: 'none', borderRadius: '8px', fontSize: '11px', color: gifOpenStep === 1 ? '#888' : accent, cursor: 'pointer', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    {gifOpenStep === 1 ? '✕ Fermer' : '▶ Voir'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>Intensité du nez</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>Discret</span>
                <input type="range" min={1} max={5} value={nezIntensite} onChange={e => setNezIntensite(Number(e.target.value))} style={{ flex: 1, accentColor: accent }} />
                <span style={{ fontSize: '12px', color: '#888' }}>Expressif</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: '13px', color: accent, marginTop: '6px', fontWeight: '500' }}>
                {['', 'Très discret', 'Discret', 'Moyen', 'Expressif', 'Très expressif'][nezIntensite]}
              </div>
            </div>
            <div>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>
                  Arômes perçus <span style={{ fontWeight: '400', color: '#888' }}>(max {MAX_AROMES}, tu en as {aromes.length})</span>
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>300 pts × nb joueurs ayant le même arôme · +300 pts si arôme officiel</div>
              </div>
              <HintBanner used={hintCounts.aromes} onUse={() => useHint('aromes')} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {content.aromes.map(a => {
                  const selected = aromes.includes(a)
                  const eliminated = eliminatedAromes.includes(a)
                  const disabled = eliminated || (!selected && aromes.length >= MAX_AROMES)
                  const icon = getAromeIcon(a)
                  return (
                    <button key={a} onClick={() => !eliminated && toggleArome(a)}
                      style={{
                        padding: '7px 12px', borderRadius: '20px', fontSize: '12px',
                        cursor: disabled ? 'default' : 'pointer',
                        border: selected ? 'none' : '0.5px solid #e0e0e0',
                        background: eliminated ? '#f5f5f5' : selected ? accent : '#fff',
                        color: eliminated ? '#ccc' : selected ? '#fff' : '#444',
                        opacity: (!eliminated && !selected && aromes.length >= MAX_AROMES) ? 0.35 : 1,
                        display: 'flex', alignItems: 'center', gap: '6px',
                        transition: 'transform .15s ease, box-shadow .15s ease',
                        transform: selected ? 'scale(1.05)' : 'scale(1)',
                        boxShadow: selected ? `0 2px 8px ${accent}40` : 'none',
                        textDecoration: eliminated ? 'line-through' : 'none',
                      }}>
                      {icon && (
                        <img src={icon} alt={a} style={{ width: '20px', height: '20px', objectFit: 'contain', filter: eliminated ? 'grayscale(1) opacity(0.3)' : selected ? 'brightness(0) invert(1)' : 'none', transition: 'filter .15s ease' }} />
                      )}
                      {a}
                    </button>
                  )
                })}
              </div>
              {aromes.length > 0 && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fff', border: `0.5px solid ${accent}30`, borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#888', width: '100%', marginBottom: '2px' }}>Tes arômes :</span>
                  {aromes.map(a => {
                    const icon = getAromeIcon(a)
                    return (
                      <span key={a} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', background: '#f5ede8', color: accent, padding: '4px 10px', borderRadius: '10px', fontWeight: '500' }}>
                        {icon && <img src={icon} alt={a} style={{ width: '16px', height: '16px', objectFit: 'contain' }} />}
                        {a}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ÉTAPE 2 : BOUCHE */}
        {step === 2 && (
          <>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.25rem' }}>
              {gifOpenStep === 2 && (
                <img src="/gif-bouche.gif" alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} style={{ width: '100%', display: 'block' }} />
              )}
              <div style={{ padding: '1rem' }}>
                <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#555', lineHeight: 1.6 }}>
                  C'est ici que tout s'anime : les saveurs (sucré, salé, acide, amer), mais aussi les sensations tactiles (alcool, fraîcheur, bulles, tanins). Après avoir avalé ou recraché, mesure la <strong>persistance</strong> : combien de temps le vin reste présent après la gorgée ? ⏳
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ background: '#fffbf0', border: '0.5px solid #f0d080', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#7a5000', lineHeight: 1.5, flex: 1 }}>
                    💡 <strong>Astuce :</strong> teste la rétro-olfaction ! Aspire légèrement de l'air avec le vin en bouche… et laisse exploser les arômes. 🚀
                  </div>
                  <button onClick={() => setGifOpenStep(gifOpenStep === 2 ? null : 2)}
                    style={{ flexShrink: 0, padding: '6px 10px', background: gifOpenStep === 2 ? '#f0f0f0' : '#f5ede8', border: 'none', borderRadius: '8px', fontSize: '11px', color: gifOpenStep === 2 ? '#888' : accent, cursor: 'pointer', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    {gifOpenStep === 2 ? '✕ Fermer' : '▶ Voir'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>Structure en bouche</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>300 pts si juste · 100 pts sinon</div>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                {content.bouche.map((opt, i) => (
                  <div key={i} style={{ textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center', flex: 1 }}>
                    <div style={{ fontSize: '11px', color: boucheIndex === i ? accent : '#aaa', fontWeight: boucheIndex === i ? '500' : '400', transition: 'color .2s' }}>
                      {opt.split(',')[0]}
                    </div>
                  </div>
                ))}
              </div>
              <input type="range" min={0} max={2} step={1} value={boucheIndex}
                onChange={e => { setBoucheIndex(Number(e.target.value)); haptic() }}
                style={{ width: '100%', accentColor: accent, height: '6px' }} />
              <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: '500', color: accent, marginTop: '12px', transition: 'all .2s' }}>
                {content.bouche[boucheIndex]}
              </div>
            </div>
          </>
        )}

        {/* ÉTAPE 3 : ACCORDS */}
        {step === 3 && (
          <>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
              💡 Quel plat mettrait ce vin en valeur ? Fais confiance à ton instinct !
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '12px' }}>
              Accord idéal <span style={{ fontWeight: '400', color: '#888' }}>(1 seul choix)</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
              {content.accords.map(a => {
                const selected = accord === a
                const icon = getAccordIcon(a)
                return (
                  <div key={a} onClick={() => { setAccord(accord === a ? null : a); haptic() }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '10px 12px', borderRadius: '12px', border: selected ? `2px solid ${accent}` : '0.5px solid #e0e0e0', background: selected ? '#fdf5f5' : '#fff', transition: 'all .15s ease', transform: selected ? 'scale(1.05)' : 'scale(1)', minWidth: '72px', boxShadow: selected ? `0 2px 8px ${accent}30` : 'none' }}>
                    {icon ? (
                      <img src={icon} alt={a} style={{ width: '40px', height: '40px', objectFit: 'contain', filter: selected ? `drop-shadow(0 0 4px ${accent}60)` : 'none', transition: 'filter .15s' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🍽</div>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: selected ? '500' : '400', color: selected ? accent : '#666', textAlign: 'center', lineHeight: 1.2, maxWidth: '72px' }}>
                      {a}
                    </span>
                  </div>
                )
              })}
            </div>
            {accord && (
              <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fff', border: `0.5px solid ${accent}30`, borderRadius: '12px', fontSize: '13px', color: accent, fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getAccordIcon(accord) && <img src={getAccordIcon(accord)!} alt={accord} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />}
                {accord}
              </div>
            )}
          </>
        )}

        {/* ÉTAPE 4 : NOTES PERSO */}
        {step === 4 && (
          <>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '12px' }}>Top ou flop ?</div>
              <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '12px', lineHeight: 1 }}>
                {scorePerso !== null ? SCORE_EMOJIS[scorePerso] : '🤔'}
              </div>
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} onClick={() => { setScorePerso(n); haptic(12) }}
                    style={{ width: '38px', height: '38px', borderRadius: '50%', fontSize: '13px', fontWeight: '500', cursor: 'pointer', border: scorePerso !== null && n <= scorePerso ? 'none' : '0.5px solid #e0e0e0', background: scorePerso === n ? accent : scorePerso !== null && n < scorePerso ? '#f5ede8' : '#fff', color: scorePerso === n ? '#fff' : scorePerso !== null && n < scorePerso ? accent : '#666', transition: 'all .15s ease', transform: scorePerso === n ? 'scale(1.15)' : 'scale(1)' }}>
                    {n}
                  </button>
                ))}
              </div>
              {scorePerso !== null && (
                <div style={{ textAlign: 'center', fontSize: '13px', color: '#888', marginTop: '10px' }}>
                  {SCORE_LABELS[scorePerso]}
                </div>
              )}
            </div>
            <div style={{ background: '#fffbf0', border: '0.5px solid #f0d080', borderRadius: '12px', padding: '12px 14px', fontSize: '12px', color: '#7a5000', lineHeight: 1.5 }}>
              💡 Tu pourras ajouter ton commentaire de dégustation une fois le vin révélé — quand tu sauras ce que tu avais dans le verre !
            </div>
          </>
        )}

        {/* ÉTAPE 5 : DEVINETTE */}
        {step === 5 && (
          <>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontSize: '13px', color: '#666' }}>
              💡 Pas de panique — c'est une intuition, pas un examen. Même les pros se plantent !
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>🍇 Cépage ?</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>1 000 pts si juste · 200 pts sinon</div>
              </div>
              <HintBanner used={hintCounts.cepage} onUse={() => useHint('cepage')} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                {content.cepages.map(c => {
                  const eliminated = eliminatedCepages.includes(c)
                  return (
                    <button key={c} onClick={() => { if (!eliminated) { setCepage(c); haptic() } }}
                      style={{ padding: '8px 14px', borderRadius: '20px', border: cepage === c ? 'none' : '0.5px solid #e0e0e0', background: eliminated ? '#f5f5f5' : cepage === c ? accent : '#fff', color: eliminated ? '#ccc' : cepage === c ? '#fff' : '#666', fontSize: '13px', cursor: eliminated ? 'default' : 'pointer', transition: 'all .15s', transform: cepage === c ? 'scale(1.05)' : 'scale(1)', textDecoration: eliminated ? 'line-through' : 'none' }}>
                      {c}
                    </button>
                  )
                })}
              </div>
              {cepage && CEPAGE_INFO[cepage] && (
                <div style={{ background: bg, border: `0.5px solid ${accent}30`, borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: accent, marginBottom: '8px' }}>📚 {cepage} — indices</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', color: '#444' }}>
                    <div><span style={{ color: '#888', fontWeight: '500' }}>Robe · </span>{CEPAGE_INFO[cepage].robe}</div>
                    <div><span style={{ color: '#888', fontWeight: '500' }}>Nez · </span>{CEPAGE_INFO[cepage].nez}</div>
                    <div><span style={{ color: '#888', fontWeight: '500' }}>Bouche · </span>{CEPAGE_INFO[cepage].bouche}</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>📍 Région ?</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>500 pts si juste · 100 pts sinon</div>
              </div>
              <HintBanner used={hintCounts.region} onUse={() => useHint('region')} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {content.regions.map(r => {
                  const eliminated = eliminatedRegions.includes(r)
                  return (
                    <button key={r} onClick={() => { if (!eliminated) { setRegion(r); haptic() } }}
                      style={{ padding: '8px 14px', borderRadius: '20px', border: region === r ? 'none' : '0.5px solid #e0e0e0', background: eliminated ? '#f5f5f5' : region === r ? accent : '#fff', color: eliminated ? '#ccc' : region === r ? '#fff' : '#666', fontSize: '13px', cursor: eliminated ? 'default' : 'pointer', transition: 'all .15s', transform: region === r ? 'scale(1.05)' : 'scale(1)', textDecoration: eliminated ? 'line-through' : 'none' }}>
                      {r}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>📅 Millésime ?</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>500 pts si juste · 100 pts sinon</div>
              </div>
              <input type="number" value={millesime} onChange={e => setMillesime(e.target.value)}
                placeholder="Ex: 2021" min={2000} max={2025}
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>🪣 Élevage ?</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>300 pts si juste · 100 pts sinon</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {ELEVAGE_OPTIONS.map(e => (
                  <button key={e} onClick={() => { setElevage(e); haptic() }}
                    style={{
                      padding: '8px 14px', borderRadius: '20px',
                      border: elevage === e ? 'none' : '0.5px solid #e0e0e0',
                      background: elevage === e ? accent : '#fff',
                      color: elevage === e ? '#fff' : '#666',
                      fontSize: '13px', cursor: 'pointer',
                      transition: 'all .15s',
                      transform: elevage === e ? 'scale(1.05)' : 'scale(1)',
                    }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>


            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '6px' }}>💰 Prix estimé ?</div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
                1 000 pts si exact · −100 pts par CHF d'écart
              </div>
              <input
                type="number"
                value={prix}
                onChange={e => setPrix(e.target.value)}
                placeholder="Ex: 24.50"
                min={0}
                step={0.5}
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </>
        )}

      </div>

      {/* Navigation */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '0.5px solid #e0e0e0', padding: '1rem 1.5rem' }}>
        {hintsUsed > 0 && (
          <div style={{ maxWidth: '500px', margin: '0 auto 8px', textAlign: 'center', fontSize: '11px', color: '#8a6000', background: '#fffbf0', borderRadius: '8px', padding: '4px 0' }}>
            💡 {hintsUsed} aide{hintsUsed > 1 ? 's' : ''} utilisée{hintsUsed > 1 ? 's' : ''} — malus : −{hintsUsed * 100} pts
          </div>
        )}
        {stepMissing && (
          <div style={{ maxWidth: '500px', margin: '0 auto 8px', textAlign: 'center', fontSize: '12px', color: '#c05020', background: '#fff5f0', border: '0.5px solid #f0c0a0', borderRadius: '8px', padding: '6px 0' }}>
            ⚠️ {stepMissing}
          </div>
        )}
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', gap: '10px' }}>
          {step > 0 && (
            <button onClick={() => goStep(step - 1)}
              style={{ flex: 1, padding: '12px', border: '0.5px solid #e0e0e0', borderRadius: '10px', background: '#fff', color: '#666', fontSize: '14px', cursor: 'pointer' }}>
              ← Retour
            </button>
          )}
          {step < steps.length - 1 ? (
            <button onClick={() => { if (stepValid) goStep(step + 1) }}
              disabled={!stepValid}
              style={{ flex: 2, padding: '12px', border: 'none', borderRadius: '10px', background: stepValid ? accent : '#d0c0c0', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: stepValid ? 'pointer' : 'default', transition: 'background .2s' }}>
              Continuer →
            </button>
          ) : (
            <button onClick={submitTasting} disabled={!stepValid || saving}
              style={{ flex: 2, padding: '12px', border: 'none', borderRadius: '10px', background: (!stepValid || saving) ? '#c0a0a0' : accent, color: '#fff', fontSize: '14px', fontWeight: '500', cursor: (!stepValid || saving) ? 'default' : 'pointer', transition: 'background .2s' }}>
              {saving ? 'Envoi...' : 'Soumettre ma dégustation 🍷'}
            </button>
          )}
        </div>
      </div>

    </div>
  )
}