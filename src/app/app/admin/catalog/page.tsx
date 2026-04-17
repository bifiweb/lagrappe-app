'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface CatalogWine {
  id: string
  name: string
  cepage: string | null
  region: string | null
  millesime: number | null
  type: string
  description: string | null
  image_url: string | null
  prix_chf: number | null
  shopify_url: string | null
  active: boolean
}

const accent = '#8d323b'
const EMPTY: Partial<CatalogWine> = { name: '', cepage: '', region: '', millesime: null, type: 'rouge', description: '', image_url: '', prix_chf: null, shopify_url: '', active: true }

export default function AdminCatalogPage() {
  const [wines, setWines] = useState<CatalogWine[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CatalogWine | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Partial<CatalogWine>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
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
      cepage: form.cepage?.trim() || null,
      region: form.region?.trim() || null,
      millesime: form.millesime || null,
      type: form.type ?? 'rouge',
      description: form.description?.trim() || null,
      image_url: form.image_url?.trim() || null,
      prix_chf: form.prix_chf || null,
      shopify_url: form.shopify_url?.trim() || null,
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
          <span style={{ fontSize: '11px', background: '#faeeda', color: '#633806', padding: '3px 10px', borderRadius: '10px', fontWeight: '500' }}>Admin</span>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem', display: 'grid', gridTemplateColumns: showForm ? '1fr 1.4fr' : '1fr', gap: '1.5rem' }}>

        {/* Liste */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {wines.length} vin{wines.length > 1 ? 's' : ''}
            </div>
            <button onClick={openCreate}
              style={{ padding: '7px 14px', background: accent, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
              + Ajouter un vin
            </button>
          </div>

          {success && (
            <div style={{ background: '#e8f0e8', color: '#27500A', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '12px' }}>
              ✓ Sauvegardé !
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {wines.length === 0 ? (
              <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: '#888', fontSize: '14px' }}>
                Aucun vin dans le catalogue.<br />Ajoute le premier !
              </div>
            ) : wines.map(w => (
              <div key={w.id} onClick={() => openEdit(w)}
                style={{ background: '#fff', border: editing?.id === w.id ? `2px solid ${accent}` : '0.5px solid #e0e0e0', borderRadius: '12px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {w.image_url ? (
                  <img src={w.image_url} alt={w.name} style={{ width: '40px', height: '60px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '40px', height: '60px', borderRadius: '8px', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🍾</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>{[w.cepage, w.region, w.millesime].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', background: '#f5ede8', color: accent, padding: '2px 8px', borderRadius: '6px' }}>{w.type}</span>
                  {!w.active && <span style={{ fontSize: '11px', background: '#f5f5f5', color: '#aaa', padding: '2px 8px', borderRadius: '6px' }}>inactif</span>}
                </div>
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
    </div>
  )
}
