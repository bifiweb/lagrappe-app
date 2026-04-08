'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { WINE_CONTENT, ELEVAGE_OPTIONS } from '@/types'
import type { Wine, GrappisteNotes, Project, WineType } from '@/types'

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

const WINE_TYPE_LABELS: Record<WineType, string> = {
  rouge: '🔴 Rouge',
  blanc: '⚪ Blanc',
  rose: '🌸 Rosé',
  petillant: '🫧 Pétillant',
}

export default function AdminWinesPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [wines, setWines] = useState<WineWithNotes[]>([])
  const [loading, setLoading] = useState(true)
  const [editingWine, setEditingWine] = useState<WineWithNotes | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [wineType, setWineType] = useState<WineType>('rouge')
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
  const [elevage, setElevage] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [shopifyUrl, setShopifyUrl] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/app/dashboard'); return }

      const { data: projs } = await supabase
        .from('projects').select('*').order('created_at')
      setProjects(projs ?? [])

      // Sélectionner le premier projet par défaut
      if (projs?.length) {
        const first = projs[0]
        setSelectedProject(first)
        await loadWines(first.id)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function loadWines(projectId: string) {
    const { data: w } = await supabase
      .from('wines')
      .select('*, grappiste_notes(*)')
      .eq('project_id', projectId)
      .order('bottle_number')
    setWines((w as WineWithNotes[]) ?? [])
    setEditingWine(null)
  }

  async function handleProjectChange(project: Project) {
    setSelectedProject(project)
    await loadWines(project.id)
  }

  function openEdit(wine: WineWithNotes) {
    setEditingWine(wine)
    const n = wine.grappiste_notes
    setWineType(wine.type)
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
    setElevage(n?.elevage ?? '')
    setImageUrl(n?.image_url ?? '')
    setShopifyUrl(wine.shopify_url ?? '')
    setSuccess(false)
  }

  function handleTypeChange(newType: WineType) {
    setWineType(newType)
    setRobe('')
    setBouche('')
    setCepage('')
    setAromes([])
  }

  async function saveWine() {
    if (!editingWine) return
    setSaving(true)

    await supabase.from('wines')
      .update({ shopify_url: shopifyUrl, type: wineType })
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
      elevage: elevage || null,
      image_url: imageUrl,
    }, { onConflict: 'wine_id' })

    await loadWines(selectedProject!.id)
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

  const content = WINE_CONTENT[wineType]
  const accent = '#8d323b'

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/admin')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>Gestion des vins</span>
          <span style={{ fontSize: '11px', background: '#faeeda', color: '#633806', padding: '3px 10px', borderRadius: '10px', fontWeight: '500' }}>Admin</span>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Sélecteur de projet */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', marginBottom: '8px' }}>Projet</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {projects.map(p => (
              <button key={p.id} onClick={() => handleProjectChange(p)}
                style={{
                  padding: '7px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer',
                  border: selectedProject?.id === p.id ? 'none' : '0.5px solid #e0e0e0',
                  background: selectedProject?.id === p.id ? accent : '#fff',
                  color: selectedProject?.id === p.id ? '#fff' : '#666',
                  fontWeight: selectedProject?.id === p.id ? '500' : '400',
                }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: editingWine ? '280px 1fr' : '1fr', gap: '1rem' }}>

          {/* Liste des vins */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '12px' }}>
              {selectedProject?.name} — {wines.length} vins
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
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: wine.type === 'rouge' ? '#f5ede8' : wine.type === 'blanc' ? '#f5f3e0' : wine.type === 'rose' ? '#fce8f0' : '#e8f0fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500', fontSize: '16px', color: '#8d323b', flexShrink: 0 }}>
                      {wine.bottle_number}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>
                      {wine.grappiste_notes?.cepage ? `${wine.grappiste_notes.cepage} ${wine.grappiste_notes.millesime ?? ''}` : `Bouteille #${wine.bottle_number}`}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      {WINE_TYPE_LABELS[wine.type]}
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
                Bouteille #{editingWine.bottle_number}
              </div>

              {success && (
                <div style={{ background: '#e8f0e8', color: '#27500A', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '1rem' }}>
                  ✓ Sauvegardé !
                </div>
              )}

              {/* Type de vin */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Type de vin</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(Object.entries(WINE_TYPE_LABELS) as [WineType, string][]).map(([type, label]) => (
                    <button key={type} onClick={() => handleTypeChange(type)}
                      style={{
                        padding: '6px 12px', borderRadius: '16px', fontSize: '13px', cursor: 'pointer',
                        border: wineType === type ? 'none' : '0.5px solid #e0e0e0',
                        background: wineType === type ? accent : '#fff',
                        color: wineType === type ? '#fff' : '#666',
                        fontWeight: wineType === type ? '500' : '400',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Cave / Domaine</label>
                <input value={cave} onChange={e => setCave(e.target.value)} placeholder="ex: Domaine de la Cure"
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Cépage</label>
                <SelectButtons options={content.cepages.filter(c => c !== 'Je sais pas')} value={cepage} onChange={setCepage} accent={accent} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Région</label>
                <SelectButtons options={content.regions.filter(r => r !== 'Je sais pas')} value={region} onChange={setRegion} accent={accent} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Robe</label>
                <SelectButtons options={content.robes} value={robe} onChange={setRobe} accent={accent} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Bouche</label>
                <SelectButtons options={content.bouche} value={bouche} onChange={setBouche} accent={accent} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>🪣 Élevage</label>
                <SelectButtons options={ELEVAGE_OPTIONS} value={elevage} onChange={setElevage} accent={accent} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>
                  Arômes officiels <span style={{ fontWeight: '400', color: '#aaa' }}>({aromes.length} sélectionnés)</span>
                </label>
                <MultiButtons options={content.aromes} values={aromes} onChange={setAromes} accent={accent} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Millésime</label>
                <input value={millesime} onChange={e => setMillesime(e.target.value)} placeholder="ex: 2021" type="number"
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Note /10</label>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="ex: 9.1" type="number" step="0.1" min="0" max="10"
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
              </div>

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

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Image URL</label>
                <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://cdn.shopify.com/..."
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
                {imageUrl && (
                  <img src={imageUrl} alt="Aperçu" style={{ maxHeight: '80px', marginTop: '8px', borderRadius: '6px', objectFit: 'contain' }} />
                )}
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Lien Shopify</label>
                <input value={shopifyUrl} onChange={e => setShopifyUrl(e.target.value)} placeholder="https://lagrappe.ch/..."
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
              </div>

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
    </div>
  )
}