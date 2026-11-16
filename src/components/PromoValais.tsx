'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'

// Encart promo Noël 2026 : « Le Valais à l'aveugle ».
// Disparaît tout seul après la date de fin. Le ✕ le masque jusqu'à la prochaine visite (sessionStorage).
const END = new Date('2026-12-25T00:00:00+01:00')
const KEY = 'promo_valais_hidden'
const IMG = 'https://cdn.shopify.com/s/files/1/0383/1660/5571/files/SWC-gens-grapp.png?v=1793193462&width=640'

export default function PromoValais({ source, hide = false }: { source: string; hide?: boolean }) {
  const t = useT()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (hide || Date.now() >= END.getTime()) { setShow(false); return }
    let hidden = false
    try { hidden = sessionStorage.getItem(KEY) === '1' } catch {}
    setShow(!hidden)
  }, [hide])

  if (!show) return null

  const url = `https://lagrappe.ch/products/le-valais-a-l-aveugle?utm_source=lagrapp&utm_medium=encart&utm_campaign=valais-noel-2026&utm_content=${encodeURIComponent(source)}`

  const close = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    try { sessionStorage.setItem(KEY, '1') } catch {}
    setShow(false)
  }

  return (
    <a href={url} target="_blank" rel="noopener"
      style={{
        position: 'relative', display: 'block', textDecoration: 'none',
        background: 'linear-gradient(135deg, #8d323b, #5e1f27)', color: '#fff',
        borderRadius: '16px', overflow: 'hidden', margin: '0 0 1.5rem',
        boxShadow: '0 4px 14px rgba(94,31,39,.25)',
      }}>
      <img src={IMG} alt="" loading="lazy"
        style={{ display: 'block', width: '100%', aspectRatio: '3 / 1.3', objectFit: 'cover', objectPosition: 'center 40%' }} />
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '.08em', textTransform: 'uppercase', opacity: .8, marginBottom: '4px' }}>
          {t('🎄 Nouveau pour Noël')}
        </div>
        <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>
          {t("Le Valais à l'aveugle")}
        </div>
        <div style={{ fontSize: '13px', lineHeight: 1.5, opacity: .92, marginBottom: '12px' }}>
          {t('Des vins valaisans à deviner, tous les joueurs ensemble dans La grAPP. En solo, en duo ou en coffret de 6.')}
        </div>
        <span style={{ display: 'inline-block', background: '#fff', color: '#8d323b', borderRadius: '10px', padding: '9px 14px', fontSize: '14px', fontWeight: '600' }}>
          {t('Découvrir le jeu →')}
        </span>
      </div>
      <button onClick={close} aria-label={t('Fermer')}
        style={{
          position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%',
          border: 'none', background: 'rgba(0,0,0,.45)', color: '#fff', fontSize: '14px', cursor: 'pointer', lineHeight: '28px', padding: 0,
        }}>✕</button>
    </a>
  )
}
