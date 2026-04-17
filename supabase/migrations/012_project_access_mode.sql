-- ============================================================
-- MODE D'ACCÈS AUX PROJETS
-- 'public'     : visible dans le dashboard pour tous
-- 'link'       : accessible par lien seulement (non listé)
-- 'restricted' : uniquement les membres sélectionnés
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'public';

-- Marquer les projets existants avec des membres comme 'restricted'
UPDATE public.projects p
SET access_mode = 'restricted'
WHERE EXISTS (
  SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id
);

-- Remplacer la fonction get_visible_projects
CREATE OR REPLACE FUNCTION public.get_visible_projects(p_user_id uuid)
RETURNS SETOF public.projects AS $$
BEGIN
  RETURN QUERY
    SELECT p.*
    FROM public.projects p
    WHERE p.active = true
      AND (
        p.access_mode = 'public'
        OR (
          p.access_mode = 'restricted'
          AND EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = p_user_id
          )
        )
        -- access_mode = 'link' : non listé dans le dashboard
      )
    ORDER BY p.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
