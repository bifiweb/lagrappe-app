'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Project, Profile } from '@/types'

interface ProjectWithStats extends Project {
  wine_count?: number
  member_count?: number
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectWithStats | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [activeSection, setActiveSection] = useState<'info' | 'vins' | 'acces'>('info')
  const router = useRouter()
  const supabase = createClient()

  // Form state — projet
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectSlug, setProjectSlug] = useState('')
  const [projectImageUrl, setProjectImageUrl] = useState('')
  const [bottleCount, setBottleCount] = useState(6)

  // Form state — accès
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [accessMode, setAccessMode] = useState<'all' | 'restricted'>('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/app/dashboard'); return }

      const { data: projs } = await supabase
        .from('projects').select('*').order('created_at', { ascending: false })

      const projectsWithStats = await Promise.all((projs ?? []).map(async p => {
        const { count: wineCount } = await supabase
          .from('wines').select('*', { count: 'exact', head: true }).eq('project_id', p.id)
        const { count: memberCount } = await supabase
          .from('project_members').select('*', { count: 'exact', head: true }).eq('project_id', p.id)
        return { ...p, wine_count: wineCount ?? 0, member_count: memberCount ?? 0 }
      }))
      setProjects(projectsWithStats)

      const { data: allUsers } = await supabase
        .from('profiles').select('*').order('email')
      setUsers(allUsers ?? [])

      setLoading(false)
    }
    load()
  }, [])

  function generateSlug(name: string) {
    return name.toLowerCase()
      .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function openEdit(project: ProjectWithStats) {
    setEditingProject(project)
    setProjectName(project.name)
    setProjectDescription(project.description ?? '')
    setProjectSlug(project.slug)
    setProjectImageUrl((project as any).image_url ?? '')
    setSuccess(false)
    setActiveSection('info')

    supabase.from('project_members')
      .select('user_id').eq('project_id', project.id)
      .then(({ data }) => {
        const ids = data?.map(m => m.user_id) ?? []
        setMemberIds(ids)
        setAccessMode(ids.length === 0 ? 'all' : 'restricted')
      })

    supabase.from('wines')
      .select('*', { count: 'exact', head: true }).eq('project_id', project.id)
      .then(({ count }) => setBottleCount(count ?? 6))
  }

  function startCreate() {
    setEditingProject(null)
    setProjectName('')
    setProjectDescription('')
    setProjectSlug('')
    setProjectImageUrl('')
    setBottleCount(6)
    setMemberIds([])
    setAccessMode('all')
    setSuccess(false)
    setActiveSection('info')
    setCreating(true)
  }

  async function saveProject() {
    if (!projectName.trim()) return
    setSaving(true)
    setSuccess(false)

    const slug = projectSlug || generateSlug(projectName)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let projectId = editingProject?.id

    if (editingProject) {
      await supabase.from('projects').update({
        name: projectName,
        description: projectDescription || null,
        slug,
        image_url: projectImageUrl || null,
      }).eq('id', editingProject.id)
    } else {
      const { data: newProject } = await supabase.from('projects').insert({
        name: projectName,
        description: projectDescription || null,
        slug,
        image_url: projectImageUrl || null,
        created_by: user.id,
        active: true,
      }).select().single()
      projectId = newProject?.id

      if (projectId) {
        const winesData = Array.from({ length: bottleCount }, (_, i) => ({
          project_id: projectId,
          bottle_number: i + 1,
          type: 'rouge' as const,
          revealed: false,
        }))
        await supabase.from('wines').insert(winesData)
      }
    }

    if (projectId) {
      await supabase.from('project_members').delete().eq('project_id', projectId)
      if (accessMode === 'restricted' && memberIds.length > 0) {
        await supabase.from('project_members').insert(
          memberIds.map(uid => ({ project_id: projectId, user_id: uid }))
        )
      }
    }

    const { data: projs } = await supabase
      .from('projects').select('*').order('created_at', { ascending: false })
    const projectsWithStats = await Promise.all((projs ?? []).map(async p => {
      const { count: wineCount } = await supabase
        .from('wines').select('*', { count: 'exact', head: true }).eq('project_id', p.id)
      const { count: memberCount } = await supabase
        .from('project_members').select('*', { count: 'exact', head: true }).eq('project_id', p.id)
      return { ...p, wine_count: wineCount ?? 0, member_count: memberCount ?? 0 }
    }))
    setProjects(projectsWithStats)

    setSaving(false)
    setSuccess(true)
    setCreating(false)
    if (!editingProject) setEditingProject(null)
  }

  function toggleMember(userId: string) {
    if (memberIds.includes(userId))
      setMemberIds(memberIds.filter(id => id !== userId))
    else
      setMemberIds([...memberIds, userId])
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  const accent = '#8d323b'
  const showForm = creating || editingProject !== null

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>Gestion des projets</span>
          <span style={{ fontSize: '11px', background: '#faeeda', color: '#633806', padding: '3px 10px', borderRadius: '10px', fontWeight: '500' }}>Admin</span>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem', display: 'grid', gridTemplateColumns: showForm ? '1fr 1.5fr' : '1fr', gap: '1.5rem' }}>

        {/* Liste des projets */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {projects.length} projet{projects.length > 1 ? 's' : ''}
            </div>
            <button onClick={startCreate}
              style={{ padding: '7px 14px', background: accent, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
              + Nouveau projet
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {projects.map(project => (
              <div key={project.id}
                onClick={() => openEdit(project)}
                style={{
                  background: '#fff',
                  border: editingProject?.id === project.id ? `2px solid ${accent}` : '0.5px solid #e0e0e0',
                  borderRadius: '12px', padding: '14px 16px',
                  cursor: 'pointer',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Image ou emoji */}
                  {(project as any).image_url ? (
                    <img src={(project as any).image_url} alt={project.name}
                      style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                      🍾
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '3px' }}>
                      {project.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      {project.description ?? 'Pas de description'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ fontSize: '11px', background: '#f5ede8', color: accent, padding: '2px 8px', borderRadius: '6px' }}>
                      🍾 {project.wine_count}
                    </span>
                    <span style={{ fontSize: '11px', background: project.member_count === 0 ? '#e8f0e8' : '#edeaf8', color: project.member_count === 0 ? '#27500A' : '#3C3489', padding: '2px 8px', borderRadius: '6px' }}>
                      {project.member_count === 0 ? '🌍 Public' : `👥 ${project.member_count}`}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <button onClick={e => { e.stopPropagation(); router.push('/app/admin/wines') }}
                    style={{ fontSize: '11px', color: accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    Gérer les vins →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Formulaire */}
        {showForm && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#1a1a1a', marginBottom: '1rem' }}>
              {creating ? '+ Nouveau projet' : `Modifier — ${editingProject?.name}`}
            </div>

            {success && (
              <div style={{ background: '#e8f0e8', color: '#27500A', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '1rem' }}>
                ✓ Sauvegardé !
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', border: '0.5px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.25rem' }}>
              {(['info', 'vins', 'acces'] as const).map(s => (
                <button key={s} onClick={() => setActiveSection(s)}
                  style={{ flex: 1, padding: '8px', background: activeSection === s ? accent : 'transparent', color: activeSection === s ? '#fff' : '#888', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                  {s === 'info' ? 'Infos' : s === 'vins' ? 'Bouteilles' : 'Accès'}
                </button>
              ))}
            </div>

            {/* Section Infos */}
            {activeSection === 'info' && (
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Nom du projet *</label>
                  <input value={projectName}
                    onChange={e => {
                      setProjectName(e.target.value)
                      if (!editingProject) setProjectSlug(generateSlug(e.target.value))
                    }}
                    placeholder="ex: Swiss Wine Challenge 2026"
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Description</label>
                  <textarea value={projectDescription} onChange={e => setProjectDescription(e.target.value)}
                    placeholder="ex: Coffret de 6 vins suisses à déguster à l'aveugle"
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'none', minHeight: '70px', fontFamily: 'system-ui', boxSizing: 'border-box' }} />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>
                    Slug URL <span style={{ fontWeight: '400', color: '#aaa' }}>(généré automatiquement)</span>
                  </label>
                  <input value={projectSlug} onChange={e => setProjectSlug(e.target.value)}
                    placeholder="ex: swiss-wine-challenge-2026"
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '3px' }}>
                    URL : /app/project/{projectSlug || '...'}
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '4px' }}>Image URL</label>
                  <input value={projectImageUrl} onChange={e => setProjectImageUrl(e.target.value)}
                    placeholder="https://cdn.shopify.com/..."
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  {projectImageUrl && (
                    <img src={projectImageUrl} alt="Aperçu"
                      style={{ maxHeight: '80px', marginTop: '8px', borderRadius: '8px', objectFit: 'contain' }} />
                  )}
                </div>
              </div>
            )}

            {/* Section Bouteilles */}
            {activeSection === 'vins' && (
              <div>
                {creating ? (
                  <div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '8px' }}>
                        Nombre de bouteilles
                      </label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[1, 2, 3, 4, 5, 6, 9, 12].map(n => (
                          <button key={n} onClick={() => setBottleCount(n)}
                            style={{
                              width: '44px', height: '44px', borderRadius: '8px', fontSize: '15px', fontWeight: '500', cursor: 'pointer',
                              border: bottleCount === n ? 'none' : '0.5px solid #e0e0e0',
                              background: bottleCount === n ? accent : '#fff',
                              color: bottleCount === n ? '#fff' : '#666',
                            }}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#888' }}>
                      💡 {bottleCount} bouteilles seront créées automatiquement.
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
                      Ce projet contient <strong>{editingProject?.wine_count}</strong> bouteille{(editingProject?.wine_count ?? 0) > 1 ? 's' : ''}.
                    </div>
                    <button onClick={() => router.push('/app/admin/wines')}
                      style={{ width: '100%', padding: '10px', background: '#f5f5f5', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: '#1a1a1a' }}>
                      Configurer les vins →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Section Accès */}
            {activeSection === 'acces' && (
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '8px' }}>Visibilité</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div onClick={() => setAccessMode('all')}
                      style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', border: accessMode === 'all' ? `2px solid ${accent}` : '0.5px solid #e0e0e0', background: accessMode === 'all' ? '#fdf5f5' : '#fff' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>🌍 Public</div>
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Tous les utilisateurs voient ce projet</div>
                    </div>
                    <div onClick={() => setAccessMode('restricted')}
                      style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', border: accessMode === 'restricted' ? `2px solid ${accent}` : '0.5px solid #e0e0e0', background: accessMode === 'restricted' ? '#fdf5f5' : '#fff' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>🔒 Restreint</div>
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Uniquement les utilisateurs sélectionnés</div>
                    </div>
                  </div>
                </div>

                {accessMode === 'restricted' && (
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '8px' }}>
                      Utilisateurs autorisés <span style={{ fontWeight: '400', color: '#aaa' }}>({memberIds.length} sélectionnés)</span>
                    </label>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '0.5px solid #e0e0e0', borderRadius: '8px', marginBottom: '12px' }}>
                      {users.filter(u => u.role !== 'admin').map(user => (
                        <div key={user.id}
                          onClick={() => toggleMember(user.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderBottom: '0.5px solid #f0f0f0', cursor: 'pointer', background: memberIds.includes(user.id) ? '#fdf5f5' : '#fff' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '500', color: accent, flexShrink: 0 }}>
                            {(user.display_name ?? user.email)[0].toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>{user.display_name ?? '—'}</div>
                            <div style={{ fontSize: '11px', color: '#888' }}>{user.email}</div>
                          </div>
                          <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: memberIds.includes(user.id) ? 'none' : '1.5px solid #ddd', background: memberIds.includes(user.id) ? accent : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {memberIds.includes(user.id) && <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {editingProject && (
                      <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>🔗 Lien d'invitation</div>
                        <div style={{ fontSize: '11px', color: accent, fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '8px' }}>
                          {typeof window !== 'undefined' ? `${window.location.origin}/app/join/${(editingProject as any).invite_token}` : ''}
                        </div>
                        <button onClick={() => navigator.clipboard.writeText(
                          `${window.location.origin}/app/join/${(editingProject as any).invite_token}`
                        )}
                          style={{ fontSize: '12px', padding: '5px 10px', border: '0.5px solid #e0e0e0', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#444' }}>
                          📋 Copier le lien
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '1.25rem' }}>
              <button onClick={() => { setCreating(false); setEditingProject(null) }}
                style={{ flex: 1, padding: '10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={saveProject} disabled={saving || !projectName.trim()}
                style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '8px', background: saving || !projectName.trim() ? '#c0a0a0' : accent, color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving || !projectName.trim() ? 'default' : 'pointer' }}>
                {saving ? 'Sauvegarde...' : creating ? 'Créer le projet' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}