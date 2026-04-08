export const AROME_ICONS: Record<string, string> = {
  // Fruits rouges
  'Fraise': '🍓',
  'Framboise': '🫐',
  'Cerise': '🍒',
  'Myrtille': '🫐',
  'Mûre': '🫐',
  'Cassis': '🍇',
  'Figue': '🫐',
  'Fruits secs': '🌰',

  // Fruits blancs/exotiques
  'Pomme': '🍎',
  'Poire': '🍐',
  'Pêche': '🍑',
  'Abricot': '🍑',
  'Coing': '🍋',
  'Rhubarbe': '🌿',
  'Citron': '🍋',
  'Pamplemousse': '🍊',
  'Ananas': '🍍',
  'Litchi': '🍈',
  'Fruit de la passion': '🌺',

  // Fleurs
  'Violette': '💜',
  'Fleurs blanches': '🌸',
  'Rose': '🌹',
  'Fleurs': '🌸',

  // Végétal/Herbes
  'Herbes aromatiques': '🌿',
  'Poivron vert': '🫑',
  'Sous-bois': '🍂',
  'Champignons': '🍄',

  // Épices
  'Poivre': '🫙',
  'Clou de girofle': '🌶️',
  'Épices': '🫙',

  // Boisé/Torréfié
  'Vanille': '🍦',
  'Chocolat': '🍫',
  'Réglisse': '🖤',
  'Tabac': '🍂',
  'Pain grillé': '🍞',
  'Brioche': '🥐',
  'Levure': '🫧',
  'Amande': '🤍',
  'Noisette': '🌰',

  // Autres
  'Notes sauvages': '🦌',
  'Minéralité': '💎',
  'Beurre': '🧈',
  'Miel': '🍯',
}

export function getAromeIcon(arome: string): string {
  return AROME_ICONS[arome] ?? '✨'
}