'use client'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

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
}

interface WineEntry {
  wine: CatalogWine
  myRating: any | null
  playedInGame: boolean
}

const accent = '#8d323b'

const SCORE_EMOJIS = ['😫','😞','😕','😐','😏','🙂','😊','😋','😁','🤩','😍']
const SCORE_LABELS = ['Imbuvable','Très mauvais','Mauvais','Bof','Correct','Moyen','Bien','Très bien','Excellent','Sublime','Légendaire !']

function ScorePicker({ score, onRate }: { score: number | null, onRate: (s: number) => void }) {
  const stars = score !== null ? score / 2 : 0
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {[1,2,3,4,5].map(i => {
        const gradId = `sgc-${i}`
        const isFull = stars >= i
        const isHalf = !isFull && stars >= i - 0.5 && stars > 0
        return (
          <div key={i} style={{ position: 'relative', width: '28px', height: '28px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" style={{ display: 'block' }}>
              <defs>
                <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="50%" stopColor="#f0a000"/>
                  <stop offset="50%" stopColor="#e0e0e0"/>
                </linearGradient>
              </defs>
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                fill={isFull ? '#f0a000' : isHalf ? `url(#${gradId})` : '#e0e0e0'} />
            </svg>
            <div onClick={() => onRate(i * 2 - 1)} style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', cursor: 'pointer' }} />
            <div onClick={() => onRate(i * 2)} style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', cursor: 'pointer' }} />
          </div>
        )
      })}
      {score !== null && <span style={{ fontSize: '12px', color: '#888', marginLeft: '6px' }}>{score}/10</span>}
    </div>
  )
}

function MiniStars({ score }: { score: number }) {
  const stars = score / 2
  return (
    <div style={{ display: 'flex', gap: '1px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: '12px', color: stars >= i ? '#f0a000' : '#ddd' }}>★</span>
      ))}
      <span style={{ fontSize: '11px', color: '#888', marginLeft: '4px' }}>{score}/10</span>
    </div>
  )
}

type FilterTab = 'all' | 'rated' | 'unrated'

function CavePepitesContent() {
  const [entries, setEntries] = useState<WineEntry[]>([])
  const [filtered, setFiltered] = useState<WineEntry[]>([])
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [formScore, setFormScore] = useState<number | null>(null)
  const [formNotesDeg, setFormNotesDeg] = useState('')
  const [formDesign, setFormDesign] = useState(0)
  const [formValeur, setFormValeur] = useState(0)
  const [formRachete, setFormRachete] = useState<boolean | null>(null)
  const [formNotes, setFormNotes] = useState('')

  const router = useRouter()
  const searchParams = useSearchParams()
  const targetWineId = searchParams.get('wine')
  const supabase = createClient()

  useEffect(() => {
    if (loading || !targetWineId) return
    const entry = entries.find(e => e.wine.id === targetWineId)
    if (!entry) return
    openRating(entry)
    setTimeout(() => {
      document.getElementById(`wine-${targetWineId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }, [loading, targetWineId])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const redirect = targetWineId
          ? `/app/cave/pepites?wine=${targetWineId}`
          : '/app/cave/pepites'
        router.push(`/auth/login?redirect=${encodeURIComponent(redirect)}`)
        return
      }

      const { data: wines } = await supabase
        .from('catalog_wines').select('*').eq('active', true).order('name')

      const wineIds = (wines ?? []).map(w => w.id)
      const { data: myRatings } = wineIds.length
        ? await supabase.from('cave_ratings').select('*').eq('user_id', user.id).in('wine_id', wineIds)
        : { data: [] }

      // Shopify URLs des vins dégustés en session de jeu
      const { data: gameTastings } = await supabase
        .from('tastings')
        .select('sessions!inner(wines!inner(shopify_url))')
        .eq('user_id', user.id)
      const gameShopifyUrls = new Set(
        (gameTastings ?? []).map((t: any) => t.sessions?.wines?.shopify_url).filter(Boolean)
      )

      const result: WineEntry[] = (wines ?? []).map(wine => ({
        wine,
        myRating: myRatings?.find(r => r.wine_id === wine.id) ?? null,
        playedInGame: !!wine.shopify_url && gameShopifyUrls.has(wine.shopify_url),
      }))

      setEntries(result)
      setFiltered(result)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    let result = entries
    if (filterTab === 'rated') result = result.filter(e => e.myRating?.stars != null)
    if (filterTab === 'unrated') result = result.filter(e => !e.myRating?.stars)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.wine.name?.toLowerCase().includes(q) ||
        e.wine.cave?.toLowerCase().includes(q) ||
        e.wine.cepage?.toLowerCase().includes(q) ||
        e.wine.region?.toLowerCase().includes(q) ||
        e.wine.millesime?.toString().includes(q)
      )
    }
    setFiltered(result)
  }, [search, filterTab, entries])

  function openRating(entry: WineEntry) {
    const id = entry.wine.id
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    const r = entry.myRating
    setFormScore(r?.stars ?? null)
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
      stars: formScore,
      notes_degustation: formNotesDeg || null,
      design_rating: formDesign || null,
      valeur_rating: formValeur || null,
      racheterait: formRachete,
      notes_libres: formNotes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'wine_id,user_id' })

    setEntries(prev => prev.map(e => e.wine.id === wineId ? {
      ...e,
      myRating: { stars: formScore, notes_degustation: formNotesDeg, design_rating: formDesign, valeur_rating: formValeur, racheterait: formRachete }
    } : e))

    setSaving(false)
    setExpanded(null)
    router.refresh()
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
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
            <button onClick={() => router.push('/app/dashboard')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
            <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>Ma cave</span>
          </div>
          <div style={{ display: 'flex', borderTop: '0.5px solid #f0f0f0', marginBottom: '-1px' }}>
            <button onClick={() => router.push('/app/cave')}
              style={{ flex: 1, padding: '10px 0', fontSize: '13px', fontWeight: '400', color: '#888', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer' }}>
              Mes dégustations
            </button>
            <button style={{ flex: 1, padding: '10px 0', fontSize: '13px', fontWeight: '600', color: accent, background: 'none', border: 'none', borderBottom: `2px solid ${accent}`, cursor: 'default' }}>
              Cave à pépites
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1rem 1.5rem' }}>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem' }}>
          {([['all','Tous'], ['rated','✓ Notés'], ['unrated','Non notés']] as [FilterTab, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setFilterTab(val)}
              style={{ padding: '5px 12px', borderRadius: '20px', border: filterTab === val ? 'none' : '0.5px solid #e0e0e0', background: filterTab === val ? accent : '#fff', color: filterTab === val ? '#fff' : '#666', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
              {label}{val === 'all' ? ` (${entries.length})` : val === 'rated' ? ` (${ratedCount})` : ` (${entries.length - ratedCount})`}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#aaa' }}>🔍</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nom, producteur, cépage, région..."
            style={{ width: '100%', padding: '10px 12px 10px 36px', border: '0.5px solid #e0e0e0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
        </div>

        {entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>💎</div>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#1a1a1a', marginBottom: '6px' }}>Le catalogue est vide</div>
            <div style={{ fontSize: '13px', color: '#888' }}>L'admin ajoutera bientôt des vins ici</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
            <div>Aucun vin trouvé pour "{search}"</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(entry => {
              const { wine, myRating, playedInGame } = entry
              const isOpen = expanded === wine.id

              return (
                <div key={wine.id} id={`wine-${wine.id}`} style={{ background: isOpen ? '#fff' : myRating?.stars != null ? '#f7f0ec' : '#fff', border: `${myRating?.stars != null || isOpen ? '1.5px' : '0.5px'} solid ${isOpen ? accent : myRating?.stars != null ? '#b8a89e' : '#e0e0e0'}`, borderRadius: '16px', overflow: 'hidden' }}>

                  <div onClick={() => openRating(entry)}
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'center', position: 'relative' }}>
                    {myRating?.stars != null && (
                      <div style={{ position: 'absolute', top: '10px', right: '10px', background: accent, color: '#fff', borderRadius: '10px', fontSize: '11px', fontWeight: '600', padding: '2px 7px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span>{SCORE_EMOJIS[myRating.stars]}</span>
                        <span>{myRating.stars}/10</span>
                      </div>
                    )}
                    {wine.image_url ? (
                      <img src={wine.image_url} alt={wine.name}
                        style={{ width: '44px', height: '66px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '44px', height: '66px', borderRadius: '8px', background: wine.type === 'rouge' ? '#f5ede8' : wine.type === 'blanc' ? '#f5f3e0' : '#f5e8ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>🍾</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '500', fontSize: '14px', color: '#1a1a1a', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wine.name}</div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '2px' }}>
                        {wine.cave && <span style={{ fontWeight: '500' }}>{wine.cave}</span>}
                        {wine.cave && (wine.cepage || wine.region || wine.millesime) && ' · '}
                        {[wine.cepage, wine.region, wine.millesime].filter(Boolean).join(' · ')}
                      </div>
                      {playedInGame && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eef3ff', color: '#3b5bdb', borderRadius: '8px', padding: '2px 8px', fontSize: '11px', fontWeight: '500', marginTop: '4px', width: 'fit-content' }}>
                          🎮 Dégusté en jeu
                        </div>
                      )}
                      {myRating?.stars != null
                        ? <MiniStars score={myRating.stars} />
                        : <span style={{ fontSize: '12px', color: '#bbb', fontStyle: 'italic' }}>Pas encore noté</span>
                      }
                    </div>
                    <div style={{ fontSize: '16px', color: '#ccc', flexShrink: 0, marginTop: myRating?.stars != null ? '16px' : '0' }}>{isOpen ? '▲' : '▼'}</div>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: '0.5px solid #f0f0f0', padding: '1.25rem', background: '#fdf8f5' }}>

                      {wine.description && (
                        <div style={{ fontSize: '13px', color: '#666', fontStyle: 'italic', marginBottom: '1rem', lineHeight: '1.6' }}>
                          {wine.description}
                        </div>
                      )}

                      {wine.pdf_url && (
                        <a href={wine.pdf_url} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', fontSize: '13px', color: '#444', textDecoration: 'none', fontWeight: '500', marginBottom: '1rem' }}>
                          <span style={{ fontSize: '18px' }}>📄</span>
                          <span>Voir la fiche du vin</span>
                          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#bbb' }}>PDF →</span>
                        </a>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1.25rem' }}>
                        {wine.type && <span style={{ fontSize: '12px', background: '#f5ede8', color: accent, padding: '3px 10px', borderRadius: '8px' }}>{wine.type}</span>}
                        {wine.cave && <span style={{ fontSize: '12px', background: '#f0f0f0', color: '#555', padding: '3px 10px', borderRadius: '8px' }}>🏠 {wine.cave}</span>}
                        {wine.region && <span style={{ fontSize: '12px', background: '#f0f0f0', color: '#555', padding: '3px 10px', borderRadius: '8px' }}>{wine.region}</span>}
                        {wine.prix_chf && <span style={{ fontSize: '12px', background: '#e8f0e8', color: '#27500A', padding: '3px 10px', borderRadius: '8px' }}>CHF {wine.prix_chf}</span>}
                      </div>

                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '8px' }}>Note *</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '40px', lineHeight: 1, flexShrink: 0 }}>
                            {formScore !== null ? SCORE_EMOJIS[formScore] : '🤔'}
                          </span>
                          <div>
                            <ScorePicker score={formScore} onRate={setFormScore} />
                            {formScore !== null
                              ? <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{formScore}/10 · {SCORE_LABELS[formScore]}</div>
                              : <div style={{ fontSize: '11px', color: '#bbb', marginTop: '4px' }}>Tape sur les étoiles pour noter</div>
                            }
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                            <button key={n} onClick={() => setFormScore(n)}
                              style={{ width: '28px', height: '28px', borderRadius: '50%', fontSize: '11px', fontWeight: '500', cursor: 'pointer', border: formScore === n ? 'none' : '0.5px solid #e0e0e0', background: formScore === n ? '#8d323b' : formScore !== null && n < formScore ? '#f5ede8' : '#fff', color: formScore === n ? '#fff' : formScore !== null && n < formScore ? '#8d323b' : '#666', transition: 'all .1s' }}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Notes de dégustation</label>
                        <textarea value={formNotesDeg} onChange={e => setFormNotesDeg(e.target.value)}
                          placeholder="Robe, arôme, texture, longueur..."
                          style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', resize: 'none', minHeight: '72px', fontFamily: 'system-ui', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Design bouteille</label>
                        <div style={{ display: 'flex', gap: '2px', marginBottom: '3px' }}>
                          {[1, 2, 3, 4, 5].map(i => (
                            <button key={i} onClick={() => setFormDesign(i)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '2px', lineHeight: 1, color: formDesign >= i ? '#f0a000' : '#ddd' }}>★</button>
                          ))}
                        </div>
                        {formDesign > 0 && <div style={{ fontSize: '10px', color: '#888' }}>{['Moche','Pas très joli','Moyen','Joli','Magnifique'][formDesign - 1]}</div>}
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Prix</label>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                          {[1,2,3,4,5].map(i => {
                            const colors = ['#3B82F6','#6EBA70','#27500A','#f0a000','#e53e3e']
                            const isSelected = formValeur === i
                            return (
                              <button key={i} onClick={() => setFormValeur(i)}
                                style={{ flex: 1, height: '28px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: isSelected ? colors[i-1] : '#e8e8e8', transition: 'background .15s' }} />
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', color: '#888' }}>Pas assez cher</span>
                          <span style={{ fontSize: '10px', color: formValeur ? '#555' : '#bbb', fontWeight: formValeur ? '500' : '400' }}>
                            {formValeur ? ['Bradé','Abordable','Juste prix','Cher','Trop cher'][formValeur - 1] : '—'}
                          </span>
                          <span style={{ fontSize: '10px', color: '#888' }}>Trop cher</span>
                        </div>
                      </div>

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

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setExpanded(null)}
                          style={{ flex: 1, padding: '10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
                          Annuler
                        </button>
                        <button onClick={() => saveRating(wine.id)} disabled={saving || formScore === null}
                          style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '8px', background: saving || formScore === null ? '#c0a0a0' : accent, color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving || formScore === null ? 'default' : 'pointer' }}>
                          {saving ? 'Sauvegarde...' : myRating ? 'Mettre à jour' : 'Enregistrer'}
                        </button>
                      </div>

                      {wine.shopify_url && (
                        <a href={wine.shopify_url} target="_blank" rel="noreferrer"
                          style={{ display: 'block', textAlign: 'center', marginTop: '10px', fontSize: '13px', color: accent, textDecoration: 'none', fontWeight: '500' }}>
                          Racheter ce vin →
                        </a>
                      )}
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

export default function CavePepitesPage() {
  return (
    <Suspense>
      <CavePepitesContent />
    </Suspense>
  )
}
