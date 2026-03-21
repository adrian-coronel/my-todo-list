/**
 * seedTestData.js — Genera clientes, proyectos, tareas y entradas de prueba
 * para el mes actual. Los datos de prueba se marcan con el prefijo "[Seed]"
 * para poder limpiarlos fácilmente sin tocar datos reales.
 *
 * USO desde la consola del navegador (modo desarrollo):
 *   await window.__seed()        // crea todo
 *   await window.__seedClean()   // borra solo los datos [Seed]
 */

import { supabase } from '../lib/supabase'

// ── Plantillas de datos de prueba ─────────────────────────────────────────────

const SEED_CLIENTS = [
  { name: '[Seed] Acme Corp',    color: '#3b82f6' },
  { name: '[Seed] Startup XYZ', color: '#10b981' },
  { name: '[Seed] Freelance',   color: '#f59e0b' },
]

const SEED_PROJECTS = [
  { clientIdx: 0, name: '[Seed] Rediseño Web',       color: '#6366f1' },
  { clientIdx: 0, name: '[Seed] App Mobile',          color: '#8b5cf6' },
  { clientIdx: 1, name: '[Seed] Dashboard Analytics', color: '#06b6d4' },
  { clientIdx: 1, name: '[Seed] API Backend',         color: '#10b981' },
  { clientIdx: 2, name: '[Seed] Consultoría UX',      color: '#f97316' },
]

const SEED_TASKS = [
  { projIdx: 0, title: '[Seed] Diseño de wireframes',     color: '#6366f1' },
  { projIdx: 0, title: '[Seed] Implementar componentes',  color: '#7c3aed' },
  { projIdx: 1, title: '[Seed] Pantallas de onboarding',  color: '#8b5cf6' },
  { projIdx: 1, title: '[Seed] Integración push',         color: '#a78bfa' },
  { projIdx: 2, title: '[Seed] Gráficas de métricas',     color: '#0891b2' },
  { projIdx: 2, title: '[Seed] Filtros y exportación',    color: '#06b6d4' },
  { projIdx: 3, title: '[Seed] Endpoints REST',           color: '#059669' },
  { projIdx: 3, title: '[Seed] Autenticación JWT',        color: '#10b981' },
  { projIdx: 4, title: '[Seed] Entrevistas usuarios',     color: '#ea580c' },
  { projIdx: 4, title: '[Seed] Prototipo interactivo',    color: '#f97316' },
]

// Bloques de tiempo (hora inicio, duración en minutos)
const TIME_BLOCKS = [
  ['09:00', 90], ['09:00', 120], ['09:30', 60],  ['10:00', 90],
  ['10:00', 120], ['10:30', 90], ['11:00', 60],  ['11:00', 90],
  ['11:30', 60],  ['13:00', 90], ['13:00', 120], ['13:30', 60],
  ['14:00', 90],  ['14:00', 120],['14:30', 60],  ['15:00', 90],
  ['15:30', 60],  ['16:00', 120],['16:00', 90],  ['16:30', 60],
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function getWorkdays(year, month) {
  const days = []
  const date = new Date(year, month - 1, 1)
  while (date.getMonth() === month - 1) {
    const dow = date.getDay()
    if (dow >= 1 && dow <= 5) {
      days.push(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      )
    }
    date.setDate(date.getDate() + 1)
  }
  return days
}

/** LCG simple para generar números pseudo-aleatorios reproducibles por fecha */
function makePrng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

// ── Seed principal ────────────────────────────────────────────────────────────

export async function seedTestData() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { console.error('[Seed] ❌ No hay sesión activa. Inicia sesión primero.'); return }
  const uid = user.id
  console.log('[Seed] 🌱 Iniciando para usuario:', uid)

  // 0. Borrar datos [Seed] anteriores para empezar limpio
  await cleanSeedData(uid, false)

  // 1. Crear clientes
  const clientRows = []
  for (const c of SEED_CLIENTS) {
    const { data, error } = await supabase
      .from('clients').insert({ name: c.name, color: c.color, user_id: uid })
      .select().single()
    if (error) { console.warn('[Seed] cliente:', error.message); continue }
    clientRows.push(data)
  }
  console.log(`[Seed]   ✓ ${clientRows.length} cliente(s)`)

  // 2. Crear proyectos
  const projectRows = []
  for (const p of SEED_PROJECTS) {
    const client = clientRows[p.clientIdx]
    if (!client) continue
    const { data, error } = await supabase
      .from('projects').insert({ name: p.name, color: p.color, client_id: client.id, user_id: uid })
      .select().single()
    if (error) { console.warn('[Seed] proyecto:', error.message); continue }
    projectRows.push(data)
  }
  console.log(`[Seed]   ✓ ${projectRows.length} proyecto(s)`)

  // 3. Crear tareas
  const taskRows = []
  for (const t of SEED_TASKS) {
    const project = projectRows[t.projIdx]
    if (!project) continue
    const { data, error } = await supabase
      .from('tasks').insert({
        title: t.title,
        color: t.color,
        client_id: project.client_id,
        project_id: project.id,
        user_id: uid,
        status: 'pending',
        description: '',
      })
      .select('id, client_id, project_id, color')
      .single()
    if (error) { console.warn('[Seed] tarea:', error.message); continue }
    taskRows.push(data)
  }
  console.log(`[Seed]   ✓ ${taskRows.length} tarea(s) — visibles en el sidebar`)

  if (!taskRows.length) { console.error('[Seed] ❌ Sin tareas, abortando.'); return }

  // 4. Crear entradas para el mes actual (lunes–viernes)
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const workdays = getWorkdays(year, month)

  const allEntries = []
  for (const date of workdays) {
    const rng = makePrng(parseInt(date.replace(/-/g, ''), 10))
    const count = 2 + Math.floor(rng() * 3) // 2–4 entradas por día
    const usedStarts = new Set()

    for (let i = 0; i < count; i++) {
      let block, tries = 0
      do { block = TIME_BLOCKS[Math.floor(rng() * TIME_BLOCKS.length)]; tries++ }
      while (usedStarts.has(block[0]) && tries < 20)
      usedStarts.add(block[0])

      const task = taskRows[Math.floor(rng() * taskRows.length)]
      allEntries.push({
        task_id:    task.id,
        client_id:  task.client_id,
        project_id: task.project_id,
        date,
        start_time: block[0],
        end_time:   addMinutes(block[0], block[1]),
        notes:      '',
        is_all_day: false,
        is_subtask: false,
        user_id:    uid,
      })
    }
  }

  // Insertar en lotes de 50
  let inserted = 0
  for (let i = 0; i < allEntries.length; i += 50) {
    const { error } = await supabase.from('entries').insert(allEntries.slice(i, i + 50))
    if (error) { console.error('[Seed] entries:', error.message); break }
    inserted += allEntries.slice(i, i + 50).length
  }

  console.log(`[Seed] ✅ Listo: ${clientRows.length} clientes · ${projectRows.length} proyectos · ${taskRows.length} tareas · ${inserted} entradas`)
  console.log('[Seed]    El sidebar y el calendario se actualizan en tiempo real.')
  return { clients: clientRows.length, projects: projectRows.length, tasks: taskRows.length, entries: inserted }
}

// ── Limpieza: borra SOLO datos con prefijo [Seed] ─────────────────────────────

async function cleanSeedData(uid, verbose = true) {
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { console.error('[Seed] ❌ Sin sesión.'); return }
    uid = user.id
  }

  // 1. Obtener IDs de clientes [Seed]
  const { data: seedClients } = await supabase
    .from('clients').select('id').eq('user_id', uid).like('name', '[Seed]%')
  if (!seedClients?.length) {
    if (verbose) console.log('[Seed] No hay datos de prueba para eliminar.')
    return
  }
  const clientIds = seedClients.map(c => c.id)

  // 2. Obtener IDs de proyectos [Seed]
  const { data: seedProjects } = await supabase
    .from('projects').select('id').in('client_id', clientIds)
  const projectIds = seedProjects?.map(p => p.id) || []

  // 3. Obtener IDs de tareas [Seed]
  const { data: seedTasks } = projectIds.length
    ? await supabase.from('tasks').select('id').in('project_id', projectIds)
    : { data: [] }
  const taskIds = seedTasks?.map(t => t.id) || []

  // 4. Borrar en cascada (entries → tasks → projects → clients)
  if (taskIds.length) {
    await supabase.from('entries').delete().in('task_id', taskIds)
    await supabase.from('tasks').delete().in('id', taskIds)
  }
  if (projectIds.length) await supabase.from('projects').delete().in('id', projectIds)
  await supabase.from('clients').delete().in('id', clientIds)

  if (verbose) console.log(`[Seed] 🗑️  Eliminados: ${clientIds.length} clientes · ${projectIds.length} proyectos · ${taskIds.length} tareas y sus entradas.`)
}

export const cleanSeedEntries = () => cleanSeedData(null, true)

// ── Exponer en window (solo en desarrollo) ─────────────────────────────────────
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__seed = seedTestData
  window.__seedClean = cleanSeedEntries
  console.log('[Seed] Disponible: window.__seed() | window.__seedClean()')
}
