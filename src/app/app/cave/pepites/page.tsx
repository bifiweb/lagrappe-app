'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'

interface WineEntry {
  wine: any
  notes: any
  myRating: any | null
  avgStars: number | null
  ratingCount: number
}

const accent = '#8d323b'

function StarPicker({ value, onChange }: { value: number, onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i}
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '24px', lineHeight: 1 }}>
          {display >= i ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

function MiniStars({ stars }: { stars: number }) {
  return (
    <div style={{ display: 'flex', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: '12px', color: stars >= i ? '#f0a000' : '#ddd' }}>★</span>
      ))}
    </div>
  )
}

export default function CavePepitesPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [entries, setEntries] = useState<WineEntry[]>([])
  const [filtered, setFiltered] = useState<WineEntry[]>([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [formStars, setFormStars] = useState(0)
  const [formNotesDeg, setFormNotesDeg] = useState('')
  const [formDesign, setFormDesign] = useState(0)
  const [formValeur, setFormValeur] = useState(0)
  const [formRachete, setFormRachete] = useState<boolean | null>(null)
  const [formNotes, setFormNotes] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: wines } = await supabase
        .from('wines').select('*').eq('revealed', true)

      if (!wines?.length) { setLoading(false); return }

      const wineIds = wines.map(w => w.id)

      const { data: allNotes } = await supabase
        .from('grappiste_notes').select('*').in('wine_id', wineIds)

      const { data: myRatings } = await supabase
        .from('cave_ratings').select('*').eq('user_id', user.id).in('wine_id', wineIds)

      const result: WineEntry[] = wines
        .map(wine => {
          const notes = allNotes?.find(n => n.wine_id === wine.id) ?? null
          if (!notes) return null
          const myRating = myRatings?.find(r => r.wine_id === wine.id) ?? null
          return { wine, notes, myRating, avgStars: null, ratingCount: 0 }
        })
        .filter(Boolean) as WineEntry[]

      setEntries(result)
      setFiltered(result)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!search.trim()) { setFiltered(entries); return }
    const q = search.toLowerCase()
    setFiltered(entries.filter(e =>
      e.notes?.cepage?.toLowerCase().includes(q) ||
      e.notes?.region?.toLowerCase().includes(q) ||
      e.notes?.millesime?.toString().includes(q) ||
      e.notes?.description?.toLowerCase().includes(q)
    ))
  }, [search, entries])

  function openRating(entry: WineEntry) {
    const id = entry.wine.id
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    const r = entry.myRating
    setFormStars(r?.stars ?? 0)
    setFormNotesDeg(r?.notes_degustation ?? '')
    setFormDesign(r?.design_rating ?? 0)
    setFormValeur(r?.valeur_rating ?? 0)
    setFormRachete(r?.racheterait ?? null)
    setFormNotes(r?.notes_libres ?? '')
  }

  async function saveRating(wineId: string) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('cave_ratings').upsert({
      wine_id: wineId,
      user_id: user.id,
      stars: formStars,
      notes_degustation: formNotesDeg || null,
      design_rating: formDesign || null,
      valeur_rating: formValeur || null,
      racheterait: formRachete,
      notes_libres: formNotes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'wine_id,user_id' })

    setEntries(prev => prev.map(e => e.wine.id === wineId ? {
      ...e,
      myRating: { stars: formStars, notes_degustation: formNotesDeg, design_rating: formDesign, valeur_rating: formValeur, racheterait: formRachete, notes_libres: formNotes }
    } : e))

    setSaving(false)
    setExpanded(null)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  const ratedCount = entries.filter(e => e.myRating).length

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/cave')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>La cave à pépites</span>
          <span style={{ fontSize: '12px', color: '#888' }}>{ratedCount}/{entries.length} notés</span>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1rem 1.5rem' }}>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#aaa' }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cépage, région, millésime..."
            style={{ width: '100%', padding: '10px 12px 10px 36px', border: '0.5px solid #e0e0e0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
          />
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
            <div>Aucun vin trouvé</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(entry => {
              const { wine, notes, myRating } = entry
              const isOpen = expanded === wine.id

              return (
                <div key={wine.id} style={{ background: '#fff', border: `0.5px solid ${isOpen ? accent : '#e0e0e0'}`, borderRadius: '16px', overflow: 'hidden', transition: 'border-color .2s' }}>

                  {/* Carte */}
                  <div onClick={() => openRating(entry)}
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'center' }}>
                    {notes?.image_url ? (
                      <img src={notes.image_url} alt=""
                        style={{ width: '44px', height: '66px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '44px', height: '66px', borderRadius: '8px', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>🍾</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '500', fontSize: '15px', color: '#1a1a1a', marginBottom: '2px' }}>
                        {notes?.cepage} {notes?.millesime}
                      </div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>{notes?.region}</div>
                      {myRating ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MiniStars stars={myRating.stars} />
                          <span style={{ fontSize: '11px', color: '#888' }}>{myRating.stars}/5</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>Non noté — cliquer pour noter</span>
                      )}
                    </div>
                    <div style={{ fontSize: '16px', color: '#ccc' }}>{isOpen ? '▲' : '▼'}</div>
                  </div>

                  {/* Formulaire de rating */}
                  {isOpen && (
                    <div style={{ borderTop: '0.5px solid #f0f0f0', padding: '1.25rem', background: '#fdf8f5' }}>

                      {notes?.description && (
                        <div style={{ fontSize: '13px', color: '#666', fontStyle: 'italic', marginBottom: '1rem', lineHeight: '1.5' }}>
                          {notes.description}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.25rem' }}>
                        {notes?.cepage && <span style={{ fontSize: '12px', background: '#f5ede8', color: accent, padding: '3px 10px', borderRadius: '8px' }}>{notes.cepage}</span>}
                        {notes?.region && <span style={{ fontSize: '12px', background: '#f0f0f0', color: '#555', padding: '3px 10px', borderRadius: '8px' }}>{notes.region}</span>}
                        {notes?.prix_chf && <span style={{ fontSize: '12px', background: '#e8f0e8', color: '#27500A', padding: '3px 10px', borderRadius: '8px' }}>CHF {notes.prix_chf}</span>}
                      </div>

                      {/* Note globale */}
                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '8px' }}>Note globale</label>
                        <StarPicker value={formStars} onChange={setFormStars} />
                      </div>

                      {/* Notes de dégustation */}
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Notes de dégustation</label>
                        <textarea value={formNotesDeg} onChange={e => setFormNotesDeg(e.target.value)}
                          placeholder="Robe, arômes, bouche..."
                          style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', resize: 'none', minHeight: '72px', fontFamily: 'system-ui', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                      </div>

                      {/* Design & Valeur */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Design bouteille</label>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {[1, 2, 3, 4, 5].map(i => (
                              <button key={i} onClick={() => setFormDesign(i)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '2px', lineHeight: 1 }}>
                                {formDesign >= i ? '★' : '☆'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Qualité/prix</label>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {[1, 2, 3, 4, 5].map(i => (
                              <button key={i} onClick={() => setFormValeur(i)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '2px', lineHeight: 1 }}>
                                {formValeur >= i ? '★' : '☆'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Rachèterait */}
                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '8px' }}>Tu le rachèterais ?</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[{ v: true, l: '✅ Oui' }, { v: false, l: '❌ Non' }].map(({ v, l }) => (
                            <button key={String(v)} onClick={() => setFormRachete(v)}
                              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: formRachete === v ? `2px solid ${accent}` : '0.5px solid #e0e0e0', background: formRachete === v ? '#fdf5f5' : '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Notes libres */}
                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Commentaire libre</label>
                        <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)}
                          placeholder="Accord mets, occasion parfaite..."
                          style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', resize: 'none', minHeight: '56px', fontFamily: 'system-ui', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setExpanded(null)}
                          style={{ flex: 1, padding: '10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
                          Annuler
                        </button>
                        <button onClick={() => saveRating(wine.id)} disabled={saving || formStars === 0}
                          style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '8px', background: saving || formStars === 0 ? '#c0a0a0' : accent, color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving || formStars === 0 ? 'default' : 'pointer' }}>
                          {saving ? 'Sauvegarde...' : myRating ? 'Mettre à jour' : 'Enregistrer ma note'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
