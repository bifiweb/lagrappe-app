export interface CepageInfo {
  robe: string
  nez: string
  bouche: string
}

export const CEPAGE_INFO: Record<string, CepageInfo> = {
  'Pinot Noir': {
    robe: 'Rouge pâle à grenat, peu coloré',
    nez: 'Fraise, framboise, cerise, sous-bois, chocolat, vanille',
    bouche: 'Léger à souple selon élevage, tanins fins',
  },
  'Gamay': {
    robe: 'Rouge vif, violacé',
    nez: 'Fruits rouges frais, fraise, framboise, épices fines',
    bouche: 'Fruité, léger, tanins souples, vivacité',
  },
  'Merlot': {
    robe: 'Rouge profond, pourpre',
    nez: 'Prune, cerise noire, cacao, café, vanille',
    bouche: 'Rond, charnu, tanins veloutés, généreux',
  },
  'Syrah': {
    robe: 'Rouge dense, violacé',
    nez: 'Olive noire, poivre, fruits noirs, violette, notes fumées',
    bouche: 'Puissant, tanins fermes, épicé, longue finale',
  },
  'Cabernet': {
    robe: 'Rouge sombre à quasi opaque',
    nez: 'Cassis, poivron vert, cèdre, tabac, épices',
    bouche: 'Structuré, tanins prononcés, acidité marquée',
  },
  'Diolinoir': {
    robe: 'Rouge intense, presque opaque',
    nez: 'Fruits noirs intenses, épices fines',
    bouche: 'Corsé, puissant dans sa jeunesse',
  },
  'Garanoir': {
    robe: 'Rouge moyen',
    nez: 'Fruits rouges, légères notes épicées',
    bouche: 'Fruité, souple, tanins moyens, facile à boire',
  },
  'Cornalin': {
    robe: 'Rouge profond, brillant',
    nez: 'Cerise noire, épices, notes florales et animales',
    bouche: 'Fruité intense avec une belle structure',
  },
  'Humagne Rouge': {
    robe: 'Rouge rubis, généralement pâle',
    nez: 'Fruits des bois, épices, avec un côté gibier',
    bouche: 'Tanins fins, avec parfois un côté rustique',
  },
  'Chasselas': {
    robe: 'Jaune pâle, reflets verts',
    nez: 'Discret, floral, minéral, citron',
    bouche: 'Léger, vif, acidité fraîche, finale minérale',
  },
  'Chardonnay': {
    robe: 'Jaune or, doré',
    nez: 'Pomme, pêche, vanille, beurre (si élevage bois), miel',
    bouche: 'Ample, gras, acidité modérée, bonne longueur',
  },
  'Pinot Gris': {
    robe: 'Or pâle',
    nez: 'Pêche, abricot, miel, épices douces, légèrement fumé',
    bouche: 'Gras, onctueux, finale épicée et longue',
  },
  'Riesling': {
    robe: 'Jaune pâle à or',
    nez: 'Citron, pamplemousse, pêche, floral, notes pétrolées (vieux)',
    bouche: 'Vif, acidité tranchante, minéral, très long',
  },
  'Sauvignon': {
    robe: 'Jaune pâle à reflets verts',
    nez: 'Buis, herbe coupée, pamplemousse, groseille à maquereau',
    bouche: 'Vif, frais, très aromatique, finale fraîche',
  },
  'Gewurztraminer': {
    robe: 'Or, légèrement ambrée',
    nez: 'Rose, litchi, mangue, épices, fleurs exotiques',
    bouche: 'Riche, très aromatique, peu acide, opulent',
  },
  'Viognier': {
    robe: 'Or lumineux',
    nez: 'Abricot, pêche blanche, fleurs blanches, miel',
    bouche: 'Gras, volumineux, très aromatique, peu acide',
  },
  'Petite Arvine': {
    robe: 'Or pâle à doré',
    nez: 'Pamplemousse, agrumes confits, parfois fruits exotiques',
    bouche: 'Vif, minéral, très longue finale avec de la salinité',
  },
  'Heida': {
    robe: 'Or pâle',
    nez: 'Floral, fruits exotiques, épicé',
    bouche: 'Ample, aromatique, bonne fraîcheur',
  },
  'Müller Thurgau': {
    robe: 'Jaune pâle',
    nez: 'Léger muscat, floral, fruits blancs',
    bouche: 'Léger, fruité, peu acide, facile et agréable',
  },
  'Johannisberg': {
    robe: 'Or pâle',
    nez: 'Fruits du verger (pomme, poire, pêche), amande',
    bouche: 'Souple, parfois gras, amertume finale',
  },
  'Muscat': {
    robe: 'Jaune pâle à doré',
    nez: 'Rose, raisin frais, fleurs blanches, arômes muscatés',
    bouche: 'Très aromatique, frais, doux à sec, finale florale',
  },
}

// ---- Profils pour classer les cépages dans la devinette ----
// Robes et arômes repris des listes du jeu (WINE_CONTENT), bouche = plage d'index
// sur l'échelle à 5 crans (rouge : structure, blanc : acidité → gras)
export interface CepageProfil {
  robes: string[]
  aromes: string[]
  bouche: [number, number]
}

export const CEPAGE_PROFILS: Record<string, CepageProfil> = {
  'Pinot Noir':     { robes: ['Rouge pâle', 'Tuilée'], aromes: ['Fraise', 'Framboise', 'Cerise', 'Sous-bois', 'Champignons', 'Vanille', 'Chocolat'], bouche: [0, 2] },
  'Gamay':          { robes: ['Rouge pâle'], aromes: ['Fraise', 'Framboise', 'Cerise', 'Violette', 'Poivre'], bouche: [0, 2] },
  'Merlot':         { robes: ['Rouge dense', 'Tuilée'], aromes: ['Cerise', 'Mûre', 'Cassis', 'Figue', 'Chocolat', 'Vanille', 'Réglisse', 'Tabac'], bouche: [2, 4] },
  'Syrah':          { robes: ['Rouge dense'], aromes: ['Mûre', 'Myrtille', 'Cassis', 'Violette', 'Poivre', 'Réglisse', 'Notes sauvages'], bouche: [3, 4] },
  'Cabernet':       { robes: ['Rouge dense'], aromes: ['Cassis', 'Mûre', 'Poivron vert', 'Herbes aromatiques', 'Tabac', 'Vanille'], bouche: [3, 4] },
  'Diolinoir':      { robes: ['Rouge dense'], aromes: ['Mûre', 'Myrtille', 'Cassis', 'Poivre', 'Clou de girofle'], bouche: [3, 4] },
  'Garanoir':       { robes: ['Rouge pâle', 'Rouge dense'], aromes: ['Cerise', 'Framboise', 'Mûre', 'Poivre'], bouche: [1, 2] },
  'Cornalin':       { robes: ['Rouge dense'], aromes: ['Cerise', 'Mûre', 'Myrtille', 'Violette', 'Poivre', 'Notes sauvages'], bouche: [2, 4] },
  'Humagne Rouge':  { robes: ['Rouge pâle', 'Rouge dense'], aromes: ['Myrtille', 'Mûre', 'Violette', 'Sous-bois', 'Poivre', 'Notes sauvages'], bouche: [2, 3] },
  'Chasselas':      { robes: ['Jaune pâle'], aromes: ['Fleurs blanches', 'Citron', 'Minéralité', 'Pomme', 'Poire'], bouche: [1, 2] },
  'Chardonnay':     { robes: ['Jaune pâle', 'Or / Paille'], aromes: ['Pomme', 'Pêche', 'Ananas', 'Vanille', 'Beurre', 'Miel'], bouche: [2, 4] },
  'Pinot Gris':     { robes: ['Or / Paille'], aromes: ['Poire', 'Pêche', 'Abricot', 'Coing', 'Miel', 'Épices'], bouche: [3, 4] },
  'Riesling':       { robes: ['Jaune pâle'], aromes: ['Citron', 'Pamplemousse', 'Pomme', 'Pêche', 'Fleurs blanches', 'Minéralité'], bouche: [0, 1] },
  'Sauvignon':      { robes: ['Jaune pâle'], aromes: ['Pamplemousse', 'Fruit de la passion', 'Citron', 'Rhubarbe', 'Herbes aromatiques', 'Minéralité'], bouche: [0, 1] },
  'Gewurztraminer': { robes: ['Or / Paille'], aromes: ['Litchi', 'Rose', 'Fruit de la passion', 'Épices', 'Miel'], bouche: [3, 4] },
  'Viognier':       { robes: ['Or / Paille'], aromes: ['Abricot', 'Pêche', 'Fleurs blanches', 'Miel', 'Épices'], bouche: [3, 4] },
  'Petite Arvine':  { robes: ['Jaune pâle'], aromes: ['Pamplemousse', 'Rhubarbe', 'Citron', 'Fruit de la passion', 'Minéralité'], bouche: [0, 2] },
  'Heida':          { robes: ['Jaune pâle', 'Or / Paille'], aromes: ['Pomme', 'Coing', 'Pamplemousse', 'Herbes aromatiques', 'Épices', 'Minéralité'], bouche: [1, 3] },
  'Müller Thurgau': { robes: ['Jaune pâle'], aromes: ['Pêche', 'Pomme', 'Citron', 'Fleurs blanches', 'Herbes aromatiques'], bouche: [1, 2] },
  'Johannisberg':   { robes: ['Jaune pâle', 'Or / Paille'], aromes: ['Pêche', 'Abricot', 'Pomme', 'Fleurs blanches', 'Herbes aromatiques'], bouche: [2, 3] },
  'Muscat':         { robes: ['Jaune pâle'], aromes: ['Rose', 'Litchi', 'Fleurs blanches', 'Pêche', 'Abricot', 'Citron'], bouche: [1, 2] },
}

// Classe les cépages du plus proche au plus éloigné de ce que le joueur a noté.
// Robe et bouche ne comptent que pour rouge/blanc (les échelles rosé/pétillant sont différentes).
export function rankCepages(
  cepages: string[],
  { type, robe, aromes, boucheIndex }: { type: string, robe: string | null, aromes: string[], boucheIndex: number }
): string[] {
  const echelle5 = type === 'rouge' || type === 'blanc'
  const score = (c: string) => {
    const p = CEPAGE_PROFILS[c]
    if (!p) return 0
    let s = aromes.filter(a => p.aromes.includes(a)).length * 2
    if (echelle5) {
      if (robe && p.robes.includes(robe)) s += 3
      const [min, max] = p.bouche
      const ecart = boucheIndex < min ? min - boucheIndex : boucheIndex > max ? boucheIndex - max : 0
      s += ecart === 0 ? 3 : ecart === 1 ? 1.5 : 0
    }
    return s
  }
  // Tri stable : à score égal, on garde l'ordre d'origine
  return cepages
    .map((c, i) => ({ c, i, s: score(c) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(x => x.c)
}
