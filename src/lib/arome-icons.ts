// Catégories d'arômes avec couleur et lettre unique
export interface AromeStyle {
  icon: string    // lettre ou symbole court
  color: string   // couleur de fond
  textColor: string
}

export const AROME_STYLES: Record<string, AromeStyle> = {
  // Fruits rouges — tons rouge/rose
  'Fraise':       { icon: 'Fr', color: '#fce4ec', textColor: '#c62828' },
  'Framboise':    { icon: 'Fb', color: '#f8bbd0', textColor: '#ad1457' },
  'Cerise':       { icon: 'Ce', color: '#ef9a9a', textColor: '#b71c1c' },
  'Myrtille':     { icon: 'My', color: '#e1bee7', textColor: '#6a1b9a' },
  'Mûre':         { icon: 'Mû', color: '#ce93d8', textColor: '#4a148c' },
  'Cassis':       { icon: 'Ca', color: '#b39ddb', textColor: '#311b92' },
  'Figue':        { icon: 'Fi', color: '#d7ccc8', textColor: '#4e342e' },
  'Fruits secs':  { icon: 'Fs', color: '#ffccbc', textColor: '#bf360c' },

  // Fruits blancs/exotiques — tons jaune/orange
  'Pomme':              { icon: 'Po', color: '#f0f4c3', textColor: '#827717' },
  'Poire':              { icon: 'Pe', color: '#dcedc8', textColor: '#33691e' },
  'Pêche':              { icon: 'Pê', color: '#ffe0b2', textColor: '#e65100' },
  'Abricot':            { icon: 'Ab', color: '#ffccbc', textColor: '#bf360c' },
  'Coing':              { icon: 'Co', color: '#fff9c4', textColor: '#f57f17' },
  'Rhubarbe':           { icon: 'Rh', color: '#fce4ec', textColor: '#880e4f' },
  'Citron':             { icon: 'Ci', color: '#fff9c4', textColor: '#f9a825' },
  'Pamplemousse':       { icon: 'Pa', color: '#ffe0b2', textColor: '#e65100' },
  'Ananas':             { icon: 'An', color: '#fff8e1', textColor: '#ff8f00' },
  'Litchi':             { icon: 'Li', color: '#fce4ec', textColor: '#c2185b' },
  'Fruit de la passion':{ icon: 'Fp', color: '#f3e5f5', textColor: '#7b1fa2' },

  // Fleurs — tons violet/rose
  'Violette':       { icon: 'Vi', color: '#ede7f6', textColor: '#4527a0' },
  'Fleurs blanches':{ icon: 'Fb', color: '#f3e5f5', textColor: '#6a1b9a' },
  'Rose':           { icon: 'Ro', color: '#fce4ec', textColor: '#ad1457' },
  'Fleurs':         { icon: 'Fl', color: '#f8bbd0', textColor: '#880e4f' },

  // Végétal — tons vert
  'Herbes aromatiques': { icon: 'Ha', color: '#e8f5e9', textColor: '#2e7d32' },
  'Poivron vert':       { icon: 'Pv', color: '#c8e6c9', textColor: '#1b5e20' },
  'Sous-bois':          { icon: 'Sb', color: '#d7ccc8', textColor: '#3e2723' },
  'Champignons':        { icon: 'Ch', color: '#efebe9', textColor: '#4e342e' },

  // Épices — tons orange/brun
  'Poivre':         { icon: 'Po', color: '#efebe9', textColor: '#212121' },
  'Clou de girofle':{ icon: 'Cg', color: '#d7ccc8', textColor: '#3e2723' },
  'Épices':         { icon: 'Ép', color: '#ffccbc', textColor: '#bf360c' },

  // Torréfié/Boisé — tons brun/noir
  'Vanille':    { icon: 'Va', color: '#fff8e1', textColor: '#ff8f00' },
  'Chocolat':   { icon: 'Cx', color: '#d7ccc8', textColor: '#3e2723' },
  'Réglisse':   { icon: 'Rg', color: '#212121', textColor: '#fff' },
  'Tabac':      { icon: 'Ta', color: '#bcaaa4', textColor: '#3e2723' },
  'Pain grillé':{ icon: 'Pg', color: '#ffe0b2', textColor: '#e65100' },
  'Brioche':    { icon: 'Br', color: '#fff3e0', textColor: '#e65100' },
  'Levure':     { icon: 'Le', color: '#f5f5f5', textColor: '#616161' },
  'Amande':     { icon: 'Am', color: '#fff8e1', textColor: '#795548' },
  'Noisette':   { icon: 'No', color: '#efebe9', textColor: '#5d4037' },

  // Minéral/Autres
  'Notes sauvages': { icon: 'Ns', color: '#e8f5e9', textColor: '#1b5e20' },
  'Minéralité':     { icon: 'Mi', color: '#e3f2fd', textColor: '#0d47a1' },
  'Beurre':         { icon: 'Bu', color: '#fff9c4', textColor: '#f57f17' },
  'Miel':           { icon: 'Me', color: '#fff8e1', textColor: '#ff6f00' },
}

export function getAromeStyle(arome: string): AromeStyle {
  return AROME_STYLES[arome] ?? { icon: arome.slice(0, 2), color: '#f5f5f5', textColor: '#666' }
}