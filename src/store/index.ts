import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Tasting, SessionPlayer } from '@/types'

// ---- Store dégustation (persiste localement entre les étapes) ----
interface TastingStore {
  // Données de la fiche en cours
  draft: Partial<Tasting>
  sessionId: string | null
  wineType: 'rouge' | 'blanc' | 'rose' | 'petillant' | null
  currentStep: number   // 0=vue 1=nez 2=bouche 3=notes 4=devinette

  // Actions
  setSessionId: (id: string) => void
  setWineType: (type: TastingStore['wineType']) => void
  updateDraft: (data: Partial<Tasting>) => void
  setStep: (step: number) => void
  resetDraft: () => void
}

export const useTastingStore = create<TastingStore>()(
  persist(
    (set) => ({
      draft: { aromes: [], accords: [] },
      sessionId: null,
      wineType: null,
      currentStep: 0,

      setSessionId: (id) => set({ sessionId: id }),
      setWineType: (type) => set({ wineType: type }),
      updateDraft: (data) => set((state) => ({
        draft: { ...state.draft, ...data }
      })),
      setStep: (step) => set({ currentStep: step }),
      resetDraft: () => set({
        draft: { aromes: [], accords: [] },
        sessionId: null,
        wineType: null,
        currentStep: 0,
      }),
    }),
    { name: 'lagrappe-tasting' }
  )
)

// ---- Store session (état temps réel) ----
interface SessionStore {
  players: SessionPlayer[]
  sessionStatus: string
  chef: SessionPlayer | null

  setPlayers: (players: SessionPlayer[]) => void
  updatePlayer: (id: string, data: Partial<SessionPlayer>) => void
  addPlayer: (player: SessionPlayer) => void
  setSessionStatus: (status: string) => void
  setChef: (chef: SessionPlayer) => void
  reset: () => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  players: [],
  sessionStatus: 'lobby',
  chef: null,

  setPlayers: (players) => set({ players }),
  updatePlayer: (id, data) => set((state) => ({
    players: state.players.map(p => p.id === id ? { ...p, ...data } : p)
  })),
  addPlayer: (player) => set((state) => ({
    players: [...state.players.filter(p => p.id !== player.id), player]
  })),
  setSessionStatus: (status) => set({ sessionStatus: status }),
  setChef: (chef) => set({ chef }),
  reset: () => set({ players: [], sessionStatus: 'lobby', chef: null }),
}))
