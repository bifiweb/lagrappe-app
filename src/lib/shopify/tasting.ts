// ============================================================
// Traduction des metafields de dégustation Shopify vers les options du jeu
// (robe, bouche, arômes, élevage) — fonctions pures, utilisables client et serveur
// ============================================================

import { WINE_CONTENT, ELEVAGE_OPTIONS, MAX_AROMES } from '@/types'
import type { WineType } from '@/types'

// Robe : custom.oeil est une image de 5 verres avec une flèche sur le bon.
// Le numéro du verre est dans le nom du fichier : "Rouge_verre3_3.png", "Verre_Blanc_2.2.png", "Verre_Rose_3.3.png"
const ROBE_BY_GLASS: Record<WineType, (string | null)[]> = {
  //         verre 1        verre 2        verre 3         verre 4         verre 5
  rouge:     ['Rouge pâle', 'Rouge pâle', 'Rouge dense',  'Rouge dense',  'Tuilée'],
  blanc:     ['Jaune pâle', 'Jaune pâle', 'Or / Paille',  'Or / Paille',  'Ambrée'],
  rose:      ['Rose pâle',  'Rose vif',   'Rose saumon',  'Rose orangé',  'Rose orangé'],
  petillant: ['Jaune pâle', 'Jaune pâle', 'Or',           'Or',           'Or'],
}

export function robeFromOeilUrl(url: string | null | undefined, type: WineType): string | null {
  if (!url) return null
  const file = url.split('/').pop()?.split('?')[0] ?? ''
  const match = file.match(/(\d)[._]\d/)
  if (!match) return null
  const glass = parseInt(match[1], 10)
  const robe = ROBE_BY_GLASS[type]?.[glass - 1] ?? null
  return robe && WINE_CONTENT[type].robes.includes(robe) ? robe : null
}

// Bouche : custom.structure_acidite va de 1 (léger / acidité vive) à 5 (très puissant / très gras)
export function boucheFromStructure(value: string | number | null | undefined, type: WineType): string | null {
  const n = typeof value === 'number' ? value : parseInt(value ?? '', 10)
  if (!n || n < 1 || n > 5) return null
  const options = WINE_CONTENT[type].bouche
  if (options.length === 5) return options[n - 1]
  // Rosé / pétillant : 3 niveaux seulement
  return options[[0, 0, 1, 2, 2][n - 1]] ?? null
}

// Arômes : détectés par mots-clés dans le texte libre custom.nez.
// Chaque règle propose des libellés par ordre de préférence ; on garde le premier qui existe pour ce type de vin.
const AROME_RULES: [RegExp, string[]][] = [
  [/\bfraise/, ['Fraise']],
  [/\bframboise/, ['Framboise']],
  [/\b(cerise|griotte|kirsch)/, ['Cerise']],
  [/\bmyrtille/, ['Myrtille']],
  [/\bmure/, ['Mûre']],
  [/\bcassis/, ['Cassis']],
  [/\bfigue/, ['Figue']],
  [/\b(pruneau|fruits? secs?|raisins? secs?)/, ['Fruits secs']],
  [/\bviolette/, ['Violette']],
  [/\b(herbes?|thym|laurier|romarin|garrigue|menthe|sauge)/, ['Herbes aromatiques']],
  [/\bpoivron/, ['Poivron vert']],
  [/\b(sous-bois|humus|feuilles? mortes?)/, ['Sous-bois']],
  [/\bpoivre/, ['Poivre']],
  [/\bgirofle/, ['Clou de girofle']],
  [/\bvanill/, ['Vanille']],
  [/\b(chocolat|cacao|moka|cafe)/, ['Chocolat']],
  [/\breglisse/, ['Réglisse']],
  [/\btabac/, ['Tabac']],
  [/\b(cuir|gibier|animal|sauvage)/, ['Notes sauvages']],
  [/\b(champignon|truffe)/, ['Champignons']],
  [/\b(grille|toaste|brioche)/, ['Pain grillé', 'Brioche']],
  [/\bpomme/, ['Pomme']],
  [/\bpoire/, ['Poire']],
  [/\bpeche/, ['Pêche']],
  [/\babricot/, ['Abricot']],
  [/\bcoing/, ['Coing']],
  [/\brhubarbe/, ['Rhubarbe']],
  [/\b(citron|agrume|cedrat|bergamote)/, ['Citron', 'Agrumes']],
  [/\bpamplemousse/, ['Pamplemousse', 'Agrumes']],
  [/\bananas/, ['Ananas']],
  [/\blitchi/, ['Litchi']],
  [/\bpassion/, ['Fruit de la passion']],
  [/\b(fleurs? blanches?|acacia|aubepine|tilleul|glycine|jasmin|sureau)/, ['Fleurs blanches', 'Fleurs']],
  [/\brose\b/, ['Rose']],
  [/\b(mineral|silex|pierre|craie)/, ['Minéralité']],
  [/\bepice/, ['Épices']],
  [/\b(miel|cire)/, ['Miel']],
  [/\bbeurre/, ['Beurre']],
  [/\bbonbon/, ['Bonbon']],
  [/\blevure/, ['Levure']],
  [/\bamande/, ['Amande']],
  [/\bnoisette/, ['Noisette']],
]

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function aromesFromNez(nez: string | null | undefined, type: WineType): string[] {
  if (!nez) return []
  const text = normalize(nez)
  const available = WINE_CONTENT[type].aromes
  const found: { label: string; pos: number }[] = []
  for (const [pattern, labels] of AROME_RULES) {
    const m = text.match(pattern)
    if (!m || m.index === undefined) continue
    const label = labels.find(l => available.includes(l))
    if (label && !found.some(f => f.label === label)) found.push({ label, pos: m.index })
  }
  // Dans l'ordre où ils apparaissent dans le texte du nez
  return found.sort((a, b) => a.pos - b.pos).map(f => f.label).slice(0, MAX_AROMES)
}

// Élevage : custom.elevage_du_vin, texte libre ("24 mois en barrique", "Inox", "18 mois en amphore et barrique")
export function elevageFromText(text: string | null | undefined): string | null {
  if (!text) return null
  const t = normalize(text)
  if (/barrique|amphore|fut|bois|foudre/.test(t)) return ELEVAGE_OPTIONS[1]
  if (/inox|cuve/.test(t)) return ELEVAGE_OPTIONS[0]
  return null
}
