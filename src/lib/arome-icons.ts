export function getAromeIcon(arome: string): string | null {
  const map: Record<string, string> = {
    // Fruits rouges
    'Fraise':             '/aromes/fraise_2.png',
    'Framboise':          '/aromes/framboise.png',
    'Cerise':             '/aromes/cerise.png',
    'Myrtille':           '/aromes/cassis.png',
    'Mûre':               '/aromes/mûre.png',
    'Cassis':             '/aromes/cassis.png',
    'Figue':              '/aromes/figs.png',
    'Fruits secs':        '/aromes/dried-fruits.png',

    // Fruits blancs/exotiques
    'Pomme':              '/aromes/pomme_3.png',
    'Poire':              '/aromes/poire_3.png',
    'Pêche':              '/aromes/peach (1).png',
    'Abricot':            '/aromes/abricot_2.png',
    'Coing':              '/aromes/coing_2.png',
    'Rhubarbe':           '/aromes/rhubarb.png',
    'Citron':             '/aromes/citron_2.png',
    'Pamplemousse':       '/aromes/pamplemousse_2.png',
    'Ananas':             '/aromes/ananas_2.png',
    'Litchi':             '/aromes/litchi_2.png',
    'Fruit de la passion':'/aromes/fruitpassion.png',

    // Fleurs
    'Violette':           '/aromes/violette.png',
    'Fleurs blanches':    '/aromes/fleur blanche.png',
    'Rose':               '/aromes/rose_4.png',
    'Fleurs':             '/aromes/fleur blanche.png',

    // Végétal
    'Herbes aromatiques': '/aromes/herbes aromatiques.png',
    'Poivron vert':       '/aromes/poivronvert.png',
    'Sous-bois':          '/aromes/sous-bois_2.png',
    'Champignons':        '/aromes/champignon.png',

    // Épices
    'Poivre':             '/aromes/poivre_4.png',
    'Clou de girofle':    '/aromes/clou de girofle.png',
    'Épices':             '/aromes/piment_2.png',

    // Torréfié/Boisé
    'Vanille':            '/aromes/vanille.png',
    'Chocolat':           '/aromes/chocolate-bar.png',
    'Réglisse':           '/aromes/réglisse.png',
    'Tabac':              '/aromes/smoking-pipe.png',
    'Pain grillé':        '/aromes/toast.png',
    'Brioche':            '/aromes/toast.png',
    'Levure':             '/aromes/toast.png',
    'Amande':             '/aromes/dried-fruits.png',
    'Noisette':           '/aromes/dried-fruits.png',

    // Autres
    'Notes sauvages':     '/aromes/gibier.png',
    'Minéralité':         '/aromes/granite (1).png',
    'Beurre':             '/aromes/beurre.png',
    'Miel':               '/aromes/miel.png',
  }
  return map[arome] ?? null
}