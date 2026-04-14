export interface Character {
  seed: string
  emoji: string
  label: string
  skinColor: string
}

// Personnages variés : genres + couleurs de peau diversifiés
export const CHARACTERS: Character[] = [
  { seed: 'Texas',      emoji: '🤠', label: 'Shérif',     skinColor: 'ae5d29' },
  { seed: 'Yuki',       emoji: '🥷', label: 'Ninja',       skinColor: 'f2d3b1' },
  { seed: 'Barbossa',   emoji: '☠️', label: 'Pirate',      skinColor: 'edb98a' },
  { seed: 'Morgana',    emoji: '🔮', label: 'Sorcière',    skinColor: '77311d' },
  { seed: 'Ragnar',     emoji: '⚔️', label: 'Viking',      skinColor: 'd08b5b' },
  { seed: 'Carmilla',   emoji: '🧛', label: 'Vampire',     skinColor: 'f7d7c4' },
  { seed: 'Wyatt',      emoji: '🌵', label: 'Cowboy',      skinColor: 'ae5d29' },
  { seed: 'Hana',       emoji: '🗡️', label: 'Samouraï',   skinColor: 'f2d3b1' },
  { seed: 'Athena',     emoji: '🏹', label: 'Chasseuse',   skinColor: '7c5c39' },
  { seed: 'Roland',     emoji: '🛡️', label: 'Chevalier',  skinColor: 'd78774' },
  { seed: 'Ezio',       emoji: '🗡️', label: 'Assassin',   skinColor: '614335' },
  { seed: 'Merlin',     emoji: '🪄', label: 'Mage',        skinColor: 'f7d7c4' },
  { seed: 'Lyra',       emoji: '🎵', label: 'Barde',       skinColor: 'b16137' },
  { seed: 'Kwame',      emoji: '🙏', label: 'Moine',       skinColor: '614335' },
  { seed: 'Freya',      emoji: '🌿', label: 'Druidesse',   skinColor: 'f5cfa0' },
  { seed: 'Conan',      emoji: '🪓', label: 'Guerrier',    skinColor: 'd08b5b' },
  { seed: 'Cleopatra',  emoji: '👑', label: 'Reine',       skinColor: '7c5c39' },
  { seed: 'Zara',       emoji: '⚡', label: 'Sorcière',    skinColor: 'ae5d29' },
  { seed: 'Diana',      emoji: '🌙', label: 'Chasseuse',   skinColor: 'f2d3b1' },
  { seed: 'Arthur',     emoji: '🏰', label: 'Roi',         skinColor: 'edb98a' },
]

export function avatarUrl(seed: string, skinColor?: string): string {
  const params = new URLSearchParams({ seed })
  params.set('backgroundColor', 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf')
  if (skinColor) params.set('skinColor', skinColor)
  return `https://api.dicebear.com/7.x/adventurer/svg?${params.toString()}`
}

export function getCharacter(seed: string): Character | undefined {
  return CHARACTERS.find(c => c.seed === seed)
}
