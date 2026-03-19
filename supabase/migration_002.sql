-- Migration 002: Add all-day entry support
-- Run this in Supabase Dashboard → SQL Editor

-- Make start_time and end_time nullable (all-day entries have no time)
alter table public.entries
  alter column start_time drop not null,
  alter column end_time   drop not null;

-- Add is_all_day flag
alter table public.entries
  add column if not exists is_all_day boolean not null default false;
