'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile, Tasting, Wine, GrappisteNotes } from '@/types'

interface CaveEntry {
  tasting: Tasting
  wine: Wine
  notes: GrappisteNotes | null
}

export default function CavePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [entries, setEntries] = useState<CaveEntry[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: tastings } = await supabase
        .from('tastings')
        .select('*')
        .eq('user_id', user.id)
        .not('submitted_at', 'is', null)
        .order('created_at', { ascending: false })

      if (!tastings?.length) { setLoading(false); return }

      const sessionIds = tastings.map(t => t.session_id)
      const { data: sessions } = await supabase
        .from('sessions').select('*').in('id', sessionIds)

      const wineIds = sessions?.map(s => s.wine_id) ?? []
      const { data: wines } = await supabase
        .from('wines').select('*').in('id', wineIds)

      const { data: allNotes } = await supabase
        .from('grappiste_notes').select('*').in('wine_id', wineIds)

      const result: CaveEntry[] = tastings.map(t => {
        const session = sessions?.find(s => s.id === t.session_id)
        const wine = wines?.find(w => w.id === session?.wine_id)
        const notes = allNotes?.find(n => n.wine_id === wine?.id) ?? null
        return { tasting: t, wine: wine!, notes }
      }).filter(e => e.wine)

      setEntries(result)
      setLoading(false)
    }
    load()
  }, [])

  const totalPts = entries.reduce((sum, e) => sum + (e.tasting.total_points ?? 0), 0)
  const avgScore = entries.length
    ? Math.round(entries.reduce((sum, e) => sum + (e.tasting.score_perso ?? 0), 0) / entries.length * 10) / 10
    : 0

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement de ta cave...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>
            ‹
          </button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>Ma cave</span>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Stats */}
        {entries.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
            {[
              { label: 'Vins dégustés', value: entries.length },
              { label: 'Points totaux', value: totalPts.toLocaleString() },
              { label: 'Note moyenne', value: avgScore + '/10' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '.875rem', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a' }}>{value}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Liste des vins */}
        {entries.length === 0 ? (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '1rem' }}>🍾</div>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>
              Ta cave est vide !
            </div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.5rem' }}>
              Déguste ton premier vin pour commencer ton historique
            </div>
            <button onClick={() => router.push('/app/dashboard')}
              style={{ padding: '10px 20px', background: '#8d323b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
              Commencer à déguster →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {entries.map(({ tasting, wine, notes }) => (
              <div key={tasting.id} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>

                  {/* Icône bouteille */}
                  <div style={{ width: '48px', height: '80px', borderRadius: '8px', background: wine.type === 'rouge' ? '#f5ede8' : '#f5f3e0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '6px', flexShrink: 0 }}>
                    <div style={{ width: '16px', borderRadius: '3px 3px 8px 8px', background: wine.type === 'rouge' ? '#8d323b' : '#7a6a1a', height: `${Math.round((tasting.score_perso ?? 5) / 10 * 50)}px`, transition: 'height .6s' }} />
                  </div>

                  <div style={{ flex: 1 }}>
                    {/* Nom du vin */}
                    <div style={{ fontWeight: '500', fontSize: '15px', color: '#1a1a1a', marginBottom: '2px' }}>
                      {notes ? `${notes.cepage} ${notes.millesime}` : `Bouteille #${wine.bottle_number}`}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                      {notes?.region ?? wine.type}
                    </div>

                    {/* Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                      {tasting.cepage_guess && (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', background: tasting.cepage_guess === notes?.cepage ? '#e8f0e8' : '#f5f5f5', color: tasting.cepage_guess === notes?.cepage ? '#27500A' : '#888' }}>
                          {tasting.cepage_guess === notes?.cepage ? '✓' : '✗'} {tasting.cepage_guess}
                        </span>
                      )}
                      {tasting.region_guess && (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', background: tasting.region_guess === notes?.region ? '#e8f0e8' : '#f5f5f5', color: tasting.region_guess === notes?.region ? '#27500A' : '#888' }}>
                          {tasting.region_guess === notes?.region ? '✓' : '✗'} {tasting.region_guess}
                        </span>
                      )}
                    </div>

                    {/* Score */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        Note perso : <span style={{ fontWeight: '500', color: '#1a1a1a' }}>{tasting.score_perso ?? '—'}/10</span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#8d323b' }}>
                        {tasting.total_points.toLocaleString()} pts
                      </div>
                    </div>

                    {/* Notes libres */}
                    {tasting.notes_libres && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#666', fontStyle: 'italic', borderTop: '0.5px solid #f0f0f0', paddingTop: '8px' }}>
                        "{tasting.notes_libres}"
                      </div>
                    )}

                    {/* Lien Shopify */}
                    {wine.shopify_url && (
                      <a href={wine.shopify_url} target="_blank" rel="noreferrer"
                        style={{ display: 'inline-block', marginTop: '10px', fontSize: '12px', color: '#8d323b', textDecoration: 'none', fontWeight: '500' }}>
                        Racheter ce vin →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}