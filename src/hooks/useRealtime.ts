'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Session, SessionPlayer } from '@/types'

// Hook : s'abonner aux updates d'une session en temps réel
export function useSessionRealtime(
  sessionId: string,
  callbacks: {
    onSessionUpdate?: (session: Partial<Session>) => void
    onPlayerJoin?: (player: SessionPlayer) => void
    onPlayerUpdate?: (player: Partial<SessionPlayer>) => void
    onReveal?: () => void
  }
) {
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!sessionId) return

    const channel = supabase.channel(`session:${sessionId}`)

    // Update de la session (status change, révélation...)
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
      (payload) => {
        const updated = payload.new as Session
        callbacks.onSessionUpdate?.(updated)
        if (updated.status === 'revealed') {
          callbacks.onReveal?.()
        }
      }
    )

    // Nouveaux joueurs qui rejoignent
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'session_players', filter: `session_id=eq.${sessionId}` },
      (payload) => {
        callbacks.onPlayerJoin?.(payload.new as SessionPlayer)
      }
    )

    // Update des joueurs (tasting_done, points...)
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'session_players', filter: `session_id=eq.${sessionId}` },
      (payload) => {
        callbacks.onPlayerUpdate?.(payload.new as Partial<SessionPlayer>)
      }
    )

    channel.subscribe()
    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])
}

// Hook : s'abonner aux votes en temps réel
export function useVotesRealtime(
  sessionId: string,
  onVoteAdded: (totalVotes: number) => void
) {
  const supabase = createClient()

  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`votes:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `session_id=eq.${sessionId}` },
        async () => {
          // Récupérer le total de votes
          const { count } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sessionId)
          onVoteAdded(count ?? 0)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])
}
