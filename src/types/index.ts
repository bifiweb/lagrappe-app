// ============================================================
// LA GRAPPE — Types TypeScript
// ============================================================

export type UserRole = 'admin' | 'player'
export type WineType = 'rouge' | 'blanc' | 'rose' | 'petillant'
export type SessionStatus = 'lobby' | 'voting' | 'tasting' | 'waiting_reveal' | 'revealed' | 'finished'
export type EveningMode = 'standalone' | 'continuous'
export type EveningStatus = 'lobby' | 'voting' | 'in_progress' | 'finished'
export type QuizCategory = 'region' | 'cepage' | 'accord' | 'general'

// ---- Profil utilisateur ----
export interface Profile {
  id: string
  email: string
  role: UserRole
  display_name: string | null
  created_at: string
}

// ---- Projet ----
export interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
  active: boolean
  created_by: string
  created_at: string
}

// ---- Vin ----
export interface Wine {
  id: string
  project_id: string
  bottle_number: number
  type: WineType
  shopify_product_id: string | null
  shopify_variant_id: string | null
  shopify_url: string | null
  image_url: string | null
  revealed: boolean
  created_at: string
  // Jointures optionnelles
  grappiste_notes?: GrappisteNotes
}

// ---- Notes officielles grappistes ----
export interface GrappisteNotes {
  id: string
  wine_id: string
  note: number
  description: string | null
  robe: string | null
  aromes_officiels: string[]
  bouche: string | null
  accords: string[]
  cepage: string | null
  region: string | null
  millesime: number | null
  prix_chf: string | null
  prix_exact: number | null
  cave: string | null
  image_url: string | null
  created_at: string
}

// ---- Soirée ----
export interface Evening {
  id: string
  project_id: string
  chef_id: string | null
  mode: EveningMode
  bottle_order: number[]
  status: EveningStatus
  created_at: string
  // Jointures
  chef?: Profile
  sessions?: Session[]
}

// ---- Session ----
export interface Session {
  id: string
  project_id: string
  wine_id: string
  evening_id: string | null
  chef_id: string | null
  bottle_number: number
  order_in_evening: number
  status: SessionStatus
  started_at: string | null
  revealed_at: string | null
  created_at: string
  // Jointures
  wine?: Wine
  chef?: Profile
  players?: SessionPlayer[]
}

// ---- Joueur d'une session ----
export interface SessionPlayer {
  id: string
  session_id: string
  evening_id: string | null
  user_id: string
  pseudo: string
  is_chef: boolean
  votes_received: number
  tasting_done: boolean
  points_session: number
  points_evening: number
  joined_at: string
  // Jointures
  profile?: Profile
}

// ---- Fiche de dégustation ----
export interface Tasting {
  id: string
  session_id: string
  user_id: string
  // Vue
  robe: string | null
  // Nez
  nez_intensite: number | null
  aromes: string[]
  // Bouche
  bouche: string | null
  accords: string[]
  // Devinette
  prix_estime: string | null
  millesime_estime: number | null
  cepage_guess: string | null
  region_guess: string | null
  // Notes perso
  score_perso: number | null
  notes_libres: string | null
  // Scoring
  pts_robe: number
  pts_aromes: number
  pts_bouche: number
  pts_prix: number
  pts_millesime: number
  pts_cepage: number
  pts_region: number
  total_points: number
  submitted_at: string | null
  created_at: string
}

// ---- Vote chef ----
export interface Vote {
  id: string
  session_id: string
  voter_id: string
  voted_for: string
  created_at: string
}

// ---- Quiz ----
export interface QuizQuestion {
  id: string
  project_id: string | null
  question: string
  options: string[]
  correct_answer: string
  explanation: string | null
  category: QuizCategory
  difficulty: 1 | 2 | 3
  created_at: string
}

// ---- Données de contenu par type de vin ----
export interface WineContent {
  robes: string[]
  aromes: string[]
  bouche: string[]
  accords: string[]
  cepages: string[]
  regions: string[]
}

export const WINE_CONTENT: Record<WineType, WineContent> = {
  rouge: {
    robes: ['Violacée', 'Rouge pâle', 'Rouge dense', 'Tuilée'],
    aromes: [
      'Fraise', 'Framboise', 'Cerise', 'Myrtille', 'Mûre', 'Cassis',
      'Figue', 'Fruits secs', 'Violette', 'Herbes aromatiques', 'Poivron vert',
      'Sous-bois', 'Poivre', 'Clou de girofle', 'Vanille', 'Chocolat',
      'Réglisse', 'Tabac', 'Notes sauvages', 'Champignons', 'Pain grillé',
    ],
    bouche: ['Léger, facile', 'Souple, équilibré', 'Puissant, corsé'],
    accords: ['Salade', 'Charcuterie', 'Raclette', 'Poulet au four', 'Burger', 'Côte de boeuf', 'Civet de cerf', 'Fondant au chocolat'],
    cepages: ['Pinot Noir', 'Gamay', 'Merlot', 'Syrah', 'Cabernet', 'Diolinoir', 'Garanoir', 'Cornalin', 'Humagne Rouge', 'Je sais pas'],
    regions: ['Valais', 'Genève', 'Vaud', 'Neuchâtel', 'Tessin', 'Zurich', 'Grisons', 'Je sais pas'],
  },
  blanc: {
    robes: ['Jaune pâle', 'Or / Paille', 'Ambrée', 'Rosée'],
    aromes: [
      'Pomme', 'Poire', 'Pêche', 'Abricot', 'Coing', 'Rhubarbe',
      'Citron', 'Pamplemousse', 'Ananas', 'Litchi', 'Fruit de la passion',
      'Fleurs blanches', 'Rose', 'Herbes aromatiques', 'Minéralité',
      'Épices', 'Vanille', 'Miel', 'Beurre', 'Champignons',
    ],
    bouche: ['Acidité vive', 'Équilibre gras/acidité', 'Gras, onctueux'],
    accords: ['Salade', 'Plateau de fromages', 'Charcuterie', 'Plat asiatique', 'Raclette', 'Filets de perche', 'Steak frites', 'Tarte aux pommes'],
    cepages: ['Chasselas', 'Chardonnay', 'Pinot Gris', 'Riesling', 'Sauvignon', 'Gewurztraminer', 'Viognier', 'Petite Arvine', 'Heida', 'Je sais pas'],
    regions: ['Valais', 'Genève', 'Vaud', 'Neuchâtel', 'Tessin', 'Zurich', 'Grisons', 'Je sais pas'],
  },
  rose: {
    robes: ['Rose pâle', 'Rose saumon', 'Rose vif', 'Rose orangé'],
    aromes: ['Fraise', 'Framboise', 'Cerise', 'Rose', 'Pêche', 'Agrumes', 'Bonbon', 'Fleurs', 'Minéralité'],
    bouche: ['Léger, frais', 'Fruité, équilibré', 'Structuré'],
    accords: ['Salade', 'Poisson grillé', 'Sushi', 'Charcuterie', 'Pizza', 'Barbecue', 'Fromage frais'],
    cepages: ['Pinot Noir', 'Gamay', 'Merlot', 'Syrah', 'Je sais pas'],
    regions: ['Valais', 'Genève', 'Vaud', 'Neuchâtel', 'Tessin', 'Je sais pas'],
  },
  petillant: {
    robes: ['Jaune pâle', 'Or', 'Rosé', 'Blanc de blancs'],
    aromes: ['Brioche', 'Levure', 'Pomme', 'Citron', 'Fleurs blanches', 'Minéralité', 'Amande', 'Noisette'],
    bouche: ['Léger, délicat', 'Vif, bulles fines', 'Crémeux, persistant'],
    accords: ['Apéritif', 'Fruits de mer', 'Sushi', 'Fromage frais', 'Desserts légers'],
    cepages: ['Chasselas', 'Chardonnay', 'Pinot Noir', 'Je sais pas'],
    regions: ['Valais', 'Vaud', 'Genève', 'Neuchâtel', 'Je sais pas'],
  },
}

export const PRIX_OPTIONS = [
  '< 20 CHF',
  '20 – 25 CHF',
  '26 – 30 CHF',
  '31 – 40 CHF',
  '> 40 CHF',
]

export const PRICE_RANGES = [
  { label: '< 20 CHF', min: 0, max: 19.99 },
  { label: '20 – 25 CHF', min: 20, max: 25 },
  { label: '26 – 30 CHF', min: 26, max: 30 },
  { label: '31 – 40 CHF', min: 31, max: 40 },
  { label: '> 40 CHF', min: 40.01, max: Infinity },
]

export const MAX_AROMES = 5

// ---- Scoring constants ----
export const SCORING = {
  ROBE_CORRECT: 300,
  ROBE_WRONG: 100,
  AROME_PER_PLAYER: 100,
  AROME_GRAPPISTE_BONUS: 50,
  BOUCHE_CORRECT: 300,
  BOUCHE_WRONG: 100,
  PRIX_CORRECT: 500,
  PRIX_WRONG: 100,
  MILLESIME_CORRECT: 400,
  MILLESIME_WRONG: 100,
  CEPAGE_CORRECT: 1000,
  CEPAGE_WRONG: 200,
  REGION_CORRECT: 1000,
  REGION_WRONG: 200,
} as const