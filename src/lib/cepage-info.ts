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
