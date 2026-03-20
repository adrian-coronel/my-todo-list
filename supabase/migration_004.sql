-- Migration 004: Add color_override field to tasks
-- Run in Supabase Dashboard → SQL Editor

alter table public.tasks
  add column if not exists color_override boolean not null default false;
