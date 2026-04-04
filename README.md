# La Grappe — Application de dégustation

## Stack
- **Frontend** : Next.js 14 (App Router) + Tailwind CSS + Framer Motion
- **Backend** : Supabase (Auth + PostgreSQL + Realtime)
- **Commerce** : Shopify Storefront API
- **Hébergement** : Vercel
- **IA** : Claude API (tiebreak pseudos)

---

## Setup en 5 étapes

### 1. Cloner et installer
```bash
git clone ...
cd lagrappe-app
npm install
cp .env.example .env.local
```

### 2. Créer le projet Supabase
1. Aller sur https://supabase.com → New project
2. Nommer le projet "lagrappe"
3. Choisir région : West EU (Frankfurt)
4. Copier l'URL et la clé anon dans `.env.local`

### 3. Créer les tables
Dans le SQL Editor de Supabase, exécuter dans l'ordre :
```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_scoring_function.sql
```

### 4. Configurer Shopify
1. Dans Shopify Admin → Apps → Develop apps
2. Créer une app "La Grappe App"
3. Activer `Storefront API` avec les scopes : `unauthenticated_read_product_listings`
4. Copier le Storefront access token dans `.env.local`

### 5. Lancer en dev
```bash
npm run dev
# → http://localhost:3000
```

---

## Structure du projet

```
src/
├── app/
│   ├── auth/login/          # Page de connexion
│   └── app/
│       ├── dashboard/       # Accueil joueur (projets disponibles)
│       ├── project/[slug]/  # Page projet (Swiss Wine Challenge)
│       ├── session/[id]/    # Lobby + vote chef + dégustation live
│       ├── tasting/[id]/    # Fiche de dégustation (vue/nez/bouche)
│       ├── cave/            # Cave virtuelle + historique
│       └── quiz/[id]/       # Quiz éducatifs régions suisses
├── components/
│   ├── ui/                  # Composants génériques (Button, Card...)
│   ├── game/                # Composants jeu (TastingSheet, RevealScreen...)
│   └── admin/               # Dashboard admin
├── lib/
│   ├── supabase/            # Client browser + server
│   ├── shopify/             # Storefront API
│   └── scoring/             # Calcul des points
├── hooks/
│   └── useRealtime.ts       # Abonnements Supabase Realtime
├── store/
│   └── index.ts             # Zustand (tasting draft + session state)
└── types/
    └── index.ts             # Tous les types TypeScript
```

---

## Flux principal

```
Login
  └─→ Dashboard (liste des projets)
        └─→ Project (Swiss Wine Challenge)
              ├─→ Session standalone
              │     └─→ Choisir bouteille → Lobby → Dégustation → Reveal
              └─→ Soirée continue
                    └─→ Lobby groupe → Vote chef → Ordonner bouteilles
                          └─→ [pour chaque vin]
                                Dégustation → Waiting reveal → Reveal → Scores
                          └─→ Classement soirée final
```

---

## Rôles

| Rôle | Accès |
|------|-------|
| `admin` | Tout — gestion projets, vins, notes grappistes, reveal |
| `player` | Ses dégustations, son historique, quiz |

Pour créer un admin, mettre à jour manuellement dans Supabase :
```sql
update public.profiles set role = 'admin' where email = 'ton@email.com';
```

---

## Prochaines étapes de développement

- [ ] Page Login / Auth
- [ ] Dashboard joueur
- [ ] Page projet + sélection bouteille
- [ ] Lobby + vote chef + tiebreak
- [ ] Fiche de dégustation (5 étapes)
- [ ] Écran de reveal + scoring
- [ ] Cave virtuelle
- [ ] Dashboard admin
- [ ] Quiz éducatifs
- [ ] Intégration Shopify complète
