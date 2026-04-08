export function getAccordIcon(accord: string): string | null {
  const map: Record<string, string> = {
    'Salade':           '/accords/salad.png',
    'Charcuterie':      '/accords/charcuterie.png',
    'Raclette/Fondue':  '/accords/fondue.png',
    'Poulet au four':   '/accords/chicken-leg.png',
    'Burger':           '/accords/burger.png',
    'Côte de boeuf':    '/accords/beef.png',
    'Civet de cerf':    '/accords/civet-cerf.png',
    'Fondant au chocolat': '/accords/cake.png',
    'Plateau de fromages': '/accords/plateau-fromages.png',
    'Plat asiatique':   '/accords/thai-food.png',
    'Filets de perche': '/accords/small-dried-fish.png',
    'Steak frites':     '/accords/steak-frites.png',
    'Tarte aux pommes': '/accords/apple-pie.png',
    'Sushi':            '/accords/small-dried-fish.png',
    'Pizza':            '/accords/burger.png',
    'Barbecue':         '/accords/beef.png',
    'Fromage frais':    '/accords/plateau-fromages.png',
    'Apéritif':         '/accords/charcuterie.png',
    'Fruits de mer':    '/accords/small-dried-fish.png',
    'Desserts légers':  '/accords/apple-pie.png',
    'Poisson grillé':   '/accords/small-dried-fish.png',
  }
  return map[accord] ?? null
}