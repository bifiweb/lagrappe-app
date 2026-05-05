import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { NextResponse } from 'next/server'

export const maxDuration = 30

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export async function POST(req: Request) {
  try {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL ?? 'info@lagrappe.ch'}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    )

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { title, body, url } = await req.json()
    if (!title || !body) return NextResponse.json({ error: 'title and body required' }, { status: 400 })

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: subscriptions } = await adminClient
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')

    if (!subscriptions?.length) {
      return NextResponse.json({ ok: true, recipients: 0 })
    }

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
          )
          sent++
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            dead.push(sub.endpoint)
          }
        }
      })
    )

    if (dead.length) {
      await adminClient.from('push_subscriptions').delete().in('endpoint', dead)
    }

    await supabase.from('push_notifications').insert({
      title, body, url: url ?? null, sent_by: user.id, recipients: sent,
    })

    return NextResponse.json({ ok: true, recipients: sent, cleaned: dead.length })

  } catch (err: any) {
    console.error('[push/send]', err)
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 })
  }
}
