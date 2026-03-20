import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import * as db from '../lib/db'
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
    try {
      const [c, p, t, e] = await Promise.all([
        db.clients.list(),
        db.projects.list(),
        db.tasks.list(),
        db.entries.list(),
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

    const channel = supabase
      .channel(`user-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        db.clients.list().then(setClients).catch(console.error)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        db.projects.list().then(setProjects).catch(console.error)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        db.tasks.list().then(setTasks).catch(console.error)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, () => {
        db.tasks.list().then(setTasks).catch(console.error)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, () => {
        db.entries.list().then(setEntries).catch(console.error)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── CLIENTES ──────────────────────────────────────────────────────────────
  const addClient = async (name, color = '#3B82F6') => {
    const c = await db.clients.create({ name, color, userId })
    setClients(p => [...p, c])
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
    setProjects(prev => [...prev, p])
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
    // Sincronizar subtareas al completar/descompletar tarea manualmente
    const task = tasks.find(t => t.id === id)
    if (task) {
      if (updates.status === 'done' && task.status !== 'done') {
        // Marcar todas las subtareas como done en DB
        await Promise.all(
          (task.subtasks || []).filter(st => !st.done).map(st => db.subtasks.toggle(st.id, true))
        )
      } else if (updates.status === 'pending' && task.status === 'done') {
        // Revertir todas las subtareas
        await Promise.all(
          (task.subtasks || []).filter(st => st.done).map(st => db.subtasks.toggle(st.id, false))
        )
      }
    }
    const t = await db.tasks.update(id, updates)
    setTasks(p => p.map(x => x.id === id ? t : x))
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
    await db.subtasks.toggle(subtaskId, newDone)

    const newSubtasks = (task.subtasks || []).map(st =>
      st.id === subtaskId ? { ...st, done: newDone } : st
    )
    const allDone = newSubtasks.length > 0 && newSubtasks.every(st => st.done)
    const newStatus = allDone ? 'done' : (task.status === 'done' ? 'pending' : task.status)

    if (newStatus !== task.status) {
      await db.tasks.update(taskId, { status: newStatus })
    }

    setTasks(p => p.map(t =>
      t.id === taskId ? { ...t, subtasks: newSubtasks, status: newStatus } : t
    ))
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
    setEntries(p => [...p, e])
    return e
  }

  const updateEntry = async (id, updates) => {
    const e = await db.entries.update(id, updates)
    setEntries(p => p.map(x => x.id === id ? e : x))
  }

  const removeEntry = async (id) => {
    await db.entries.delete(id)
    setEntries(p => p.filter(e => e.id !== id))
  }

  // ── Helpers de consulta (sin cambios de API) ──────────────────────────────
  const getEntriesByDay = (dateStr) => entries.filter(e => e.date === dateStr)

  const getDailySummary = (dateStr) => {
    const dayEntries = getEntriesByDay(dateStr)
    const grouped = {}
    dayEntries.forEach(e => {
      const key = e.taskId || `${e.clientId}-${e.projectId}`
      if (!grouped[key]) {
        const task = tasks.find(t => t.id === e.taskId)
        const client = clients.find(c => c.id === e.clientId)
        const project = projects.find(p => p.id === e.projectId)
        grouped[key] = { task, client, project, totalMinutes: 0, entries: [] }
      }
      const [sh, sm] = e.startTime.split(':').map(Number)
      const [eh, em] = e.endTime.split(':').map(Number)
      let diff = (eh * 60 + em) - (sh * 60 + sm)
      if (diff < 0) diff += 24 * 60
      grouped[key].totalMinutes += diff
      grouped[key].entries.push(e)
    })
    return Object.values(grouped)
  }

  const getClient = (id) => clients.find(c => c.id === id)
  const getProject = (id) => projects.find(p => p.id === id)
  const getTask = (id) => tasks.find(t => t.id === id)
  const getProjectsByClient = (clientId) => projects.filter(p => p.clientId === clientId)

  const getEntryColor = (entry) => {
    const task = getTask(entry.taskId)
    if (task?.color) return task.color
    const project = getProject(entry.projectId)
    if (project?.color) return project.color
    const client = getClient(entry.clientId)
    return client?.color || '#3B82F6'
  }

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
