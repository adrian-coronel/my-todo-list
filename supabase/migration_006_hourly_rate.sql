-- ============================================================================
-- Migration 006: Tarifa por hora en clientes
-- ============================================================================

alter table public.clients
  add column if not exists hourly_rate numeric(10,2) default null;
