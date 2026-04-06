'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { WINE_CONTENT } from '@/types'
import type { Wine, GrappisteNotes, Project } from '@/types'

interface WineWithNotes extends Wine {
  grappiste_notes: GrappisteNotes | null
}

const PRICE_RANGES = [
  { label: '< 20 CHF', min: 0, max: 19.99 },
  { label: '20 – 25 CHF', min: 20, max: 25 },
  { label: '26 – 30 CHF', min: 26, max: 30 },
  { label: '31 – 40 CHF', min: 31, max: 40 },
  { label: '> 40 CHF', min: 40.01, max: Infinity },
]

function getPriceRange(prix: number): string {
  const range = PRICE_RANGES.find(r => prix >= r.min && prix <= r.max)
  return range?.label ?? '—'
}

function SelectButtons({ options, value, onChange, accent = '#8d323b' }: {
  options: string[], value: string, onChange: (v: string) => void, accent?: string
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(value === opt ? '' : opt)}
          style={{
            padding: '5px 10px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer',
            border: value === opt ? 'none' : '0.5px solid #e0e0e0',
            background: value === opt ? accent : '#fff',
            color: value === opt ? '#fff' : '#666',
          }}>
          {opt}
        </button>
      ))}
    </div>
  )
}

function MultiButtons({ options, values, onChange, accent = '#8d323b' }: {
  options: string[], values: string[], onChange: (v: string[]) => void, accent?: string
}) {
  function toggle(opt: string) {
    if (values.includes(opt)) onChange(values.filter(v => v !== opt))
    else onChange([...values, opt])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map(opt => (
        <button key={opt} onClick={() => toggle(opt)}
          style={{
            padding: '5px 10px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer',
            border: values.includes(opt) ? 'none' : '0.5px solid #e0e0e0',
            background: values.includes(opt) ? accent : '#fff',
            color: values.includes(opt) ? '#fff' : '#666',
          }}>
          {opt}
        </button>
      ))}
    </div>
  )
}

export default function AdminWinesPage() {
  const [project, setProject] = useState<Project | null>(null)
  const [wines, setWines] = useState<WineWithNotes[]>([])
  const [loading, setLoading] = useState(true)
  const [editingWine, setEditingWine] = useState<WineWithNotes | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [note, setNote] = useState('')
  const [description, setDescription] = useState('')
  const [robe, setRobe] = useState('')
  const [aromes, setAromes] = useState<string[]>([])
  const [bouche, setBouche] = useState('')
  const [cepage, setCepage] = useState('')
  const [region, setRegion] = useState('')
  const [millesime, setMillesime] = useState('')
  const [prixExact, setPrixExact] = useState('')
  const [cave, setCave] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [shopifyUrl, setShopifyUrl] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/app/dashboard'); return }

      const { data: proj } = await supabase
        .from('projects').select('*').eq('slug', 'swiss-wine-challenge').single()
      setProject(proj)

      if (proj) {
        const { data: w } = await supabase
          .from('wines')
          .select('*, grappiste_notes(*)')
          .eq('project_id', proj.id)
          .order('bottle_number')
        setWines((w as WineWithNotes[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  function openEdit(wine: WineWithNotes) {
    setEditingWine(wine)
    const n = wine.grappiste_notes
    setNote(n?.note?.toString() ?? '')
    setDescription(n?.description ?? '')
    setRobe(n?.robe ?? '')
    setAromes(n?.aromes_officiels ?? [])
    setBouche(n?.bouche ?? '')
    setCepage(n?.cepage ?? '')
    setRegion(n?.region ?? '')
    setMillesime(n?.millesime?.toString() ?? '')
    setPrixExact(n?.prix_exact?.toString() ?? '')
    setCave(n?.cave ?? '')
    setImageUrl(n?.image_url ?? '')
    setShopifyUrl(wine.shopify_url ?? '')
    setSuccess(false)
  }

  async function saveWine() {
    if (!editingWine) return
    setSaving(true)

    await supabase.from('wines')
      .update({ shopify_url: shopifyUrl })
      .eq('id', editingWine.id)

    const prixNum = parseFloat(prixExact)

    await supabase.from('grappiste_notes').upsert({
      wine_id: editingWine.id,
      note: parseFloat(note),
      description,
      robe,
      aromes_officiels: aromes,
      bouche,
      cepage,
      region,
      millesime: millesime ? parseInt(millesime) : null,
      prix_chf: isNaN(prixNum) ? null : getPriceRange(prixNum),
      prix_exact: isNaN(prixNum) ? null : prixNum,
      cave,
      image_url: imageUrl,
    }, { onConflict: 'wine_id' })

    const { data: w } = await supabase
      .from('wines')
      .select('*, grappiste_notes(*)')
      .eq('project_id', project!.id)
      .order('bottle_number')
    setWines((w as WineWithNotes[]) ?? [])
    setSaving(false)
    setSuccess(true)
  }

  async function toggleReveal(wine: WineWithNotes) {
    await supabase.from('wines')
      .update({ revealed: !wine.revealed })
      .eq('id', wine.id)
    setWines(wines.map(w => w.id === wine.id ? { ...w, revealed: !w.revealed } : w))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  const wineType = editingWine?.type ?? 'rouge'
  const content = WINE_CONTENT[wineType]
  const accent = '#8d323b'

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>Gestion des vins</span>
          <span style={{ fontSize: '11px', background: '#faeeda', color: '#633806', padding: '3px 10px', borderRadius: '10px', fontWeight: '500' }}>Admin</span>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem', display: 'grid', gridTemplateColumns: editingWine ? '280px 1fr' : '1fr', gap: '1rem' }}>

        {/* Liste des vins */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '12px' }}>
            {project?.name} — {wines.length} vins
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {wines.map(wine => (
              <div key={wine.id}
                onClick={() => openEdit(wine)}
                style={{
                  background: '#fff',
                  border: editingWine?.id === wine.id ? '2px solid #8d323b' : '0.5px solid #e0e0e0',
                  borderRadius: '12px', padding: '12px 14px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                {wine.grappiste_notes?.image_url ? (
                  <img src={wine.grappiste_notes.image_url} alt=""
                    style={{ width: '36px', height: '48px', borderRadius: '6px', objectFit: 'contain', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: wine.type === 'rouge' ? '#f5ede8' : '#f5f3e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500', fontSize: '16px', color: '#8d323b', flexShrink: 0 }}>
                    {wine.bottle_number}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>
                    {wine.grappiste_notes?.cepage ? `${wine.grappiste_notes.cepage} ${wine.grappiste_notes.millesime ?? ''}` : `Bouteille #${wine.bottle_number}`}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {wine.type}
                    {wine.grappiste_notes?.cave ? ` · ${wine.grappiste_notes.cave}` : ''}
                    {wine.grappiste_notes?.region ? ` · ${wine.grappiste_notes.region}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {wine.grappiste_notes && (
                    <span style={{ fontSize: '10px', background: '#e8f0e8', color: '#27500A', padding: '2px 7px', borderRadius: '6px' }}>✓</span>
                  )}
                  <span onClick={e => { e.stopPropagation(); toggleReveal(wine) }}
                    style={{ fontSize: '10px', background: wine.revealed ? '#faeeda' : '#f5f5f5', color: wine.revealed ? '#633806' : '#888', padding: '2px 7px', borderRadius: '6px', cursor: 'pointer' }}>
                    {wine.revealed ? 'Révélé' : 'Masqué'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Formulaire d'édition */}
        {editingWine && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '1rem' }}>
              Bouteille #{editingWine.bottle_number} — {editingWine.type}
            </div>

            {success && (
              <div style={{ background: '#e8f0e8', color: '#27500A', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '1rem' }}>
                ✓ Sauvegardé !
              </div>
            )}

            {/* Cave */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Cave / Domaine</label>
              <input value={cave} onChange={e => setCave(e.target.value)} placeholder="ex: Domaine de la Cure"
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Cépage */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Cépage</label>
              <SelectButtons options={content.cepages} value={cepage} onChange={setCepage} accent={accent} />
            </div>

            {/* Région */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Région</label>
              <SelectButtons options={content.regions.filter(r => r !== 'Je sais pas')} value={region} onChange={setRegion} accent={accent} />
            </div>

            {/* Robe */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Robe</label>
              <SelectButtons options={content.robes} value={robe} onChange={setRobe} accent={accent} />
            </div>

            {/* Bouche */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Bouche</label>
              <SelectButtons options={content.bouche} value={bouche} onChange={setBouche} accent={accent} />
            </div>

            {/* Arômes officiels */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>
                Arômes officiels <span style={{ fontWeight: '400', color: '#aaa' }}>({aromes.length} sélectionnés)</span>
              </label>
              <MultiButtons options={content.aromes} values={aromes} onChange={setAromes} accent={accent} />
            </div>

            {/* Millésime */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Millésime</label>
              <input value={millesime} onChange={e => setMillesime(e.target.value)} placeholder="ex: 2021" type="number"
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Note */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Note /10</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="ex: 9.1" type="number" step="0.1" min="0" max="10"
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Prix exact */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Prix exact CHF</label>
              <input value={prixExact} onChange={e => setPrixExact(e.target.value)} placeholder="ex: 28.50" type="number" step="0.5"
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
              {prixExact && !isNaN(parseFloat(prixExact)) && (
                <div style={{ fontSize: '11px', color: accent, marginTop: '4px' }}>
                  → Fourchette : {getPriceRange(parseFloat(prixExact))}
                </div>
              )}
            </div>

            {/* Image URL */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Image URL</label>
              <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://cdn.shopify.com/..."
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
              {imageUrl && (
                <img src={imageUrl} alt="Aperçu" style={{ maxHeight: '80px', marginTop: '8px', borderRadius: '6px', objectFit: 'contain' }} />
              )}
            </div>

            {/* Lien Shopify */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Lien Shopify</label>
              <input value={shopifyUrl} onChange={e => setShopifyUrl(e.target.value)} placeholder="https://lagrappe.ch/..."
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Description */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Notes de dégustation officielles..."
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', resize: 'none', minHeight: '80px', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditingWine(null)}
                style={{ flex: 1, padding: '10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={saveWine} disabled={saving}
                style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '8px', background: saving ? '#c0a0a0' : accent, color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}