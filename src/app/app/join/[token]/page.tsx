'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useT } from '@/lib/i18n'

export default function JoinProjectPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already'>('loading')
  const [projectName, setProjectName] = useState('')
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const t = useT()
  const token = params.token as string

  useEffect(() => {
    async function join() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/auth/login?redirect=/app/join/${token}`)
        return
      }

      console.log('Token:', token)
      console.log('User:', user.id)

      const { data: projectRows, error: rpcError } = await supabase
        .rpc('get_project_by_invite_token', { p_token: token })

      console.log('ProjectRows:', projectRows)
      console.log('RPC Error:', rpcError)

      const project = projectRows?.[0] ?? null

      if (!project) {
        setStatus('error')
        return
      }

      setProjectName(project.name)

      const { data: existing } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing) {
        setStatus('already')
        setTimeout(() => router.push(`/app/project/${project.slug}`), 2000)
        return
      }

      const { error } = await supabase
        .from('project_members')
        .insert({ project_id: project.id, user_id: user.id })

      if (error) {
        console.log('Insert error:', error)
        setStatus('error')
      } else {
        setStatus('success')
        setTimeout(() => router.push(`/app/project/${project.slug}`), 2000)
      }
    }
    join()
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: '#fdf8f5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>

        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fff', border: '0.5px solid #e0e0e0', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="https://cdn.shopify.com/s/files/1/0383/1660/5571/files/La-grappe-logo-fond-blanc.png?v=1718613636"
            alt="La Grappe" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
        </div>

        {status === 'loading' && (
          <>
            <div style={{ fontSize: '18px', fontWeight: '500', color: '#1a1a1a', marginBottom: '8px' }}>
              {t('Vérification en cours...')}
            </div>
            <div style={{ fontSize: '14px', color: '#888' }}>
              {t('On vérifie ton invitation 🍷')}
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '32px', marginBottom: '1rem' }}>🎉</div>
            <div style={{ fontSize: '18px', fontWeight: '500', color: '#1a1a1a', marginBottom: '8px' }}>
              {t('Bienvenue dans {projet} !', { projet: projectName })}
            </div>
            <div style={{ fontSize: '14px', color: '#888' }}>
              {t('Tu as accès au projet. Redirection en cours...')}
            </div>
          </>
        )}

        {status === 'already' && (
          <>
            <div style={{ fontSize: '32px', marginBottom: '1rem' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: '500', color: '#1a1a1a', marginBottom: '8px' }}>
              {t('Tu as déjà accès à {projet} !', { projet: projectName })}
            </div>
            <div style={{ fontSize: '14px', color: '#888' }}>
              {t('Redirection en cours...')}
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '32px', marginBottom: '1rem' }}>❌</div>
            <div style={{ fontSize: '18px', fontWeight: '500', color: '#1a1a1a', marginBottom: '8px' }}>
              {t('Lien invalide')}
            </div>
            <div style={{ fontSize: '14px', color: '#888', marginBottom: '1.5rem' }}>
              {t("Ce lien d'invitation n'est pas valide ou a expiré.")}
            </div>
            <button onClick={() => router.push('/app/dashboard')}
              style={{ padding: '10px 20px', background: '#8d323b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
              {t('Retour au dashboard')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}