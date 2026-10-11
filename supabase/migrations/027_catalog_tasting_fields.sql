-- ============================================================
-- Migration 027 — Champs de dégustation importés depuis Shopify
-- (robe ← custom.oeil, bouche ← custom.structure_acidite,
--  arômes ← custom.nez, élevage ← custom.elevage_du_vin)
-- Servent à pré-remplir les notes Grappiste quand on choisit un vin de la cave à pépites
-- ============================================================

alter table public.catalog_wines
  add column if not exists robe    text,
  add column if not exists bouche  text,
  add column if not exists aromes  jsonb not null default '[]',
  add column if not exists elevage text;
