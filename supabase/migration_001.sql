-- Migration 001: Add description field to subtasks
-- Run in Supabase Dashboard → SQL Editor

alter table public.subtasks
  add column if not exists description text not null default '';
