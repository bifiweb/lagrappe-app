export interface Character {
  seed: string
  filename: string
  label: string
  emoji: string
  skinColor?: string
}

export const CHARACTERS: Character[] = [
  { seed: 'fox',      filename: '01-fox-renard-tannique',        label: 'Renard Tannique',      emoji: '🦊' },
  { seed: 'owl',      filename: '02-owl-chouette-millsime',      label: 'Chouette Millésimée',  emoji: '🦉' },
  { seed: 'bear',     filename: '03-bear-ours-cors',             label: 'Ours Corsé',           emoji: '🐻' },
  { seed: 'snail',    filename: '04-snail-escargot-bourguignon', label: 'Escargot Bourguignon', emoji: '🐌' },
  { seed: 'rabbit',   filename: '05-rabbit-lapin-frais',         label: 'Lapin Frais',          emoji: '🐰' },
  { seed: 'pig',      filename: '06-pig-cochon-charnu',          label: 'Cochon Charnu',        emoji: '🐷' },
  { seed: 'cat',      filename: '07-cat-chat-velout',            label: 'Chat Velouté',         emoji: '🐱' },
  { seed: 'frog',     filename: '08-frog-grenouille-fruite',     label: 'Grenouille Fruitée',   emoji: '🐸' },
  { seed: 'hedgehog', filename: '09-hedgehog-hrisson-pic',       label: 'Hérisson Piqué',       emoji: '🦔' },
  { seed: 'giraffe',  filename: '10-giraffe-girafe-longiligne',  label: 'Girafe Longiligne',    emoji: '🦒' },
  { seed: 'mole',     filename: '11-mole-taupe-terreuse',        label: 'Taupe Terreuse',       emoji: '🐾' },
  { seed: 'peacock',  filename: '12-peacock-paon-aromatique',    label: 'Paon Aromatique',      emoji: '🦚' },
  { seed: 'mouse',    filename: '13-mouse-souris-minrale',       label: 'Souris Minérale',      emoji: '🐭' },
  { seed: 'turtle',   filename: '14-turtle-tortue-mature',       label: 'Tortue Mature',        emoji: '🐢' },
  { seed: 'wolf',     filename: '15-wolf-loup-sauvage',          label: 'Loup Sauvage',         emoji: '🐺' },
  { seed: 'duck',     filename: '16-duck-canard-mousseux',       label: 'Canard Mousseux',      emoji: '🦆' },
  { seed: 'bee',      filename: '17-bee-abeille-florale',        label: 'Abeille Florale',      emoji: '🐝' },
  { seed: 'monkey',   filename: '18-monkey-singe-exotique',      label: 'Singe Exotique',       emoji: '🐒' },
  { seed: 'llama',    filename: '19-llama-lama-lev',             label: 'Lama Élevé',           emoji: '🦙' },
  { seed: 'crab',     filename: '20-crab-crabe-iod',             label: 'Crabe Iodé',           emoji: '🦀' },
]

export function avatarUrl(seed: string, _skinColor?: string): string {
  const char = CHARACTERS.find(c => c.seed === seed)
  if (!char) return `/avatars/01-fox-renard-tannique.svg`
  return `/avatars/${char.filename}.svg`
}

export function getCharacter(seed: string): Character | undefined {
  return CHARACTERS.find(c => c.seed === seed)
}
