import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { startOfMonth, endOfMonth, subMonths, addMonths, format } from 'date-fns'
import { useAuth } from './AuthContext'
import * as db from '../lib/db'
import { toCamel, normalizeEntry } from '../lib/db'
import { supabase } from '../lib/supabase'

const AppContext = createContext()
export const useApp = () => useContext(AppContext)

const load = (key, def) => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def } catch { return def }
}

export const AppProvider = ({ children }) => {
  const { user } = useAuth()
  const userId = user?.id

  // ── Tema (local por dispositivo) ──────────────────────────────────────────
  const [theme, setTheme] = useState(() => load('ct_theme', 'dark'))
  useEffect(() => { localStorage.setItem('ct_theme', theme) }, [theme])
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])

  // ── Estado ────────────────────────────────────────────────────────────────
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [entries, setEntries] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  // ── Carga inicial desde Supabase ──────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!userId) return
    setDataLoading(true)
    const today = new Date()
    const from = format(subMonths(startOfMonth(today), 1), 'yyyy-MM-dd')
    const to   = format(addMonths(endOfMonth(today), 1),  'yyyy-MM-dd')
    try {
      const [c, p, t, e] = await Promise.all([
        db.clients.list(),
        db.projects.list(),
        db.tasks.list(),
        db.entries.listByRange(from, to),
      ])
      setClients(c)
      setProjects(p)
      setTasks(t)
      setEntries(e)
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setDataLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setClients([])
      setProjects([])
      setTasks([])
      setEntries([])
      setDataLoading(false)
      return
    }
    loadAll()
  }, [userId, loadAll])

  // ── Realtime: sync entre dispositivos/pestañas ────────────────────────────
  useEffect(() => {
    if (!userId) return

    const applyDelta = (setter, transform) => (payload) => {
      const { eventType, new: rec, old } = payload
      if (eventType === 'INSERT') setter(prev => [...prev, transform(rec)])
      else if (eventType === 'UPDATE') setter(prev => prev.map(r => r.id === rec.id ? transform(rec) : r))
      else if (eventType === 'DELETE') setter(prev => prev.filter(r => r.id !== old.id))
    }

    const channel = supabase
      .channel(`user-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' },
        applyDelta(setClients, toCamel))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' },
        applyDelta(setProjects, toCamel))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        const { eventType, new: rec, old } = payload
        if (eventType === 'INSERT') {
          setTasks(prev => [...prev, { ...toCamel(rec), subtasks: [] }])
        } else if (eventType === 'UPDATE') {
          // Preservar subtareas del estado local — el payload no las incluye
          setTasks(prev => prev.map(t => t.id === rec.id ? { ...toCamel(rec), subtasks: t.subtasks || [] } : t))
        } else if (eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, (payload) => {
        const { eventType, new: rec, old } = payload
        if (eventType === 'INSERT') {
          setTasks(prev => prev.map(t =>
            t.id === rec.task_id ? { ...t, subtasks: [...(t.subtasks || []), toCamel(rec)] } : t
          ))
        } else if (eventType === 'UPDATE') {
          setTasks(prev => prev.map(t =>
            t.id === rec.task_id
              ? { ...t, subtasks: (t.subtasks || []).map(st => st.id === rec.id ? toCamel(rec) : st) }
              : t
          ))
        } else if (eventType === 'DELETE') {
          // old.task_id puede ser undefined sin REPLICA IDENTITY FULL — scan por id
          setTasks(prev => prev.map(t => ({ ...t, subtasks: (t.subtasks || []).filter(st => st.id !== old.id) })))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' },
        applyDelta(setEntries, normalizeEntry))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── CLIENTES ──────────────────────────────────────────────────────────────
  const addClient = async (name, color = '#3B82F6') => {
    const c = await db.clients.create({ name, color, userId })
    return c
  }

  const updateClient = async (id, updates) => {
    const c = await db.clients.update(id, updates)
    setClients(p => p.map(x => x.id === id ? c : x))
  }

  const removeClient = async (id) => {
    await db.clients.delete(id)
    setClients(p => p.filter(c => c.id !== id))
    setProjects(p => p.filter(pr => pr.clientId !== id))
  }

  // ── PROYECTOS ─────────────────────────────────────────────────────────────
  const addProject = async (clientId, name, color = '#6366F1') => {
    const p = await db.projects.create({ clientId, name, color, userId })
    return p
  }

  const updateProject = async (id, updates) => {
    const p = await db.projects.update(id, updates)
    setProjects(prev => prev.map(x => x.id === id ? p : x))
  }

  const removeProject = async (id) => {
    await db.projects.delete(id)
    setProjects(p => p.filter(pr => pr.id !== id))
  }

  // ── TAREAS ────────────────────────────────────────────────────────────────
  const addTask = async (data) => {
    const t = await db.tasks.create({ ...data, userId })
    setTasks(p => [t, ...p])
    return t
  }

  const updateTask = async (id, updates) => {
    const task = tasks.find(t => t.id === id)
    const previousTasks = tasks

    // Calcular estado optimista de subtareas si cambia el status
    let optimisticSubtasks = task?.subtasks
    if (task) {
      if (updates.status === 'done' && task.status !== 'done') {
        optimisticSubtasks = (task.subtasks || []).map(st => ({ ...st, done: true }))
      } else if (updates.status === 'pending' && task.status === 'done') {
        optimisticSubtasks = (task.subtasks || []).map(st => ({ ...st, done: false }))
      }
    }

    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates, subtasks: optimisticSubtasks ?? t.subtasks } : t
    ))

    try {
      // Sincronizar subtareas en DB si corresponde
      if (task) {
        if (updates.status === 'done' && task.status !== 'done') {
          await Promise.all(
            (task.subtasks || []).filter(st => !st.done).map(st => db.subtasks.toggle(st.id, true))
          )
        } else if (updates.status === 'pending' && task.status === 'done') {
          await Promise.all(
            (task.subtasks || []).filter(st => st.done).map(st => db.subtasks.toggle(st.id, false))
          )
        }
      }
      const confirmed = await db.tasks.update(id, updates)
      setTasks(prev => prev.map(t => t.id === id ? confirmed : t))
    } catch (err) {
      console.error('Error actualizando task, revirtiendo:', err)
      setTasks(previousTasks)
    }
  }

  const removeTask = async (id) => {
    await db.entries.deleteByTaskId(id)
    await db.tasks.delete(id)
    setTasks(p => p.filter(t => t.id !== id))
    setEntries(p => p.filter(e => e.taskId !== id))
  }

  // ── SUBTAREAS ─────────────────────────────────────────────────────────────
  const addSubtask = async (taskId, title, description = '') => {
    const st = await db.subtasks.create({ taskId, title, description, userId })
    setTasks(p => p.map(t =>
      t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), st] } : t
    ))
    return st
  }

  const updateSubtask = async (taskId, subtaskId, updates) => {
    const st = await db.subtasks.update(subtaskId, updates)
    setTasks(p => p.map(t => {
      if (t.id !== taskId) return t
      return { ...t, subtasks: (t.subtasks || []).map(s => s.id === subtaskId ? { ...s, ...st } : s) }
    }))
  }

  const toggleSubtask = async (taskId, subtaskId) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const subtask = (task.subtasks || []).find(st => st.id === subtaskId)
    if (!subtask) return

    const newDone = !subtask.done
    const previousTasks = tasks

    const newSubtasks = (task.subtasks || []).map(st =>
      st.id === subtaskId ? { ...st, done: newDone } : st
    )
    const allDone = newSubtasks.length > 0 && newSubtasks.every(st => st.done)
    const newStatus = allDone ? 'done' : (task.status === 'done' ? 'pending' : task.status)

    setTasks(p => p.map(t =>
      t.id === taskId ? { ...t, subtasks: newSubtasks, status: newStatus } : t
    ))

    try {
      await db.subtasks.toggle(subtaskId, newDone)
      if (newStatus !== task.status) {
        await db.tasks.update(taskId, { status: newStatus })
      }
    } catch (err) {
      console.error('Error en toggleSubtask, revirtiendo:', err)
      setTasks(previousTasks)
    }
  }

  const removeSubtask = async (taskId, subtaskId) => {
    await db.subtasks.delete(subtaskId)
    setTasks(p => p.map(t => {
      if (t.id !== taskId) return t
      return { ...t, subtasks: (t.subtasks || []).filter(st => st.id !== subtaskId) }
    }))
  }

  // ── ENTRADAS DE TIEMPO ────────────────────────────────────────────────────
  const addEntry = async (data) => {
    const e = await db.entries.create({ ...data, userId })
    return e
  }

  const updateEntry = async (id, updates) => {
    const previousEntries = entries
    setEntries(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x))
    try {
      const confirmed = await db.entries.update(id, updates)
      setEntries(prev => prev.map(x => x.id === id ? confirmed : x))
    } catch (err) {
      console.error('Error actualizando entry, revirtiendo:', err)
      setEntries(previousEntries)
    }
  }

  const removeEntry = async (id) => {
    await db.entries.delete(id)
    setEntries(p => p.filter(e => e.id !== id))
  }

  // ── Helpers de consulta (sin cambios de API) ──────────────────────────────
  const getClient = useCallback((id) => clients.find(c => c.id === id), [clients])
  const getProject = useCallback((id) => projects.find(p => p.id === id), [projects])
  const getTask = useCallback((id) => tasks.find(t => t.id === id), [tasks])
  const getProjectsByClient = useCallback((clientId) => projects.filter(p => p.clientId === clientId), [projects])

  const getEntryColor = useCallback((entry) => {
    const task = tasks.find(t => t.id === entry.taskId)
    if (task?.color) return task.color
    const project = projects.find(p => p.id === entry.projectId)
    if (project?.color) return project.color
    const client = clients.find(c => c.id === entry.clientId)
    return client?.color || '#3B82F6'
  }, [tasks, projects, clients])

  const getEntriesByDay = useCallback((dateStr) => entries.filter(e => e.date === dateStr), [entries])

  const getDailySummary = useCallback((dateStr) => {
    const dayEntries = entries.filter(e => e.date === dateStr)
    const grouped = {}
    dayEntries.forEach(e => {
      const key = e.taskId || `${e.clientId}-${e.projectId}`
      if (!grouped[key]) {
        const task = tasks.find(t => t.id === e.taskId)
        const client = clients.find(c => c.id === e.clientId)
        const project = projects.find(p => p.id === e.projectId)
        grouped[key] = { task, client, project, totalMinutes: 0, entries: [] }
      }
      if (!e.startTime || !e.endTime) return
      const [sh, sm] = e.startTime.split(':').map(Number)
      const [eh, em] = e.endTime.split(':').map(Number)
      let diff = (eh * 60 + em) - (sh * 60 + sm)
      if (diff < 0) diff += 24 * 60
      grouped[key].totalMinutes += diff
      grouped[key].entries.push(e)
    })
    return Object.values(grouped)
  }, [entries, tasks, clients, projects])

  return (
    <AppContext.Provider value={{
      theme, setTheme,
      isMobileSidebarOpen, setIsMobileSidebarOpen,
      dataLoading,
      clients, addClient, updateClient, removeClient,
      projects, addProject, updateProject, removeProject,
      tasks, addTask, updateTask, removeTask,
      addSubtask, updateSubtask, toggleSubtask, removeSubtask,
      entries, addEntry, updateEntry, removeEntry,
      getEntriesByDay, getDailySummary,
      getClient, getProject, getTask, getProjectsByClient, getEntryColor,
    }}>
      {children}
    </AppContext.Provider>
  )
}
