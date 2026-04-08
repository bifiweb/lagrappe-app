'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { WINE_CONTENT, MAX_AROMES, PRIX_OPTIONS } from '@/types'
import { getAromeIcon } from '@/lib/arome-icons'
import { getAccordIcon } from '@/lib/accord-icons'
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

const SCORE_EMOJIS = ['😫','😞','😕','😐','🙂','😊','😋','😍','🤩','🏆','👑']
const SCORE_LABELS = ['Imbuvable','Très mauvais','Mauvais','Bof','Correct','Moyen','Bien','Très bien','Excellent','Sublime','Légendaire !']
const BOUCHE_OPTIONS = ['Léger, facile', 'Souple, équilibré', 'Puissant, corsé']

function WineGlass({ color, size = 48 }: { color: string, size?: number }) {
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 48 67" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Verre */}
      <path d="M8 4 C8 4 4 20 4 28 C4 38 13 46 24 46 C35 46 44 38 44 28 C44 20 40 4 40 4 Z" fill="white" stroke="#e0e0e0" strokeWidth="1.5"/>
      {/* Vin */}
      <path d="M7 28 C7 28 6 32 7 35 C9 41 16 46 24 46 C32 46 39 41 41 35 C42 32 41 28 41 28 Z" fill={color} opacity="0.85"/>
      {/* Pied */}
      <line x1="24" y1="46" x2="24" y2="60" stroke="#e0e0e0" strokeWidth="2"/>
      <line x1="14" y1="60" x2="34" y2="60" stroke="#e0e0e0" strokeWidth="2" strokeLinecap="round"/>
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

  const [robe, setRobe] = useState<string | null>(null)
  const [nezIntensite, setNezIntensite] = useState(3)
  const [aromes, setAromes] = useState<string[]>([])
  const [boucheIndex, setBoucheIndex] = useState(1)
  const [accord, setAccord] = useState<string | null>(null)
  const [prix, setPrix] = useState<string | null>(null)
  const [millesime, setMillesime] = useState('')
  const [cepage, setCepage] = useState<string | null>(null)
  const [region, setRegion] = useState<string | null>(null)
  const [scorePerso, setScorePerso] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const sessionId = params.id as string

  const steps = ['Vue', 'Nez', 'Bouche', 'Accords', 'Notes', 'Devinette']
  const stepIcons = ['👁', '👃', '👄', '🍽', '📝', '🔮']

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
    if (aromes.includes(a)) setAromes(aromes.filter(x => x !== a))
    else if (aromes.length < MAX_AROMES) setAromes([...aromes, a])
  }

  function goStep(n: number) {
    setAnimating(true)
    setTimeout(() => { setStep(n); setAnimating(false) }, 150)
  }

  async function submitTasting() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('tastings').upsert({
      session_id: sessionId,
      user_id: user.id,
      robe,
      nez_intensite: nezIntensite,
      aromes,
      bouche: BOUCHE_OPTIONS[boucheIndex],
      accords: accord ? [accord] : [],
      prix_estime: prix,
      millesime_estime: millesime ? parseInt(millesime) : null,
      cepage_guess: cepage,
      region_guess: region,
      score_perso: scorePerso,
      notes_libres: notes,
      submitted_at: new Date().toISOString(),
    })
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

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px' }}>🍷</span>
          </div>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>Bouteille #{session?.bottle_number}</span>
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

      {/* Recap étapes précédentes */}
      {step > 0 && (
        <div style={{ maxWidth: '500px', margin: '0 auto', padding: '0.75rem 1.5rem 0' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {step > 0 && robe && (
              <span onClick={() => goStep(0)} style={{ cursor: 'pointer', fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#fff', border: '0.5px solid #e0e0e0', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: ROBE_COLORS[robe] ?? '#ccc', display: 'inline-block', border: '0.5px solid rgba(0,0,0,0.1)' }} />
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
                👄 {BOUCHE_OPTIONS[boucheIndex]}
              </span>
            )}
            {step > 3 && accord && (
              <span onClick={() => goStep(3)} style={{ cursor: 'pointer', fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#fff', border: '0.5px solid #e0e0e0', color: '#666' }}>
                🍽 {accord}
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

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1.5rem 1.5rem 6rem', opacity: animating ? 0 : 1, transform: animating ? 'translateY(8px)' : 'translateY(0)', transition: 'opacity .15s, transform .15s' }}>

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
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
              💡 Incline le verre sur fond blanc. La teinte au bord révèle l'âge du vin.
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '12px' }}>Un mot sur la robe ?</div>

            {/* Verres de vin colorés */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginBottom: '1.25rem' }}>
              {content.robes.map(r => {
                const selected = robe === r
                const robeColor = ROBE_COLORS[r] ?? '#ccc'
                return (
                  <div key={r} onClick={() => setRobe(r)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '10px', borderRadius: '12px', border: selected ? `2px solid ${accent}` : '0.5px solid #e0e0e0', background: selected ? '#fdf5f5' : '#fff', transition: 'all .15s ease', transform: selected ? 'scale(1.05)' : 'scale(1)', minWidth: '72px' }}>
                    <WineGlass color={robeColor} size={36} />
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
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
              💡 Commence sans agiter, puis fais tourner. Tu perçois d'abord les arômes primaires.
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
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '6px' }}>
                Arômes perçus <span style={{ fontWeight: '400', color: '#888' }}>(max {MAX_AROMES}, tu en as {aromes.length})</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {content.aromes.map(a => {
                  const selected = aromes.includes(a)
                  const disabled = !selected && aromes.length >= MAX_AROMES
                  const icon = getAromeIcon(a)
                  return (
                    <button key={a} onClick={() => toggleArome(a)}
                      style={{ padding: '7px 12px', borderRadius: '20px', fontSize: '12px', cursor: disabled ? 'default' : 'pointer', border: selected ? 'none' : '0.5px solid #e0e0e0', background: selected ? accent : '#fff', color: selected ? '#fff' : '#444', opacity: disabled ? 0.35 : 1, display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform .15s ease, box-shadow .15s ease', transform: selected ? 'scale(1.05)' : 'scale(1)', boxShadow: selected ? `0 2px 8px ${accent}40` : 'none' }}>
                      {icon && <img src={icon} alt={a} style={{ width: '20px', height: '20px', objectFit: 'contain', filter: selected ? 'brightness(0) invert(1)' : 'none', transition: 'filter .15s ease' }} />}
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
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
              💡 L'acidité picote les côtés de la langue, les tanins assèchent les gencives, le gras enrobe.
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '16px' }}>Structure en bouche</div>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                {BOUCHE_OPTIONS.map((opt, i) => (
                  <div key={i} style={{ textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center', flex: 1 }}>
                    <div style={{ fontSize: '11px', color: boucheIndex === i ? accent : '#aaa', fontWeight: boucheIndex === i ? '500' : '400', transition: 'color .2s' }}>
                      {opt.split(',')[0]}
                    </div>
                  </div>
                ))}
              </div>
              <input type="range" min={0} max={2} step={1} value={boucheIndex} onChange={e => setBoucheIndex(Number(e.target.value))} style={{ width: '100%', accentColor: accent, height: '6px' }} />
              <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: '500', color: accent, marginTop: '12px', transition: 'all .2s' }}>
                {BOUCHE_OPTIONS[boucheIndex]}
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
                  <div key={a} onClick={() => setAccord(accord === a ? null : a)}
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
              <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '12px', transition: 'transform .2s', lineHeight: 1 }}>
                {scorePerso !== null ? SCORE_EMOJIS[scorePerso] : '🤔'}
              </div>
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} onClick={() => setScorePerso(n)}
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
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '8px' }}>Notes libres</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Décris ce que tu ressens... tanins soyeux, finale longue..."
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: '13px', color: '#444', resize: 'none', minHeight: '80px', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box' }} />
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
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>🍇 Cépage ?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {content.cepages.map(c => (
                  <button key={c} onClick={() => setCepage(c)}
                    style={{ padding: '8px 14px', borderRadius: '20px', border: cepage === c ? 'none' : '0.5px solid #e0e0e0', background: cepage === c ? accent : '#fff', color: cepage === c ? '#fff' : '#666', fontSize: '13px', cursor: 'pointer', transition: 'all .15s', transform: cepage === c ? 'scale(1.05)' : 'scale(1)' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>📍 Région ?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {content.regions.map(r => (
                  <button key={r} onClick={() => setRegion(r)}
                    style={{ padding: '8px 14px', borderRadius: '20px', border: region === r ? 'none' : '0.5px solid #e0e0e0', background: region === r ? accent : '#fff', color: region === r ? '#fff' : '#666', fontSize: '13px', cursor: 'pointer', transition: 'all .15s', transform: region === r ? 'scale(1.05)' : 'scale(1)' }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>📅 Millésime ?</div>
              <input type="number" value={millesime} onChange={e => setMillesime(e.target.value)}
                placeholder="Ex: 2021" min={2000} max={2025}
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>💰 Prix estimé ?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PRIX_OPTIONS.map(p => (
                  <button key={p} onClick={() => setPrix(p)}
                    style={{ padding: '8px 14px', borderRadius: '20px', border: prix === p ? 'none' : '0.5px solid #e0e0e0', background: prix === p ? accent : '#fff', color: prix === p ? '#fff' : '#666', fontSize: '13px', cursor: 'pointer', transition: 'all .15s', transform: prix === p ? 'scale(1.05)' : 'scale(1)' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

      </div>

      {/* Navigation */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '0.5px solid #e0e0e0', padding: '1rem 1.5rem' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', gap: '10px' }}>
          {step > 0 && (
            <button onClick={() => goStep(step - 1)}
              style={{ flex: 1, padding: '12px', border: '0.5px solid #e0e0e0', borderRadius: '10px', background: '#fff', color: '#666', fontSize: '14px', cursor: 'pointer' }}>
              ← Retour
            </button>
          )}
          {step < steps.length - 1 ? (
            <button onClick={() => goStep(step + 1)}
              style={{ flex: 2, padding: '12px', border: 'none', borderRadius: '10px', background: accent, color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
              Continuer →
            </button>
          ) : (
            <button onClick={submitTasting} disabled={saving}
              style={{ flex: 2, padding: '12px', border: 'none', borderRadius: '10px', background: saving ? '#c0a0a0' : accent, color: '#fff', fontSize: '14px', fontWeight: '500', cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Envoi...' : 'Soumettre ma dégustation 🍷'}
            </button>
          )}
        </div>
      </div>

    </div>
  )
}