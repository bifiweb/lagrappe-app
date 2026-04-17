'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import type { Project } from '@/types'

export default function StartProjectPage() {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: proj } = await supabase
        .from('projects').select('*').eq('slug', slug).eq('active', true).single()

      if (!proj) { setNotFound(true); setLoading(false); return }
      setProject(proj)

      if (user) {
        router.replace(`/app/project/${slug}`)
        return
      }

      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🍾</div>
        <div style={{ fontSize: '16px', fontWeight: '500', color: '#1a1a1a', marginBottom: '8px' }}>Projet introuvable</div>
        <div style={{ fontSize: '14px', color: '#888' }}>Ce lien n'est plus valide ou le projet a été supprimé.</div>
      </div>
    </div>
  )

  const redirectUrl = `/app/project/${slug}`

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fff', border: '0.5px solid #e0e0e0', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src="https://cdn.shopify.com/s/files/1/0383/1660/5571/files/La-grappe-logo-fond-blanc.png?v=1718613636"
              alt="La Grappe"
              style={{ width: '40px', height: '40px', objectFit: 'contain' }}
            />
          </div>
          <div style={{ fontSize: '13px', color: '#888' }}>La Grappe — Dégustation à l'aveugle</div>
        </div>

        {/* Carte projet */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '20px', overflow: 'hidden', marginBottom: '1.5rem' }}>
          {(project as any)?.image_url && (
            <img
              src={(project as any).image_url}
              alt={project!.name}
              style={{ width: '100%', height: '160px', objectFit: 'cover' }}
            />
          )}
          {!(project as any)?.image_url && (
            <div style={{ width: '100%', height: '100px', background: 'linear-gradient(135deg, #8d323b 0%, #c0545f 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>
              🍾
            </div>
          )}
          <div style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '18px', fontWeight: '500', color: '#1a1a1a', marginBottom: '6px' }}>
              {project!.name}
            </div>
            {project!.description && (
              <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.5' }}>
                {project!.description}
              </div>
            )}
          </div>
        </div>

        {/* CTA connexion */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: '500', color: '#1a1a1a', marginBottom: '6px' }}>
            Prêt à déguster ?
          </div>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.5rem' }}>
            Connecte-toi ou crée un compte gratuit pour rejoindre ce projet.
          </div>
          <button
            onClick={() => router.push(`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`)}
            style={{ width: '100%', padding: '14px', background: '#8d323b', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
            Se connecter / Créer un compte
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#aaa', marginTop: '1.5rem' }}>
          Swiss Wine Challenge — La Grappe © 2025
        </p>
      </div>
    </div>
  )
}
