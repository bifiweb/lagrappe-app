'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile, Project } from '@/types'
import { avatarUrl } from '@/lib/gameCharacters'
import PushBanner from '@/components/PushBanner'

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
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

      if (prof?.role === 'admin') {
        // Admin voit tous les projets actifs
        const { data: proj } = await supabase
          .from('projects').select('*').eq('active', true).order('created_at')
        setProjects(proj ?? [])
      } else {
        // Utilise la fonction SQL qui gère la visibilité
        const { data: proj } = await supabase
          .rpc('get_visible_projects', { p_user_id: user.id })
        setProjects(proj ?? [])
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff', border: '0.5px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src="https://cdn.shopify.com/s/files/1/0383/1660/5571/files/La-grappe-logo-fond-blanc.png?v=1718613636"
                alt="La Grappe"
                style={{ width: '22px', height: '22px', objectFit: 'contain' }}
              />
            </div>
            <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>La Grappe</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {profile?.role === 'admin' && (
              <span style={{ fontSize: '11px', background: '#faeeda', color: '#633806', padding: '3px 10px', borderRadius: '10px', fontWeight: '500' }}>
                Admin
              </span>
            )}
            {(() => {
              return (
                <button onClick={() => router.push('/app/profile')}
                  title="Mon profil"
                  style={{ position: 'relative', width: '36px', height: '36px', padding: 0, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: profile?.avatar ? '#f5ede8' : '#8d323b', border: profile?.avatar ? '2px solid #8d323b' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600', color: '#fff', overflow: 'hidden' }}>
                    {profile?.avatar
                      ? <img src={avatarUrl(profile.avatar)} width={36} height={36} alt="" style={{ objectFit: 'cover', display: 'block' }} />
                      : (profile?.display_name ?? profile?.email ?? '?')[0].toUpperCase()
                    }
                  </div>
                </button>
              )
            })()}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        <PushBanner />

        {/* Salutation */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '500', color: '#1a1a1a', margin: '0 0 4px' }}>
            Bonjour {profile?.display_name ?? profile?.email?.split('@')[0]} 👋
          </h1>
          <p style={{ fontSize: '14px', color: '#888', margin: '0 0 12px' }}>
            Choisis un projet pour commencer à déguster
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => router.push('/app/cave')}
              style={{ padding: '8px 14px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', fontSize: '13px', color: '#444', cursor: 'pointer' }}>
              🍷 Ma cave
            </button>
          </div>
        </div>

        {/* Projets */}
        {projects.length === 0 ? (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '1rem' }}>🍾</div>
            <p style={{ color: '#888', fontSize: '14px', margin: '0 0 1rem' }}>
              Aucun projet disponible pour l'instant.
            </p>
            {profile?.role === 'admin' && (
              <button onClick={() => router.push('/app/admin/projects')}
                style={{ padding: '10px 20px', background: '#8d323b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                Créer un projet →
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {projects.map(project => (
              <div key={project.id}
                onClick={() => router.push(`/app/project/${project.slug}`)}
                style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#8d323b')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e0e0e0')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {(project as any).image_url ? (
                    <img src={(project as any).image_url} alt={project.name}
                      style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
                      🍾
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', fontSize: '15px', color: '#1a1a1a', marginBottom: '3px' }}>
                      {project.name}
                    </div>
                    {project.description && (
                      <div style={{ fontSize: '13px', color: '#888' }}>
                        {project.description}
                      </div>
                    )}
                  </div>
                  <div style={{ color: '#ccc', fontSize: '18px' }}>›</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Admin */}
        {profile?.role === 'admin' && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Administration
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { emoji: '🎮', label: 'Sessions', sub: 'Vue globale', href: '/app/admin' },
                { emoji: '📋', label: 'Feedbacks', sub: 'Avis clients', href: '/app/admin/feedbacks' },
                { emoji: '📁', label: 'Projets', sub: 'Gérer', href: '/app/admin/projects' },
                { emoji: '🍷', label: 'Vins', sub: 'Notes grappistes', href: '/app/admin/wines' },
                { emoji: '💎', label: 'Cave à pépites', sub: 'Catalogue', href: '/app/admin/catalog' },
                { emoji: '🔔', label: 'Notifications', sub: 'Push', href: '/app/admin/notifications' },
              ].map(({ emoji, label, sub, href }) => (
                <button key={label} onClick={() => router.push(href)}
                  style={{
                    padding: '14px 12px', borderRadius: '14px', border: '0.5px solid #e0e0e0',
                    background: '#fff', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', flexDirection: 'column', gap: '4px',
                  }}>
                  <span style={{ fontSize: '22px', lineHeight: 1 }}>{emoji}</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>{label}</span>
                  <span style={{ fontSize: '11px', color: '#888' }}>{sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}