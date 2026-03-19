import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

const AppContext = createContext();
export const useApp = () => useContext(AppContext);

const load = (key, def) => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
};

// ─── Datos de demostración para primera carga ───────────────────────────────
const DEMO_CLIENTS = [
  { id: 'c1', name: 'Acme Corp', color: '#3B82F6' },
  { id: 'c2', name: 'Globex', color: '#10B981' },
];
const DEMO_PROJECTS = [
  { id: 'p1', clientId: 'c1', name: 'Rediseño Web', color: '#6366F1' },
  { id: 'p2', clientId: 'c1', name: 'App Móvil', color: '#F59E0B' },
  { id: 'p3', clientId: 'c2', name: 'Dashboard BI', color: '#EF4444' },
];

export const AppProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => load('ct_theme', 'dark'));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // ── Catálogo ──────────────────────────────────────────────────────────────
  const [clients, setClients] = useState(() => load('ct_clients', DEMO_CLIENTS));
  const [projects, setProjects] = useState(() => load('ct_projects', DEMO_PROJECTS));

  // ── Tareas (con subtareas embebidas) ──────────────────────────────────────
  // Estructura tarea: { id, title, description, clientId, projectId, status, color, subtasks: [{id, title, done}] }
  const [tasks, setTasks] = useState(() => load('ct_tasks', []));

  // ── Entradas de Tiempo ────────────────────────────────────────────────────
  // Estructura entry: { id, taskId, clientId, projectId, date, startTime, endTime, notes, isSubtask, subtaskId }
  const [entries, setEntries] = useState(() => load('ct_entries', []));

  // ── Persistencia ──────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('ct_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('ct_clients', JSON.stringify(clients)); }, [clients]);
  useEffect(() => { localStorage.setItem('ct_projects', JSON.stringify(projects)); }, [projects]);
  useEffect(() => { localStorage.setItem('ct_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('ct_entries', JSON.stringify(entries)); }, [entries]);

  // ── Aplicar tema al DOM ───────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── CLIENTES ──────────────────────────────────────────────────────────────
  const addClient = (name, color = '#3B82F6') => {
    const c = { id: uuidv4(), name, color };
    setClients(p => [...p, c]);
    return c;
  };
  const updateClient = (id, updates) => setClients(p => p.map(c => c.id === id ? { ...c, ...updates } : c));
  const removeClient = (id) => {
    setClients(p => p.filter(c => c.id !== id));
    setProjects(p => p.filter(pr => pr.clientId !== id));
  };

  // ── PROYECTOS ─────────────────────────────────────────────────────────────
  const addProject = (clientId, name, color = '#6366F1') => {
    const p = { id: uuidv4(), clientId, name, color };
    setProjects(prev => [...prev, p]);
    return p;
  };
  const updateProject = (id, updates) => setProjects(p => p.map(pr => pr.id === id ? { ...pr, ...updates } : pr));
  const removeProject = (id) => setProjects(p => p.filter(pr => pr.id !== id));

  // ── TAREAS ────────────────────────────────────────────────────────────────
  const addTask = (data) => {
    const t = { id: uuidv4(), subtasks: [], status: 'pending', createdAt: new Date().toISOString(), ...data };
    setTasks(p => [t, ...p]);
    return t;
  };
  const updateTask = (id, updates) => {
    setTasks(p => p.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        // Sincronizar subtareas al completar o descompletar tarea manual
        if (updates.status === 'done' && t.status !== 'done') {
          updated.subtasks = (t.subtasks || []).map(st => ({ ...st, done: true }));
        } else if (updates.status === 'pending' && t.status === 'done') {
          updated.subtasks = (t.subtasks || []).map(st => ({ ...st, done: false }));
        }
        return updated;
      }
      return t;
    }));
  };
  const removeTask = (id) => {
    setTasks(p => p.filter(t => t.id !== id));
    setEntries(p => p.filter(e => e.taskId !== id));
  };

  // ── SUBTAREAS ─────────────────────────────────────────────────────────────
  const addSubtask = (taskId, title) => {
    const st = { id: uuidv4(), title, done: false };
    setTasks(p => p.map(t => t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), st] } : t));
    return st;
  };
  const toggleSubtask = (taskId, subtaskId) => {
    setTasks(p => p.map(t => {
      if (t.id !== taskId) return t;
      const newSubtasks = t.subtasks.map(st => st.id === subtaskId ? { ...st, done: !st.done } : st);
      // Auto completar tarea si todas finalizan o descompletarla si destildamos
      const allDone = newSubtasks.length > 0 && newSubtasks.every(st => st.done);
      const newStatus = allDone ? 'done' : (t.status === 'done' ? 'pending' : t.status);
      return { ...t, subtasks: newSubtasks, status: newStatus };
    }));
  };
  const removeSubtask = (taskId, subtaskId) => {
    setTasks(p => p.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, subtasks: t.subtasks.filter(st => st.id !== subtaskId) };
    }));
  };

  // ── ENTRADAS DE TIEMPO ────────────────────────────────────────────────────
  const addEntry = (data) => {
    const e = { id: uuidv4(), createdAt: new Date().toISOString(), notes: '', ...data };
    setEntries(p => [...p, e]);
    return e;
  };
  const updateEntry = (id, updates) => setEntries(p => p.map(e => e.id === id ? { ...e, ...updates } : e));
  const removeEntry = (id) => setEntries(p => p.filter(e => e.id !== id));

  const getEntriesByDay = (dateStr) => entries.filter(e => e.date === dateStr);

  const getDailySummary = (dateStr) => {
    const dayEntries = getEntriesByDay(dateStr);
    const grouped = {};
    dayEntries.forEach(e => {
      const key = e.taskId || `${e.clientId}-${e.projectId}`;
      if (!grouped[key]) {
        const task = tasks.find(t => t.id === e.taskId);
        const client = clients.find(c => c.id === e.clientId);
        const project = projects.find(p => p.id === e.projectId);
        grouped[key] = { task, client, project, totalMinutes: 0, entries: [] };
      }
      const [sh, sm] = e.startTime.split(':').map(Number);
      const [eh, em] = e.endTime.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60;
      grouped[key].totalMinutes += diff;
      grouped[key].entries.push(e);
    });
    return Object.values(grouped);
  };

  // ── Helpers de lookup ─────────────────────────────────────────────────────
  const getClient = (id) => clients.find(c => c.id === id);
  const getProject = (id) => projects.find(p => p.id === id);
  const getTask = (id) => tasks.find(t => t.id === id);
  const getProjectsByClient = (clientId) => projects.filter(p => p.clientId === clientId);

  // ── Colores de bloques de calendario ─────────────────────────────────────
  const getEntryColor = (entry) => {
    const task = getTask(entry.taskId);
    if (task?.color) return task.color;
    const project = getProject(entry.projectId);
    if (project?.color) return project.color;
    const client = getClient(entry.clientId);
    return client?.color || '#3B82F6';
  };

  return (
    <AppContext.Provider value={{
      theme, setTheme,
      isMobileSidebarOpen, setIsMobileSidebarOpen,
      clients, addClient, updateClient, removeClient,
      projects, addProject, updateProject, removeProject,
      tasks, addTask, updateTask, removeTask,
      addSubtask, toggleSubtask, removeSubtask,
      entries, addEntry, updateEntry, removeEntry,
      getEntriesByDay, getDailySummary,
      getClient, getProject, getTask, getProjectsByClient, getEntryColor,
    }}>
      {children}
    </AppContext.Provider>
  );
};
