'use client'

import { useRouter } from 'next/navigation'

const TILES = [
  { emoji: '🎮', label: 'Sessions',      sub: 'Vue globale',     href: '/app/admin' },
  { emoji: '📋', label: 'Feedbacks',     sub: 'Avis clients',    href: '/app/admin/feedbacks' },
  { emoji: '📁', label: 'Projets',       sub: 'Gérer',           href: '/app/admin/projects' },
  { emoji: '🍷', label: 'Vins',          sub: 'Notes grappistes',href: '/app/admin/wines' },
  { emoji: '💎', label: 'Cave à pépites',sub: 'Catalogue',       href: '/app/admin/catalog' },
  { emoji: '🔔', label: 'Notifications', sub: 'Push',            href: '/app/admin/notifications' },
]

const accent = '#8d323b'

export default function AdminNav({ active }: { active: string }) {
  const router = useRouter()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '1.5rem' }}>
      {TILES.map(({ emoji, label, sub, href }) => {
        const isActive = href === active
        return (
          <button key={label} onClick={() => !isActive && router.push(href)}
            style={{
              padding: '12px 10px', borderRadius: '12px',
              border: isActive ? `2px solid ${accent}` : '0.5px solid #e0e0e0',
              background: isActive ? '#fdf5f5' : '#fff',
              cursor: isActive ? 'default' : 'pointer',
              textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '3px',
            }}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{emoji}</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: isActive ? accent : '#1a1a1a' }}>{label}</span>
            <span style={{ fontSize: '10px', color: '#888' }}>{sub}</span>
          </button>
        )
      })}
    </div>
  )
}
