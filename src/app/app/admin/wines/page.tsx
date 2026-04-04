'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
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
  const [aromesText, setAromesText] = useState('')
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
    setAromesText(n?.aromes_officiels?.join(', ') ?? '')
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

    const aromesArray = aromesText.split(',').map(a => a.trim()).filter(Boolean)
    const prixNum = parseFloat(prixExact)

    await supabase.from('grappiste_notes').upsert({
      wine_id: editingWine.id,
      note: parseFloat(note),
      description,
      robe,
      aromes_officiels: aromesArray,
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

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>Gestion des vins</span>
          <span style={{ fontSize: '11px', background: '#faeeda', color: '#633806', padding: '3px 10px', borderRadius: '10px', fontWeight: '500' }}>Admin</span>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem', display: 'grid', gridTemplateColumns: editingWine ? '1fr 1fr' : '1fr', gap: '1rem' }}>

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
                  <img src={wine.grappiste_notes.image_url} alt={`Bouteille ${wine.bottle_number}`}
                    style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
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
                    {wine.grappiste_notes?.prix_exact ? ` · ${getPriceRange(wine.grappiste_notes.prix_exact)} CHF` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {wine.grappiste_notes && (
                    <span style={{ fontSize: '10px', background: '#e8f0e8', color: '#27500A', padding: '2px 7px', borderRadius: '6px' }}>✓</span>
                  )}
                  <span
                    onClick={e => { e.stopPropagation(); toggleReveal(wine) }}
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
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '1rem' }}>
              Bouteille #{editingWine.bottle_number} — {editingWine.type}
            </div>

            {success && (
              <div style={{ background: '#e8f0e8', color: '#27500A', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '1rem' }}>
                ✓ Sauvegardé !
              </div>
            )}

            {/* Prix exact + fourchette calculée */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>
                Prix exact CHF
              </label>
              <input value={prixExact} onChange={e => setPrixExact(e.target.value)}
                placeholder="ex: 28.50" type="number" step="0.5"
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
              {prixExact && !isNaN(parseFloat(prixExact)) && (
                <div style={{ fontSize: '11px', color: '#8d323b', marginTop: '4px' }}>
                  → Fourchette : {getPriceRange(parseFloat(prixExact))}
                </div>
              )}
            </div>

            {[
              { label: 'Cave / Domaine', value: cave, set: setCave, placeholder: 'ex: Domaine de la Cure' },
              { label: 'Cépage', value: cepage, set: setCepage, placeholder: 'ex: Cornalin' },
              { label: 'Région', value: region, set: setRegion, placeholder: 'ex: Valais' },
              { label: 'Millésime', value: millesime, set: setMillesime, placeholder: 'ex: 2021' },
              { label: 'Note /10', value: note, set: setNote, placeholder: 'ex: 9.1' },
              { label: 'Robe', value: robe, set: setRobe, placeholder: 'ex: Rouge dense' },
              { label: 'Bouche', value: bouche, set: setBouche, placeholder: 'ex: Puissant, corsé' },
              { label: 'Image URL (Shopify)', value: imageUrl, set: setImageUrl, placeholder: 'https://cdn.shopify.com/...' },
              { label: 'Lien Shopify', value: shopifyUrl, set: setShopifyUrl, placeholder: 'https://lagrappe.ch/...' },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label} style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>{label}</label>
                <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}

            {/* Aperçu image */}
            {imageUrl && (
              <div style={{ marginBottom: '10px', textAlign: 'center' }}>
                <img src={imageUrl} alt="Aperçu"
                  style={{ maxHeight: '120px', borderRadius: '8px', objectFit: 'contain' }} />
              </div>
            )}

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>
                Arômes officiels <span style={{ fontWeight: '400' }}>(séparés par des virgules)</span>
              </label>
              <textarea value={aromesText} onChange={e => setAromesText(e.target.value)}
                placeholder="Cerise noire, Violette, Poivre, Cassis, Réglisse"
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', outline: 'none', resize: 'none', minHeight: '60px', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box' }} />
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
                style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '8px', background: saving ? '#c0a0a0' : '#8d323b', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}