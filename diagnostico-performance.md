# Diagnóstico de Performance y Arquitectura de Datos

> Proyecto: interstellar-mare
> Fecha: 2026-03-20
> Stack: React 19 + Vite + Supabase

---

## 1. Región de Supabase

**URL:** `https://boqvrpinsnnfpmpoxfyr.supabase.co`

El project ref `boqvrpinsnnfpmpoxfyr` es un identificador aleatorio opaco — Supabase **no codifica la región en el subdominio** desde ~2022. No es posible determinarla desde la URL.

**Para verificarla:** Supabase Dashboard → Settings → General → **Region**

> ⚠️ Si la región es `us-east-1` (Virginia) o `ap-southeast-1` (Singapur) y el usuario está en Latinoamérica, cada round-trip tiene 150–300ms de latencia base, lo que hace crítico implementar optimistic updates.

---

## 2. Patrón de Consultas a la Base de Datos

### Carga inicial (`AppContext.jsx:32-51`)

```js
loadAll() → Promise.all([clients, projects, tasks, entries])
```

| Propiedad | Detalle |
|-----------|---------|
| **Datos cargados** | Las 4 tablas completas en paralelo |
| **Cuándo se dispara** | Al montar `AppProvider` (cuando `userId` cambia de `null` a un valor) |
| **Filtros** | Ninguno — sin paginación, sin filtro de fechas |

**Problema crítico:** `entries.list()` trae **todos los registros de tiempo de toda la vida del usuario** sin filtro de rango de fechas. El payload crece indefinidamente con el uso.

### Tras mutaciones

El patrón es **pessimistic** — siempre espera confirmación de Supabase antes de actualizar el estado local:

| Operación | Flujo |
|-----------|-------|
| `addEntry` | `await db.entries.create()` → `setEntries` |
| `updateEntry` | `await db.entries.update()` → `setEntries` |
| `updateTask` | `await db.tasks.update()` → `setTasks` |
| `toggleSubtask` | `await db.subtasks.toggle()` → (await tasks.update si aplica) → `setTasks` |

---

## 3. Optimistic Updates — No Existen + Bug Crítico

**No hay ningún optimistic update en el proyecto.** Pero además existe un bug activo de duplicados.

### El bug de duplicados (`AppContext.jsx:65-94` + `AppContext.jsx:215-218`)

Cuando el usuario crea una entry ocurre la siguiente secuencia:

1. `await db.entries.create()` → DB confirma INSERT
2. `setEntries(p => [...p, e])` — entrada añadida al estado ✅
3. El canal realtime recibe el evento `INSERT` de `postgres_changes`
4. `applyDelta` → `setter(prev => [...prev, transform(rec)])` — **entrada añadida OTRA VEZ** ❌

El mismo bug existe para `clients` y `projects`. Para `tasks` no ocurre porque el realtime de tasks hace un full reload (`db.tasks.list()`), que sobreescribe en vez de acumular.

### Código actual de las 3 acciones más frecuentes

**1. Crear entrada de tiempo** (`AppContext.jsx:215-219`):

```js
const addEntry = async (data) => {
  const e = await db.entries.create({ ...data, userId })  // ← espera red
  setEntries(p => [...p, e])   // UI actualiza DESPUÉS del round-trip
  return e
}
```

**2. Mover / redimensionar entry en calendario** (`AppContext.jsx:221-224`):

```js
const updateEntry = async (id, updates) => {
  const e = await db.entries.update(id, updates)  // ← espera red
  setEntries(p => p.map(x => x.id === id ? e : x))
}
```

**3. Marcar subtarea como completada** (`AppContext.jsx:182-203`):

```js
const toggleSubtask = async (taskId, subtaskId) => {
  const task = tasks.find(t => t.id === taskId)
  const subtask = (task.subtasks || []).find(st => st.id === subtaskId)
  const newDone = !subtask.done
  await db.subtasks.toggle(subtaskId, newDone)  // ← espera red
  // puede await db.tasks.update() adicional si cambia status
  // ... setTasks solo llega aquí después de todo lo anterior
}
```

---

## 4. Realtime de Supabase

**Sí implementado** via `supabase.channel()` + `postgres_changes` (`AppContext.jsx:76-91`).

| Tabla | Estrategia | Estado |
|-------|-----------|--------|
| `clients` | `applyDelta` granular (INSERT/UPDATE/DELETE) | ✅ Correcto (con bug duplicados) |
| `projects` | `applyDelta` granular | ✅ Correcto (con bug duplicados) |
| `tasks` | `db.tasks.list()` full reload | ⚠️ Costoso |
| `subtasks` | `db.tasks.list()` full reload | ⚠️ Costoso |
| `entries` | `applyDelta` granular | ✅ Correcto (con bug duplicados) |

### Caveat: sin filtro de usuario en los listeners

El canal se llama `user-${userId}` pero los listeners no tienen `.filter('user_id=eq.${userId}')`. La seguridad depende **100% de que RLS esté correctamente configurado** en Supabase.

---

## 5. Diagnóstico Final

### Tabla de problemas encontrados

| Severidad | Problema | Impacto |
|-----------|---------|---------|
| 🔴 Crítico | Bug duplicados: INSERT manual + INSERT realtime duplica `clients`/`projects`/`entries` | Datos incorrectos en pantalla |
| 🔴 Crítico | No hay optimistic updates — UI congela en cada acción de drag/resize/toggle | UX degradada perceptiblemente |
| 🟠 Alto | `entries.list()` sin filtro de fechas — crece indefinidamente | Carga inicial más lenta con el tiempo |
| 🟠 Alto | Cambios en tasks/subtasks hacen full reload `db.tasks.list()` | N+1 de red innecesario |
| 🟡 Medio | Sin `.filter()` de `user_id` en canales realtime | Depende de RLS para seguridad |
| 🟡 Medio | Región desconocida — puede añadir 200ms+ de latencia base | Amplifica todos los problemas anteriores |

---

## Las 3 Mejoras más Impactantes

### #1 — FÁCIL (30 min): Corregir el bug de duplicados

Eliminar las actualizaciones manuales de estado en las mutaciones de INSERT. Dejar que el canal realtime sea la única fuente de verdad:

```js
// AppContext.jsx — ANTES
const addEntry = async (data) => {
  const e = await db.entries.create({ ...data, userId })
  setEntries(p => [...p, e])  // ← QUITAR: el realtime ya lo añade
  return e
}

const addClient = async (name, color = '#3B82F6') => {
  const c = await db.clients.create({ name, color, userId })
  setClients(p => [...p, c])  // ← QUITAR: el realtime ya lo añade
  return c
}

// DESPUÉS — el canal realtime se encarga del INSERT
const addEntry = async (data) => {
  const e = await db.entries.create({ ...data, userId })
  return e
}

const addClient = async (name, color = '#3B82F6') => {
  const c = await db.clients.create({ name, color, userId })
  return c
}
```

> Aplica igual a `addProject`. Para `update` y `delete` mantener el patrón actual ya que necesitan la respuesta confirmada del servidor.

---

### #2 — MEDIA (2h): Optimistic updates en `updateEntry`

Es la acción **más frecuente y perceptible** de la app. El usuario arrastra un bloque en el calendario y siente todo el lag de la red. Con optimistic update la respuesta es instantánea:

```js
// AppContext.jsx
const updateEntry = async (id, updates) => {
  // 1. Guardar estado anterior para rollback
  const previousEntries = entries

  // 2. Actualizar UI INMEDIATAMENTE (antes de tocar la red)
  setEntries(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x))

  try {
    // 3. Persistir en background
    const confirmed = await db.entries.update(id, updates)
    // 4. Sincronizar con datos canónicos del servidor (timestamps, etc.)
    setEntries(prev => prev.map(x => x.id === id ? confirmed : x))
  } catch (err) {
    // 5. Rollback si falla
    console.error('Error actualizando entry, revirtiendo:', err)
    setEntries(previousEntries)
    // TODO: mostrar toast de error al usuario
  }
}
```

El mismo patrón puede aplicarse a `toggleSubtask`:

```js
const toggleSubtask = async (taskId, subtaskId) => {
  const task = tasks.find(t => t.id === taskId)
  if (!task) return
  const subtask = (task.subtasks || []).find(st => st.id === subtaskId)
  if (!subtask) return

  const newDone = !subtask.done
  const previousTasks = tasks

  // Optimistic: calcular nuevo estado de tarea
  const newSubtasks = (task.subtasks || []).map(st =>
    st.id === subtaskId ? { ...st, done: newDone } : st
  )
  const allDone = newSubtasks.length > 0 && newSubtasks.every(st => st.done)
  const newStatus = allDone ? 'done' : (task.status === 'done' ? 'pending' : task.status)

  // Actualizar UI inmediatamente
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
```

---

### #3 — MEDIA (1h): Filtrar entries por rango de fechas

Añadir método `listByRange` en la capa de datos y usarlo en la carga inicial:

```js
// db.js — añadir junto a entries.list()
async listByRange(from, to) {
  const data = await query(
    supabase
      .from('entries')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('start_time')
  )
  return data.map(normalizeEntry)
},
```

```js
// AppContext.jsx — loadAll()
import { startOfMonth, endOfMonth, subMonths, addMonths, format } from 'date-fns'

const loadAll = useCallback(async () => {
  if (!userId) return
  setDataLoading(true)
  const today = new Date()
  const from = format(subMonths(startOfMonth(today), 1), 'yyyy-MM-dd')
  const to   = format(addMonths(endOfMonth(today), 1), 'yyyy-MM-dd')
  try {
    const [c, p, t, e] = await Promise.all([
      db.clients.list(),
      db.projects.list(),
      db.tasks.list(),
      db.entries.listByRange(from, to),  // ← solo ±1 mes
    ])
    setClients(c); setProjects(p); setTasks(t); setEntries(e)
  } catch (err) {
    console.error('Error cargando datos:', err)
  } finally {
    setDataLoading(false)
  }
}, [userId])
```

---

## Prioridad de Implementación

```
1. Bug duplicados    → ~30 min  → elimina datos incorrectos en producción YA
2. Filtro de fechas  → ~1h      → protege el crecimiento del payload a largo plazo
3. Optimistic drag   → ~2h      → mejora UX notablemente en la acción más usada
```
