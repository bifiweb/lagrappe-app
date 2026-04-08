'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { WINE_CONTENT, MAX_AROMES, PRIX_OPTIONS } from '@/types'
import { getAromeIcon } from '@/lib/arome-icons'
import type { Session, Wine } from '@/types'


export default function TastingPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [wine, setWine] = useState<Wine | null>(null)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Fiche de dégustation
  const [robe, setRobe] = useState<string | null>(null)
  const [nezIntensite, setNezIntensite] = useState(3)
  const [aromes, setAromes] = useState<string[]>([])
  const [bouche, setBouche] = useState<string | null>(null)
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

  const steps = ['Vue', 'Nez', 'Bouche', 'Notes', 'Devinette']

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: sess } = await supabase
        .from('sessions').select('*').eq('id', sessionId).single()
      setSession(sess)

      if (sess) {
        const { data: w } = await supabase
          .from('wines').select('*').eq('id', sess.wine_id).single()
        setWine(w)
      }
      setLoading(false)
    }
    load()
  }, [])

  function toggleArome(a: string) {
    if (aromes.includes(a)) {
      setAromes(aromes.filter(x => x !== a))
    } else if (aromes.length < MAX_AROMES) {
      setAromes([...aromes, a])
    }
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
      bouche,
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
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>
            Bouteille #{session?.bottle_number}
          </span>
          <span style={{ fontSize: '13px', color: '#888' }}>
            {step + 1} / {steps.length}
          </span>
        </div>
        {/* Barre de progression */}
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', gap: '4px', paddingBottom: '12px' }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= step ? accent : '#e0e0e0', transition: 'background .3s' }} />
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1.5rem 1.5rem 6rem' }}>

        {/* ÉTAPE 0 : VUE */}
        {step === 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👁</div>
              <div>
                <div style={{ fontWeight: '500', fontSize: '18px', color: '#1a1a1a' }}>Vue</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Observe la couleur du vin</div>
              </div>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
              💡 Incline le verre sur fond blanc. La teinte au bord révèle l'âge du vin.
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>Un mot sur la robe ?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {content.robes.map(r => (
                  <button key={r} onClick={() => setRobe(r)}
                    style={{ padding: '8px 16px', borderRadius: '20px', border: robe === r ? 'none' : '0.5px solid #e0e0e0', background: robe === r ? accent : '#fff', color: robe === r ? '#fff' : '#666', fontSize: '13px', cursor: 'pointer' }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ÉTAPE 1 : NEZ */}
        {step === 1 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👃</div>
              <div>
                <div style={{ fontWeight: '500', fontSize: '18px', color: '#1a1a1a' }}>Nez</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Fais tourner le verre et inspire</div>
              </div>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
              💡 Commence sans agiter, puis fais tourner. Tu perçois d'abord les arômes primaires.
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>Intensité du nez</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>Discret</span>
                <input type="range" min={1} max={5} value={nezIntensite} onChange={e => setNezIntensite(Number(e.target.value))} style={{ flex: 1 }} />
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
                      style={{
                        padding: '7px 12px', borderRadius: '20px', fontSize: '12px',
                        cursor: disabled ? 'default' : 'pointer',
                        border: selected ? 'none' : '0.5px solid #e0e0e0',
                        background: selected ? accent : '#fff',
                        color: selected ? '#fff' : '#444',
                        opacity: disabled ? 0.35 : 1,
                        display: 'flex', alignItems: 'center', gap: '6px',
                        transition: 'transform .15s ease, box-shadow .15s ease',
                        transform: selected ? 'scale(1.05)' : 'scale(1)',
                        boxShadow: selected ? `0 2px 8px ${accent}40` : 'none',
                      }}>
                      {icon && (
                        <img src={icon} alt={a}
                          style={{
                            width: '20px', height: '20px', objectFit: 'contain',
                            filter: selected ? 'brightness(0) invert(1)' : 'none',
                            transition: 'filter .15s ease',
                          }} />
                      )}
                      {a}
                    </button>
                  )
                })}
              </div>

              {/* Recap arômes sélectionnés */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👄</div>
              <div>
                <div style={{ fontWeight: '500', fontSize: '18px', color: '#1a1a1a' }}>Bouche</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Garde le vin quelques secondes</div>
              </div>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
              💡 L'acidité picote les côtés de la langue, les tanins assèchent les gencives, le gras enrobe.
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>Structure en bouche</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {content.bouche.map(b => (
                  <button key={b} onClick={() => setBouche(b)}
                    style={{ padding: '8px 16px', borderRadius: '20px', border: bouche === b ? 'none' : '0.5px solid #e0e0e0', background: bouche === b ? accent : '#fff', color: bouche === b ? '#fff' : '#666', fontSize: '13px', cursor: 'pointer' }}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '6px' }}>
                Accord idéal <span style={{ fontWeight: '400', color: '#888' }}>(1 seul choix)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {content.accords.map(a => (
                  <button key={a} onClick={() => setAccord(accord === a ? null : a)}
                    style={{
                      padding: '6px 12px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer',
                      border: accord === a ? 'none' : '0.5px solid #e0e0e0',
                      background: accord === a ? accent : '#fff',
                      color: accord === a ? '#fff' : '#666',
                    }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ÉTAPE 3 : NOTES PERSO */}
        {step === 3 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📝</div>
              <div>
                <div style={{ fontWeight: '500', fontSize: '18px', color: '#1a1a1a' }}>Notes perso</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Ton ressenti sans filtre</div>
              </div>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>Top ou flop ? (0–10)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} onClick={() => setScorePerso(n)}
                    style={{ width: '40px', height: '40px', borderRadius: '8px', border: scorePerso === n ? 'none' : '0.5px solid #e0e0e0', background: scorePerso === n ? accent : '#fff', color: scorePerso === n ? '#fff' : '#666', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '8px' }}>Notes libres</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Décris ce que tu ressens... tanins soyeux, finale longue..."
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: '13px', color: '#444', resize: 'none', minHeight: '80px', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box' }} />
            </div>
          </>
        )}

        {/* ÉTAPE 4 : DEVINETTE */}
        {step === 4 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🔮</div>
              <div>
                <div style={{ fontWeight: '500', fontSize: '18px', color: '#1a1a1a' }}>Ta devinette</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Montre ce que tu as dans le ventre !</div>
              </div>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontSize: '13px', color: '#666' }}>
              💡 Pas de panique — c'est une intuition, pas un examen. Même les pros se plantent !
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>Cépage ?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {content.cepages.map(c => (
                  <button key={c} onClick={() => setCepage(c)}
                    style={{ padding: '8px 14px', borderRadius: '20px', border: cepage === c ? 'none' : '0.5px solid #e0e0e0', background: cepage === c ? accent : '#fff', color: cepage === c ? '#fff' : '#666', fontSize: '13px', cursor: 'pointer' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>Région ?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {content.regions.map(r => (
                  <button key={r} onClick={() => setRegion(r)}
                    style={{ padding: '8px 14px', borderRadius: '20px', border: region === r ? 'none' : '0.5px solid #e0e0e0', background: region === r ? accent : '#fff', color: region === r ? '#fff' : '#666', fontSize: '13px', cursor: 'pointer' }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>Millésime ?</div>
              <input type="number" value={millesime} onChange={e => setMillesime(e.target.value)}
                placeholder="Ex: 2021" min={2000} max={2025}
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '10px' }}>Prix estimé ?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PRIX_OPTIONS.map(p => (
                  <button key={p} onClick={() => setPrix(p)}
                    style={{ padding: '8px 14px', borderRadius: '20px', border: prix === p ? 'none' : '0.5px solid #e0e0e0', background: prix === p ? accent : '#fff', color: prix === p ? '#fff' : '#666', fontSize: '13px', cursor: 'pointer' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

      </div>

      {/* Navigation fixe en bas */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '0.5px solid #e0e0e0', padding: '1rem 1.5rem' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', gap: '10px' }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}
              style={{ flex: 1, padding: '12px', border: '0.5px solid #e0e0e0', borderRadius: '10px', background: '#fff', color: '#666', fontSize: '14px', cursor: 'pointer' }}>
              ← Retour
            </button>
          )}
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(step + 1)}
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