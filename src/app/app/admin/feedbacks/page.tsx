'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface FeedbackEntry {
  id: string
  source: 'cave' | 'jeu'
  client: string
  vin: string
  cave: string | null
  note: number | null
  degustation: string | null
  design: number | null
  valeur: number | null
  racheterait: boolean | null
  date: string
}

const accent = '#8d323b'
const VALEUR_LABELS = ['Bradé', 'Abordable', 'Juste prix', 'Cher', 'Trop cher']
const DESIGN_LABELS = ['Moche', 'Pas très joli', 'Moyen', 'Joli', 'Magnifique']

export default function FeedbacksPage() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCave, setFilterCave] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterSource, setFilterSource] = useState<'' | 'cave' | 'jeu'>('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/app/dashboard'); return }

      // 1. cave_ratings
      const { data: caveRatings } = await supabase
        .from('cave_ratings').select('*').order('created_at', { ascending: false })

      // 2. catalog_wines pour les cave_ratings
      const caveWineIds = [...new Set((caveRatings ?? []).map((r: any) => r.wine_id))]
      const { data: catalogWines } = caveWineIds.length
        ? await supabase.from('catalog_wines').select('id, name, cave').in('id', caveWineIds)
        : { data: [] }

      // 3. tastings post-reveal (avec score_perso)
      const { data: tastings } = await supabase
        .from('tastings')
        .select('id, user_id, score_perso, notes_degustation, design_rating, valeur_rating, racheterait, created_at, session_id')
        .not('score_perso', 'is', null)
        .order('created_at', { ascending: false })

      // 4. sessions → wine_id
      const sessionIds = [...new Set((tastings ?? []).map((t: any) => t.session_id))]
      const { data: sessions } = sessionIds.length
        ? await supabase.from('sessions').select('id, wine_id').in('id', sessionIds)
        : { data: [] }

      // 5. wines → shopify_url
      const gameWineIds = [...new Set((sessions ?? []).map((s: any) => s.wine_id))]
      const { data: gameWines } = gameWineIds.length
        ? await supabase.from('wines').select('id, shopify_url').in('id', gameWineIds)
        : { data: [] }

      // 6. catalog_wines pour les vins de jeu (via shopify_url) — id inclus pour déduplication
      const shopifyUrls = [...new Set((gameWines ?? []).filter((w: any) => w.shopify_url).map((w: any) => w.shopify_url))]
      const { data: catalogWinesGame } = shopifyUrls.length
        ? await supabase.from('catalog_wines').select('id, shopify_url, name, cave').in('shopify_url', shopifyUrls)
        : { data: [] }

      // 7. profils de tous les utilisateurs concernés
      const allUserIds = [...new Set([
        ...(caveRatings ?? []).map((r: any) => r.user_id),
        ...(tastings ?? []).map((t: any) => t.user_id),
      ])]
      const { data: profiles } = allUserIds.length
        ? await supabase.from('profiles').select('id, email').in('id', allUserIds)
        : { data: [] }

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.email]))
      const catalogMap = new Map((catalogWines ?? []).map((w: any) => [w.id, w]))
      const sessionMap = new Map((sessions ?? []).map((s: any) => [s.id, s]))
      const gameWineMap = new Map((gameWines ?? []).map((w: any) => [w.id, w]))
      const catalogGameMap = new Map((catalogWinesGame ?? []).map((w: any) => [w.shopify_url, w]))

      // Paires (user_id:catalog_wine_id) couvertes par une entrée jeu → exclure la cave_rating correspondante
      const gameUserWineSet = new Set<string>()
      for (const t of tastings ?? []) {
        const session = sessionMap.get((t as any).session_id)
        const gw = session ? gameWineMap.get((session as any).wine_id) : null
        const cw = (gw as any)?.shopify_url ? catalogGameMap.get((gw as any).shopify_url) : null
        if ((cw as any)?.id) gameUserWineSet.add(`${(t as any).user_id}:${(cw as any).id}`)
      }

      const caveEntries: FeedbackEntry[] = (caveRatings ?? []).filter((r: any) =>
        !gameUserWineSet.has(`${r.user_id}:${r.wine_id}`)
      ).map((r: any) => {
        const cw = catalogMap.get(r.wine_id)
        return {
          id: `cave-${r.id}`,
          source: 'cave',
          client: profileMap.get(r.user_id) ?? 'Inconnu',
          vin: cw?.name ?? '—',
          cave: cw?.cave ?? null,
          note: r.stars,
          degustation: r.notes_degustation ?? r.notes_libres ?? null,
          design: r.design_rating,
          valeur: r.valeur_rating,
          racheterait: r.racheterait,
          date: r.created_at,
        }
      })

      const gameEntries: FeedbackEntry[] = (tastings ?? []).map((t: any) => {
        const session = sessionMap.get(t.session_id)
        const gw = session ? gameWineMap.get(session.wine_id) : null
        const cw = gw?.shopify_url ? catalogGameMap.get(gw.shopify_url) : null
        return {
          id: `jeu-${t.id}`,
          source: 'jeu',
          client: profileMap.get(t.user_id) ?? 'Inconnu',
          vin: cw?.name ?? '—',
          cave: cw?.cave ?? null,
          note: t.score_perso,
          degustation: t.notes_degustation ?? null,
          design: t.design_rating,
          valeur: t.valeur_rating,
          racheterait: t.racheterait,
          date: t.created_at,
        }
      })

      const all = [...caveEntries, ...gameEntries].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setEntries(all)
      setLoading(false)
    }
    load()
  }, [])

  const caves = useMemo(() =>
    [...new Set(entries.map(e => e.cave).filter(Boolean) as string[])].sort(), [entries])
  const clients = useMemo(() =>
    [...new Set(entries.map(e => e.client))].sort(), [entries])

  const filtered = useMemo(() => entries.filter(e => {
    if (filterSource && e.source !== filterSource) return false
    if (filterCave && e.cave !== filterCave) return false
    if (filterClient && e.client !== filterClient) return false
    return true
  }), [entries, filterSource, filterCave, filterClient])

  function exportCSV() {
    const header = ['Source', 'Date', 'Client', 'Vin', 'Cave', 'Note /10', 'Dégustation', 'Design', 'Valeur prix', 'Rachèterait']
    const rows = filtered.map(e => [
      e.source === 'cave' ? 'Cave à pépites' : 'Jeu',
      new Date(e.date).toLocaleDateString('fr-CH'),
      e.client,
      e.vin,
      e.cave ?? '',
      e.note ?? '',
      e.degustation ?? '',
      e.design ? DESIGN_LABELS[e.design - 1] : '',
      e.valeur ? VALEUR_LABELS[e.valeur - 1] : '',
      e.racheterait === true ? 'Oui' : e.racheterait === false ? 'Non' : '',
    ])
    const csv = [header, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `feedbacks-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasFilters = filterSource || filterCave || filterClient

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif', paddingBottom: '3rem' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/admin')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>Feedbacks clients</span>
          <span style={{ fontSize: '13px', color: '#888' }}>{filtered.length} avis</span>
          <button onClick={exportCSV}
            style={{ padding: '7px 14px', background: accent, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.25rem 1.5rem' }}>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value as any)}
            style={{ padding: '7px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', background: '#fff', color: '#444', cursor: 'pointer' }}>
            <option value="">Toutes sources</option>
            <option value="cave">💎 Cave à pépites</option>
            <option value="jeu">🎮 Jeu</option>
          </select>
          <select value={filterCave} onChange={e => setFilterCave(e.target.value)}
            style={{ padding: '7px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', background: '#fff', color: '#444', cursor: 'pointer', minWidth: '160px' }}>
            <option value="">Toutes les caves</option>
            {caves.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            style={{ padding: '7px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', background: '#fff', color: '#444', cursor: 'pointer', minWidth: '180px' }}>
            <option value="">Tous les clients</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setFilterSource(''); setFilterCave(''); setFilterClient('') }}
              style={{ padding: '7px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', background: '#fff', color: '#888', cursor: 'pointer' }}>
              Réinitialiser
            </button>
          )}
        </div>

        {/* Tableau */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: '#888' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '14px' }}>Aucun feedback pour l'instant</div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8f8f8', borderBottom: '0.5px solid #e8e8e8' }}>
                  {['Source', 'Date', 'Client', 'Vin / Cave', 'Note', 'Dégustation', 'Design', 'Prix', 'Rachète ?'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '500', color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: i < filtered.length - 1 ? '0.5px solid #f0f0f0' : 'none', background: i % 2 === 0 ? '#fff' : '#fdfcfc' }}>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '500', padding: '3px 8px', borderRadius: '8px',
                        background: e.source === 'cave' ? '#eef3ff' : '#fff3e0',
                        color: e.source === 'cave' ? '#3b5bdb' : '#c77700',
                      }}>
                        {e.source === 'cave' ? '💎 Cave' : '🎮 Jeu'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#888', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {new Date(e.date).toLocaleDateString('fr-CH')}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#444', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.client}
                    </td>
                    <td style={{ padding: '10px 14px', maxWidth: '200px' }}>
                      <div style={{ fontWeight: '500', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.vin}</div>
                      {e.cave && <div style={{ fontSize: '11px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.cave}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontWeight: '600', color: accent }}>
                      {e.note !== null ? `${e.note}/10` : <span style={{ color: '#ddd', fontWeight: 400 }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px', maxWidth: '250px', color: '#555' }}>
                      {e.degustation
                        ? <span title={e.degustation} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.degustation}</span>
                        : <span style={{ color: '#ddd' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: e.design ? '#f0a000' : '#ddd', fontSize: '14px' }}>
                      {e.design ? '★'.repeat(e.design) + '☆'.repeat(5 - e.design) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '12px', color: e.valeur ? '#555' : '#ddd' }}>
                      {e.valeur ? VALEUR_LABELS[e.valeur - 1] : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', textAlign: 'center', fontSize: '16px' }}>
                      {e.racheterait === true ? '✅' : e.racheterait === false ? '❌' : <span style={{ color: '#ddd', fontSize: '13px' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
