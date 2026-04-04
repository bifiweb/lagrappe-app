import { SCORING } from '@/types'
import type { Tasting, GrappisteNotes } from '@/types'

// Calcul côté client pour affichage preview
// Le calcul officiel est fait côté serveur (SQL function)

export function calcAromePoints(
  myAromes: string[],
  allTastings: Tasting[],
  officialAromes: string[]
): number {
  let pts = 0
  for (const arome of myAromes) {
    const count = allTastings.filter(t =>
      t.aromes.includes(arome)
    ).length
    pts += (count - 1) * SCORING.AROME_PER_PLAYER
    if (officialAromes.includes(arome)) {
      pts += SCORING.AROME_GRAPPISTE_BONUS
    }
  }
  return Math.max(0, pts)
}

export function calcTotalPoints(
  tasting: Partial<Tasting>,
  notes: GrappisteNotes,
  allTastings: Tasting[]
): {
  pts_robe: number
  pts_aromes: number
  pts_bouche: number
  pts_prix: number
  pts_millesime: number
  pts_cepage: number
  pts_region: number
  total: number
  breakdown: ScoreBreakdown[]
} {
  const pts_robe = tasting.robe === notes.robe
    ? SCORING.ROBE_CORRECT : SCORING.ROBE_WRONG

  const pts_aromes = calcAromePoints(
    tasting.aromes ?? [],
    allTastings,
    notes.aromes_officiels
  )

  const pts_bouche = tasting.bouche === notes.bouche
    ? SCORING.BOUCHE_CORRECT : SCORING.BOUCHE_WRONG

  const pts_prix = tasting.prix_estime === notes.prix_chf
    ? SCORING.PRIX_CORRECT : SCORING.PRIX_WRONG

  const pts_millesime = tasting.millesime_estime === notes.millesime
    ? SCORING.MILLESIME_CORRECT : SCORING.MILLESIME_WRONG

  const pts_cepage = tasting.cepage_guess?.toLowerCase() === notes.cepage?.toLowerCase()
    ? SCORING.CEPAGE_CORRECT : SCORING.CEPAGE_WRONG

  const pts_region = tasting.region_guess?.toLowerCase() === notes.region?.toLowerCase()
    ? SCORING.REGION_CORRECT : SCORING.REGION_WRONG

  const total = pts_robe + pts_aromes + pts_bouche + pts_prix + pts_millesime + pts_cepage + pts_region

  const breakdown: ScoreBreakdown[] = [
    { label: 'Robe', pts: pts_robe, correct: pts_robe === SCORING.ROBE_CORRECT, max: SCORING.ROBE_CORRECT },
    { label: 'Arômes', pts: pts_aromes, correct: pts_aromes > 200, max: 600 },
    { label: 'Bouche', pts: pts_bouche, correct: pts_bouche === SCORING.BOUCHE_CORRECT, max: SCORING.BOUCHE_CORRECT },
    { label: 'Prix', pts: pts_prix, correct: pts_prix === SCORING.PRIX_CORRECT, max: SCORING.PRIX_CORRECT },
    { label: 'Millésime', pts: pts_millesime, correct: pts_millesime === SCORING.MILLESIME_CORRECT, max: SCORING.MILLESIME_CORRECT },
    { label: 'Cépage', pts: pts_cepage, correct: pts_cepage === SCORING.CEPAGE_CORRECT, max: SCORING.CEPAGE_CORRECT },
    { label: 'Région', pts: pts_region, correct: pts_region === SCORING.REGION_CORRECT, max: SCORING.REGION_CORRECT },
  ]

  return { pts_robe, pts_aromes, pts_bouche, pts_prix, pts_millesime, pts_cepage, pts_region, total, breakdown }
}

export interface ScoreBreakdown {
  label: string
  pts: number
  correct: boolean
  max: number
}

// Tiebreak : pseudo le plus cool (aléatoire avec raison générée)
export function resolveTiebreak(names: string[]): {
  winner: string
  reason: string
} {
  const winner = names[Math.floor(Math.random() * names.length)]
  const loser = names.find(n => n !== winner) ?? names[0]

  const reasons = [
    `"${winner}" contient ${winner.length} lettres — nombre premier selon l'algorithme. "${loser}" s'incline face aux mathématiques.`,
    `Analyse phonétique : "${winner}" produit 3 syllabes harmonieuses. "${loser}" manque de résonance vocalique.`,
    `La somme Unicode de "${winner}" bat "${loser}" de ${Math.floor(Math.random() * 10) + 1} points. La science a parlé.`,
    `"${winner}" rime avec "trophée". "${loser}" ne rime avec rien d'utile. Le verdict s'impose.`,
    `L'IA détecte que "${winner}" comporte autant de lettres que "fromage". Score fromage : 100/100.`,
  ]

  return {
    winner,
    reason: reasons[Math.floor(Math.random() * reasons.length)]
  }
}
