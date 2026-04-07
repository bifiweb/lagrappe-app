'use client'

import { useRouter } from 'next/navigation'

export default function NotFound() {
  const router = useRouter()

  return (
    <div style={{
      minHeight: '100vh', background: '#fdf8f5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#fff', border: '0.5px solid #e0e0e0', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="https://cdn.shopify.com/s/files/1/0383/1660/5571/files/La-grappe-logo-fond-blanc.png?v=1718613636"
            alt="La Grappe" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
        </div>
        <div style={{ fontSize: '72px', fontWeight: '500', color: '#8d323b', lineHeight: 1, marginBottom: '0.5rem' }}>
          404
        </div>
        <div style={{ fontSize: '18px', fontWeight: '500', color: '#1a1a1a', marginBottom: '8px' }}>
          Ce vin n'existe pas 🍷
        </div>
        <div style={{ fontSize: '14px', color: '#888', marginBottom: '2rem', lineHeight: 1.6 }}>
          La bouteille que tu cherches s'est peut-être évaporée... ou tu t'es trompé de chemin après le 3ème verre.
        </div>
        <button onClick={() => router.push('/app/dashboard')}
          style={{ padding: '12px 24px', background: '#8d323b', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
          Retour au dashboard →
        </button>
      </div>
    </div>
  )
}