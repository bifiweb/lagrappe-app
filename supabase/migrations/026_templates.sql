-- ============================================================
-- Migration 026 — Système de templates + dégustation cépage
-- ============================================================

-- 1. Colonnes template sur projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'swiss_wine'
    CHECK (template IN ('swiss_wine', 'valais_wine', 'cepage')),
  ADD COLUMN IF NOT EXISTS cepage_name text,
  ADD COLUMN IF NOT EXISTS cepage_info_url text;

-- 2. Rendre wine_id et bottle_number nullables pour les sessions cépage
ALTER TABLE sessions ALTER COLUMN wine_id DROP NOT NULL;
ALTER TABLE sessions ALTER COLUMN bottle_number DROP NOT NULL;

-- 3. Étendre les statuts autorisés pour les sessions cépage
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN (
    'lobby', 'voting', 'tasting', 'waiting_reveal', 'revealed', 'finished',
    'cepage_info', 'cepage_tasting', 'cepage_results'
  ));

-- 4. Table des notes de dégustation cépage (une note par joueur par bouteille)
CREATE TABLE IF NOT EXISTS cepage_ratings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wine_id      uuid NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  score        integer NOT NULL CHECK (score >= 0 AND score <= 100),
  tasting_note text,
  aromes       text[] NOT NULL DEFAULT '{}',
  millesime    integer,
  region       text,
  prix         decimal(8,2),
  submitted_at timestamptz DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id, wine_id)
);

ALTER TABLE cepage_ratings ENABLE ROW LEVEL SECURITY;

-- Joueurs peuvent lire les notes de leurs sessions
CREATE POLICY "cepage_ratings_select" ON cepage_ratings
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM session_players WHERE user_id = auth.uid()
    )
  );

-- Joueurs peuvent insérer leurs propres notes
CREATE POLICY "cepage_ratings_insert" ON cepage_ratings
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Joueurs peuvent mettre à jour leurs propres notes
CREATE POLICY "cepage_ratings_update" ON cepage_ratings
  FOR UPDATE USING (user_id = auth.uid());
