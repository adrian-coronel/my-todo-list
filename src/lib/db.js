/**
 * db.js — Capa de acceso a datos sobre Supabase.
 * Mapea snake_case (DB) ↔ camelCase (frontend).
 */
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convierte las claves de un objeto de snake_case a camelCase */
function toCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      Array.isArray(v) ? v.map(toCamel) : toCamel(v),
    ])
  )
}

/** PostgreSQL devuelve time como "HH:MM:SS" — truncar a "HH:MM" */
function normalizeEntry(entry) {
  const e = toCamel(entry)
  if (e.startTime && e.startTime.length > 5) e.startTime = e.startTime.slice(0, 5)
  if (e.endTime && e.endTime.length > 5)   e.endTime   = e.endTime.slice(0, 5)
  return e
}

/** Convierte las claves de un objeto de camelCase a snake_case */
function toSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/([A-Z])/g, '_$1').toLowerCase(),
      v,
    ])
  )
}

async function query(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export const clients = {
  async list() {
    const data = await query(
      supabase.from('clients').select('*').order('created_at')
    )
    return data.map(toCamel)
  },

  async create({ name, color = '#3B82F6', userId }) {
    const data = await query(
      supabase
        .from('clients')
        .insert({ name, color, user_id: userId })
        .select()
        .single()
    )
    return toCamel(data)
  },

  async update(id, updates) {
    const data = await query(
      supabase
        .from('clients')
        .update(toSnake(updates))
        .eq('id', id)
        .select()
        .single()
    )
    return toCamel(data)
  },

  async delete(id) {
    await query(supabase.from('clients').delete().eq('id', id))
  },
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = {
  async list() {
    const data = await query(
      supabase.from('projects').select('*').order('created_at')
    )
    return data.map(toCamel)
  },

  async create({ clientId, name, color = '#6366F1', userId }) {
    const data = await query(
      supabase
        .from('projects')
        .insert({ client_id: clientId, name, color, user_id: userId })
        .select()
        .single()
    )
    return toCamel(data)
  },

  async update(id, updates) {
    const data = await query(
      supabase
        .from('projects')
        .update(toSnake(updates))
        .eq('id', id)
        .select()
        .single()
    )
    return toCamel(data)
  },

  async delete(id) {
    await query(supabase.from('projects').delete().eq('id', id))
  },
}

// ---------------------------------------------------------------------------
// Tasks (con subtasks embebidos)
// ---------------------------------------------------------------------------

export const tasks = {
  async list() {
    const data = await query(
      supabase
        .from('tasks')
        .select('*, subtasks(*)')
        .order('created_at')
    )
    return data.map(toCamel)
  },

  async create({ title, description = '', clientId, projectId, color = '#3B82F6', userId }) {
    const data = await query(
      supabase
        .from('tasks')
        .insert({
          title,
          description,
          client_id: clientId || null,
          project_id: projectId || null,
          color,
          user_id: userId,
          status: 'pending',
        })
        .select('*, subtasks(*)')
        .single()
    )
    return toCamel(data)
  },

  async update(id, updates) {
    const { subtasks: _subtasks, colorOverride: _co, ...rest } = updates
    const data = await query(
      supabase
        .from('tasks')
        .update(toSnake(rest))
        .eq('id', id)
        .select('*, subtasks(*)')
        .single()
    )
    return toCamel(data)
  },

  async delete(id) {
    await query(supabase.from('tasks').delete().eq('id', id))
  },
}

// ---------------------------------------------------------------------------
// Subtasks
// ---------------------------------------------------------------------------

export const subtasks = {
  async create({ taskId, title, description = '', userId }) {
    const data = await query(
      supabase
        .from('subtasks')
        .insert({ task_id: taskId, title, description, done: false, user_id: userId })
        .select()
        .single()
    )
    return toCamel(data)
  },

  async update(id, updates) {
    const data = await query(
      supabase
        .from('subtasks')
        .update(toSnake(updates))
        .eq('id', id)
        .select()
        .single()
    )
    return toCamel(data)
  },

  async toggle(id, done) {
    const data = await query(
      supabase
        .from('subtasks')
        .update({ done })
        .eq('id', id)
        .select()
        .single()
    )
    return toCamel(data)
  },

  async delete(id) {
    await query(supabase.from('subtasks').delete().eq('id', id))
  },
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export const entries = {
  async list() {
    const data = await query(
      supabase.from('entries').select('*').order('date').order('start_time')
    )
    return data.map(normalizeEntry)
  },

  async create({ taskId, clientId, projectId, subtaskId, date, startTime, endTime, notes = '', isSubtask = false, isAllDay = false, userId }) {
    const data = await query(
      supabase
        .from('entries')
        .insert({
          task_id: taskId || null,
          client_id: clientId || null,
          project_id: projectId || null,
          subtask_id: subtaskId || null,
          date,
          start_time: isAllDay ? null : (startTime || null),
          end_time: isAllDay ? null : (endTime || null),
          notes,
          is_subtask: isSubtask,
          is_all_day: isAllDay,
          user_id: userId,
        })
        .select()
        .single()
    )
    return normalizeEntry(data)
  },

  async update(id, updates) {
    // Excluir campos que no existen en la tabla (son solo caché del cliente)
    const { subtaskTitle, userId, createdAt, ...dbFields } = updates
    const data = await query(
      supabase
        .from('entries')
        .update(toSnake(dbFields))
        .eq('id', id)
        .select()
        .single()
    )
    return normalizeEntry(data)
  },

  async delete(id) {
    await query(supabase.from('entries').delete().eq('id', id))
  },
}
