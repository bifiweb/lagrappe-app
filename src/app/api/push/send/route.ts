import { createClient as createAdminClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { NextResponse } from 'next/server'

export const maxDuration = 30

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)
    ),
  ])
}

export async function POST(req: Request) {
  // 1. Vérifier les variables d'environnement
  const missing = [
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    !process.env.VAPID_PRIVATE_KEY && 'VAPID_PRIVATE_KEY',
    !process.env.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
    !process.env.NEXT_PUBLIC_SUPABASE_URL && 'NEXT_PUBLIC_SUPABASE_URL',
  ].filter(Boolean)
  if (missing.length) {
    return NextResponse.json({ error: `Variables manquantes: ${missing.join(', ')}` }, { status: 500 })
  }

  try {
    // 2. Auth via Bearer token
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // 3. Valider le token (5s timeout)
    const { data: { user } } = await withTimeout(
      adminClient.auth.getUser(token),
      5000,
      'auth.getUser'
    )
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 4. Vérifier rôle admin (5s timeout)
    const { data: profile } = await withTimeout(
      adminClient.from('profiles').select('role').eq('id', user.id).single(),
      5000,
      'profiles.select'
    )
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // 5. Parser le body
    const { title, body, url } = await req.json()
    if (!title || !body) return NextResponse.json({ error: 'title et body requis' }, { status: 400 })

    // 6. Récupérer les abonnés (5s timeout)
    const { data: subscriptions } = await withTimeout(
      adminClient.from('push_subscriptions').select('endpoint, p256dh, auth'),
      5000,
      'push_subscriptions.select'
    )

    if (!subscriptions?.length) {
      return NextResponse.json({ ok: true, recipients: 0 })
    }

    // 7. Configurer webpush et envoyer
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL ?? 'info@lagrappe.ch'}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    )

    const payload = JSON.stringify({ title, body, url: url ?? '/' })
    let sent = 0
    const dead: string[] = []

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await withTimeout(
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            ),
            8000,
            'sendNotification'
          )
          sent++
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) dead.push(sub.endpoint)
        }
      })
    )

    if (dead.length) {
      await adminClient.from('push_subscriptions').delete().in('endpoint', dead)
    }

    await adminClient.from('push_notifications').insert({
      title, body, url: url ?? null, sent_by: user.id, recipients: sent,
    })

    return NextResponse.json({ ok: true, recipients: sent, cleaned: dead.length })

  } catch (err: any) {
    console.error('[push/send]', err.message)
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 })
  }
}
