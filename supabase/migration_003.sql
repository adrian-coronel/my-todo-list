-- Migration 003: Add is_all_day field to tasks
-- Run in Supabase Dashboard → SQL Editor

alter table public.tasks
  add column if not exists is_all_day boolean not null default false;
