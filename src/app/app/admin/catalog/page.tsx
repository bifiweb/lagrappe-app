'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface CatalogWine {
  id: string
  name: string
  cave: string | null
  cepage: string | null
  region: string | null
  millesime: number | null
  type: string
  description: string | null
  image_url: string | null
  prix_chf: number | null
  shopify_url: string | null
  pdf_url: string | null
  active: boolean
}

interface ShopifyProduct {
  shopify_id: string
  name: string
  cave: string | null
  cepage: string | null
  region: string | null
  type: string
  description: string | null
  image_url: string | null
  prix_chf: number | null
  shopify_url: string
  pdf_url: string | null
  tags: string[]
}

const accent = '#8d323b'

function detectWineType(tags: string[]): string {
  const t = tags.map(s => s.toLowerCase())
  if (t.some(s => s.includes('blanc') || s === 'white')) return 'blanc'
  if (t.some(s => s.includes('ros'))) return 'rose'
  if (t.some(s => s.includes('pétillant') || s.includes('petillant') || s.includes('mousseux') || s.includes('sparkling'))) return 'petillant'
  return 'rouge'
}

const EMPTY: Partial<CatalogWine> = { name: '', cave: '', cepage: '', region: '', millesime: null, type: 'rouge', description: '', image_url: '', prix_chf: null, shopify_url: '', pdf_url: '', active: true }

export default function AdminCatalogPage() {
  const [wines, setWines] = useState<CatalogWine[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CatalogWine | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Partial<CatalogWine>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  function copyQrUrl(e: React.MouseEvent, wineId: string) {
    e.stopPropagation()
    const url = `${window.location.origin}/app/cave/pepites?wine=${wineId}`
    navigator.clipboard.writeText(url)
    setCopiedId(wineId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Import Shopify
  const [showImport, setShowImport] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [overrides, setOverrides] = useState<Record<string, Partial<ShopifyProduct>>>({})
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(0)
  const [divideBy6, setDivideBy6] = useState(true)
  const [importSearch, setImportSearch] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/app/dashboard'); return }

      const { data } = await supabase
        .from('catalog_wines').select('*').order('created_at', { ascending: false })
      setWines(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setSuccess(false)
    setCreating(true)
  }

  function openEdit(w: CatalogWine) {
    setCreating(false)
    setSuccess(false)
    setForm({ ...w })
    setEditing(w)
  }

  function close() { setCreating(false); setEditing(null) }

  async function save() {
    if (!form.name?.trim()) return
    setSaving(true)
    setSuccess(false)

    const payload = {
      name: form.name!.trim(),
      cave: form.cave?.trim() || null,
      cepage: form.cepage?.trim() || null,
      region: form.region?.trim() || null,
      millesime: form.millesime || null,
      type: form.type ?? 'rouge',
      description: form.description?.trim() || null,
      image_url: form.image_url?.trim() || null,
      prix_chf: form.prix_chf || null,
      shopify_url: form.shopify_url?.trim() || null,
      pdf_url: form.pdf_url?.trim() || null,
      active: form.active ?? true,
    }

    if (editing) {
      await supabase.from('catalog_wines').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('catalog_wines').insert(payload)
    }

    const { data } = await supabase.from('catalog_wines').select('*').order('created_at', { ascending: false })
    setWines(data ?? [])
    setSaving(false)
    setSuccess(true)
    setCreating(false)
    setEditing(null)
  }

  async function deleteWine(w: CatalogWine) {
    if (!confirm(`Supprimer "${w.name}" ? Les notes des utilisateurs seront aussi supprimées.`)) return
    await supabase.from('catalog_wines').delete().eq('id', w.id)
    setWines(wines.filter(x => x.id !== w.id))
    close()
  }

  async function bulkDelete() {
    if (bulkSelected.size === 0) return
    if (!confirm(`Supprimer ${bulkSelected.size} vin${bulkSelected.size > 1 ? 's' : ''} ? Les notes des utilisateurs seront aussi supprimées.`)) return
    setBulkDeleting(true)
    await supabase.from('catalog_wines').delete().in('id', Array.from(bulkSelected))
    setWines(wines.filter(w => !bulkSelected.has(w.id)))
    setBulkSelected(new Set())
    setBulkMode(false)
    setBulkDeleting(false)
    close()
  }

  async function fetchShopifyProducts() {
    setImportLoading(true)
    setImportError(null)
    setImportDone(0)
    try {
      const res = await fetch('/api/shopify/products')
      let json: any
      try { json = await res.json() } catch {
        setImportError(`Réponse invalide (HTTP ${res.status})`)
        return
      }
      if (!res.ok) { setImportError(json?.error ?? `Erreur HTTP ${res.status}`); return }

      setShopifyProducts(json.products)
      setSelected(new Set())
      setOverrides({})
    } catch (e: any) {
      setImportError(e.message)
    } finally {
      setImportLoading(false)
    }
  }

  function openImport() {
    setShowImport(true)
    fetchShopifyProducts()
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function setOverride(shopifyId: string, key: string, value: any) {
    setOverrides(prev => ({ ...prev, [shopifyId]: { ...prev[shopifyId], [key]: value } }))
  }

  function merged(p: ShopifyProduct): ShopifyProduct {
    return { ...p, ...(overrides[p.shopify_id] ?? {}) }
  }

  async function runImport() {
    const toImport = shopifyProducts.filter(p => selected.has(p.shopify_id)).map(merged)
    if (toImport.length === 0) return
    setImporting(true)

    const errors: string[] = []
    let count = 0
    for (const p of toImport) {
      const prix = p.prix_chf && divideBy6 ? Math.round(p.prix_chf / 6 * 100) / 100 : p.prix_chf
      const payload = {
        name: p.name,
        cave: p.cave || null,
        cepage: p.cepage || null,
        region: p.region || 'Valais',
        type: p.type,
        description: p.description || null,
        image_url: p.image_url || null,
        prix_chf: prix || null,
        shopify_url: p.shopify_url,
        pdf_url: p.pdf_url || null,
        active: true,
      }
      // Vérifie si le vin existe déjà (par shopify_url)
      const { data: existing } = await supabase
        .from('catalog_wines').select('id, pdf_url').eq('shopify_url', p.shopify_url).maybeSingle()
      // Préserve le pdf_url saisi manuellement si Shopify n'en fournit pas
      if (existing) payload.pdf_url = payload.pdf_url ?? existing.pdf_url ?? null
      const { error } = existing
        ? await supabase.from('catalog_wines').update(payload).eq('id', existing.id)
        : await supabase.from('catalog_wines').insert(payload)
      if (error) errors.push(`${p.name}: ${error.message}`)
      else count++
    }

    if (errors.length > 0) {
      setImportError(`Erreurs d'import :\n${errors.join('\n')}`)
    }

    const { data } = await supabase.from('catalog_wines').select('*').order('created_at', { ascending: false })
    setWines(data ?? [])
    setImporting(false)
    setImportDone(count)
  }

  const showForm = creating || editing !== null
  const f = (k: keyof CatalogWine) => (form as any)[k] ?? ''
  const set = (k: keyof CatalogWine, v: any) => setForm(p => ({ ...p, [k]: v }))

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>Cave à pépites — Catalogue</span>
          <button onClick={openImport}
            style={{ padding: '7px 14px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🛍</span> Importer Shopify
          </button>
          <span style={{ fontSize: '11px', background: '#faeeda', color: '#633806', padding: '3px 10px', borderRadius: '10px', fontWeight: '500' }}>Admin</span>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem', display: 'grid', gridTemplateColumns: showForm ? '1fr 1.4fr' : '1fr', gap: '1.5rem' }}>

        {/* Liste */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {wines.length} vin{wines.length > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {bulkMode ? (
                <>
                  <button onClick={() => { setBulkMode(false); setBulkSelected(new Set()) }}
                    style={{ padding: '6px 12px', background: '#fff', color: '#888', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    Annuler
                  </button>
                  <button onClick={bulkDelete} disabled={bulkSelected.size === 0 || bulkDeleting}
                    style={{ padding: '6px 12px', background: bulkSelected.size === 0 ? '#f5f5f5' : '#dc2626', color: bulkSelected.size === 0 ? '#bbb' : '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: bulkSelected.size === 0 ? 'default' : 'pointer' }}>
                    {bulkDeleting ? 'Suppression...' : `Supprimer${bulkSelected.size > 0 ? ` (${bulkSelected.size})` : ''}`}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setBulkMode(true)}
                    style={{ padding: '6px 12px', background: '#fff', color: '#888', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    Sélectionner
                  </button>
                  <button onClick={openCreate}
                    style={{ padding: '7px 14px', background: accent, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                    + Ajouter
                  </button>
                </>
              )}
            </div>
          </div>

          <input value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
            placeholder="Rechercher dans le catalogue..."
            style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #e0e0e0', borderRadius: '10px', fontSize: '13px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box' }} />

          {success && (
            <div style={{ background: '#e8f0e8', color: '#27500A', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '12px' }}>
              ✓ Sauvegardé !
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {wines.length === 0 ? (
              <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: '#888', fontSize: '14px' }}>
                Aucun vin dans le catalogue.<br />Importe depuis Shopify ou ajoute manuellement !
              </div>
            ) : wines.filter(w => {
              if (!catalogSearch.trim()) return true
              const q = catalogSearch.toLowerCase()
              return w.name.toLowerCase().includes(q) || (w.cave ?? '').toLowerCase().includes(q) || (w.cepage ?? '').toLowerCase().includes(q) || (w.region ?? '').toLowerCase().includes(q)
            }).map(w => (
              <div key={w.id}
                onClick={() => bulkMode
                  ? setBulkSelected(prev => { const s = new Set(prev); s.has(w.id) ? s.delete(w.id) : s.add(w.id); return s })
                  : openEdit(w)
                }
                style={{ background: bulkSelected.has(w.id) ? '#fdf5f5' : '#fff', border: bulkSelected.has(w.id) ? `2px solid #dc2626` : editing?.id === w.id ? `2px solid ${accent}` : '0.5px solid #e0e0e0', borderRadius: '12px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {bulkMode && (
                  <input type="checkbox" checked={bulkSelected.has(w.id)} onChange={() => {}} onClick={e => e.stopPropagation()}
                    style={{ width: '16px', height: '16px', accentColor: '#dc2626', flexShrink: 0 }} />
                )}
                {w.image_url ? (
                  <img src={w.image_url} alt={w.name} style={{ width: '40px', height: '60px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '40px', height: '60px', borderRadius: '8px', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🍾</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>
                    {[w.cave, w.cepage, w.region, w.millesime].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: '10px', color: '#bbb', fontFamily: 'monospace' }}>{w.id}</div>
                </div>
                {!bulkMode && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ fontSize: '11px', background: '#f5ede8', color: accent, padding: '2px 8px', borderRadius: '6px' }}>{w.type}</span>
                      {!w.active && <span style={{ fontSize: '11px', background: '#f5f5f5', color: '#aaa', padding: '2px 8px', borderRadius: '6px' }}>inactif</span>}
                    </div>
                    <button onClick={e => copyQrUrl(e, w.id)}
                      style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', border: '0.5px solid #e0e0e0', background: copiedId === w.id ? '#e8f0e8' : '#fff', color: copiedId === w.id ? '#27500A' : '#888', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {copiedId === w.id ? '✓ Copié !' : '📋 URL QR'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Formulaire */}
        {showForm && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#1a1a1a', marginBottom: '1rem' }}>
              {creating ? '+ Nouveau vin' : `Modifier — ${editing?.name}`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Nom *</label>
                <input value={f('name')} onChange={e => set('name', e.target.value)}
                  placeholder="ex: Gamay de Fully 2022"
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Cave / Producteur</label>
                <input value={f('cave')} onChange={e => set('cave', e.target.value)}
                  placeholder="ex: Domaine du Mont d'Or"
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Cépage</label>
                  <input value={f('cepage')} onChange={e => set('cepage', e.target.value)}
                    placeholder="Gamay"
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Région</label>
                  <input value={f('region')} onChange={e => set('region', e.target.value)}
                    placeholder="Valais"
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Millésime</label>
                  <input type="number" value={f('millesime')} onChange={e => set('millesime', parseInt(e.target.value) || null)}
                    placeholder="2022" min={1900} max={2030}
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Prix CHF</label>
                  <input type="number" value={f('prix_chf')} onChange={e => set('prix_chf', parseFloat(e.target.value) || null)}
                    placeholder="24.90" step="0.5"
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Type</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['rouge', 'blanc', 'rose', 'petillant'].map(t => (
                    <button key={t} onClick={() => set('type', t)}
                      style={{ flex: 1, padding: '7px 4px', borderRadius: '8px', border: form.type === t ? 'none' : '0.5px solid #e0e0e0', background: form.type === t ? accent : '#fff', color: form.type === t ? '#fff' : '#666', fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea value={f('description')} onChange={e => set('description', e.target.value)}
                  placeholder="Notes de dégustation officielles, accords..."
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'none', minHeight: '70px', fontFamily: 'system-ui', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Image URL</label>
                <input value={f('image_url')} onChange={e => set('image_url', e.target.value)}
                  placeholder="https://..."
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                {form.image_url && (
                  <img src={form.image_url} alt="" style={{ maxHeight: '80px', marginTop: '8px', borderRadius: '6px', objectFit: 'contain' }} />
                )}
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Lien Shopify</label>
                <input value={f('shopify_url')} onChange={e => set('shopify_url', e.target.value)}
                  placeholder="https://lagrappe.ch/products/..."
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>PDF fiche vin</label>
                <input value={f('pdf_url')} onChange={e => set('pdf_url', e.target.value)}
                  placeholder="https://cdn.shopify.com/.../fiche.pdf"
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div onClick={() => set('active', !form.active)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 0' }}>
                <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: form.active ? accent : '#ddd', position: 'relative', transition: 'background .2s' }}>
                  <div style={{ position: 'absolute', top: '2px', left: form.active ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </div>
                <span style={{ fontSize: '13px', color: '#444' }}>Visible dans la cave à pépites</span>
              </div>
            </div>

            {editing && (
              <div style={{ marginTop: '1rem' }}>
                <button onClick={() => deleteWine(editing)}
                  style={{ width: '100%', padding: '10px', border: '0.5px solid #fca5a5', borderRadius: '8px', background: '#fff', color: '#dc2626', fontSize: '13px', cursor: 'pointer' }}>
                  🗑 Supprimer ce vin
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={close}
                style={{ flex: 1, padding: '10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={save} disabled={saving || !form.name?.trim()}
                style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '8px', background: saving || !form.name?.trim() ? '#c0a0a0' : accent, color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving || !form.name?.trim() ? 'default' : 'pointer' }}>
                {saving ? 'Sauvegarde...' : creating ? 'Ajouter' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal import Shopify */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowImport(false) }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '720px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header modal */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '0.5px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              <span style={{ fontSize: '18px' }}>🛍</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '500', color: '#1a1a1a' }}>Importer depuis Shopify</div>
                {!importLoading && shopifyProducts.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {shopifyProducts.length} produits · {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <div onClick={() => setDivideBy6(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ width: '32px', height: '18px', borderRadius: '9px', background: divideBy6 ? accent : '#ddd', position: 'relative', transition: 'background .2s' }}>
                  <div style={{ position: 'absolute', top: '2px', left: divideBy6 ? '16px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </div>
                <span style={{ fontSize: '12px', color: '#666' }}>Prix ÷ 6</span>
              </div>
              <button onClick={() => setShowImport(false)}
                style={{ background: '#f5f5f5', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', color: '#666', cursor: 'pointer' }}>
                Fermer
              </button>
            </div>

            {/* Contenu */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
              {importLoading && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#888', fontSize: '14px' }}>
                  Connexion à Shopify...
                </div>
              )}

              {importError && (
                <div style={{ background: '#fff8e8', border: '0.5px solid #f0c040', borderRadius: '10px', padding: '10px 14px', color: '#7a5000', fontSize: '12px', marginBottom: '10px' }}>
                  ⚠️ {importError}
                </div>
              )}

              {importDone > 0 && (
                <div style={{ background: '#e8f0e8', border: '0.5px solid #b8d4b0', borderRadius: '10px', padding: '1rem', color: '#27500A', fontSize: '14px', marginBottom: '1rem', textAlign: 'center' }}>
                  ✅ {importDone} vin{importDone > 1 ? 's' : ''} importé{importDone > 1 ? 's' : ''} avec succès !
                </div>
              )}

              {!importLoading && shopifyProducts.length > 0 && (
                <>
                  <div style={{ marginBottom: '10px' }}>
                    <input
                      value={importSearch}
                      onChange={e => setImportSearch(e.target.value)}
                      placeholder="Rechercher un produit..."
                      style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #e0e0e0', borderRadius: '10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <button onClick={() => setSelected(new Set(shopifyProducts.map(p => p.shopify_id)))}
                      style={{ fontSize: '12px', color: accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Tout sélectionner
                    </button>
                    <button onClick={() => setSelected(new Set())}
                      style={{ fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Tout décocher
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {shopifyProducts.filter(p => {
                      if (!importSearch.trim()) return true
                      const q = importSearch.toLowerCase()
                      return p.name.toLowerCase().includes(q) || (p.cave ?? '').toLowerCase().includes(q) || (p.cepage ?? '').toLowerCase().includes(q)
                    }).map(p => {
                      const m = merged(p)
                      const isSelected = selected.has(p.shopify_id)
                      const alreadyIn = wines.some(w => w.shopify_url === p.shopify_url)
                      return (
                        <div key={p.shopify_id}
                          style={{ border: isSelected ? `1.5px solid ${accent}` : '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', background: isSelected ? '#fdf8f5' : '#fff', opacity: 1 }}>

                          {/* Ligne principale cliquable */}
                          <div onClick={() => toggleSelect(p.shopify_id)}
                            style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ width: '16px', height: '16px', accentColor: accent, flexShrink: 0 }} />
                            {p.image_url
                              ? <img src={p.image_url} alt={p.name} style={{ width: '36px', height: '54px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }} />
                              : <div style={{ width: '36px', height: '54px', background: '#f5ede8', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🍾</div>
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {m.name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#888' }}>
                                {[m.cave, m.cepage, m.region].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center', flexDirection: 'column' }}>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {alreadyIn && <span style={{ fontSize: '10px', background: '#e8f0e8', color: '#27500A', padding: '2px 6px', borderRadius: '4px' }}>déjà importé</span>}
                                {p.pdf_url && <span style={{ fontSize: '10px', background: '#e8eaf0', color: '#27408B', padding: '2px 6px', borderRadius: '4px' }}>PDF</span>}
                                <span style={{ fontSize: '11px', background: '#f5ede8', color: accent, padding: '2px 8px', borderRadius: '6px' }}>{m.type}</span>
                              </div>
                              {m.prix_chf && (
                                <span style={{ fontSize: '11px', color: '#555', fontWeight: '500' }}>
                                  CHF {divideBy6 ? Math.round(m.prix_chf / 6 * 100) / 100 : m.prix_chf}
                                  {divideBy6 && <span style={{ color: '#aaa', fontWeight: '400' }}> /btl</span>}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Champs éditables si sélectionné */}
                          {isSelected && (
                            <div style={{ padding: '0 14px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                              <div>
                                <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>Région</label>
                                <input value={m.region ?? 'Valais'} onChange={e => setOverride(p.shopify_id, 'region', e.target.value)}
                                  style={{ width: '100%', padding: '5px 8px', border: '0.5px solid #e0e0e0', borderRadius: '6px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>Type</label>
                                <select value={m.type} onChange={e => setOverride(p.shopify_id, 'type', e.target.value)}
                                  style={{ width: '100%', padding: '5px 8px', border: '0.5px solid #e0e0e0', borderRadius: '6px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                                  {['rouge', 'blanc', 'rose', 'petillant'].map(t => <option key={t}>{t}</option>)}
                                </select>
                              </div>
                              {m.description && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>Description (depuis Shopify)</label>
                                  <div style={{ fontSize: '11px', color: '#666', background: '#f9f9f9', borderRadius: '6px', padding: '6px 8px', lineHeight: 1.5, maxHeight: '60px', overflow: 'hidden' }}>
                                    {m.description}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Footer modal */}
            {!importLoading && !importError && selected.size > 0 && (
              <div style={{ padding: '1rem 1.5rem', borderTop: '0.5px solid #e0e0e0', flexShrink: 0 }}>
                <button onClick={runImport} disabled={importing}
                  style={{ width: '100%', padding: '13px', background: importing ? '#c0a0a0' : accent, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: importing ? 'default' : 'pointer' }}>
                  {importing ? 'Import en cours...' : `Importer ${selected.size} vin${selected.size > 1 ? 's' : ''} →`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
