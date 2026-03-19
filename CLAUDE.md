# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Architecture

**Stack:** React 19 + Vite 8, no TypeScript, no router, no Redux.

**App purpose:** Calendar-based time-tracking app. Users log time entries against a Client → Project → Task hierarchy, visualized in week/day/month calendar views.

### State Management

Two React Context providers in `src/context/`:

- **AppContext** (`AppContext.jsx`) — single source of truth for everything: `theme`, `clients`, `projects`, `tasks` (with nested `subtasks`), `entries` (time logs), and `isMobileSidebarOpen`. All state is **persisted to `localStorage`** via `useEffect`. No backend.
- **ActivityContext** (`ActivityContext.jsx`) — parallel structure, currently unused in the UI.

### Data Model

```
Client { id, name, color }
  └─ Project { id, clientId, name, color }
       └─ Task { id, clientId, projectId, title, description, status, color, subtasks[], createdAt }
            └─ Entry { id, taskId, clientId, projectId, date, startTime, endTime, notes, subtaskId?, createdAt }
```

### Component Layout

```
App (wrapped in AppProvider)
├── AppHeader        — theme toggle + SettingsPanel (client/project CRUD)
├── Sidebar          — task list with CRUD, drag-to-calendar support
└── WeeklyCalendar   — main canvas (week/day/month views)
    ├── EventBlock       — draggable & resizable time entry
    ├── EntryModal       — create/edit time entry
    ├── DailySummaryModal
    └── ContextMenu      — right-click on events
```

`WeeklyCalendar.jsx` (~28 KB) and `Sidebar.jsx` (~22 KB) are the largest files and contain most of the UI logic.

### Styling

`src/index.css` defines all CSS custom properties (design tokens) for dark/light themes, switched via `data-theme` attribute on `<html>`. Notion-inspired palette. No CSS modules or Tailwind — plain CSS classes defined globally.

### Key Patterns

- **Drag-and-drop:** Tasks dragged from sidebar onto the calendar grid auto-create a new `Entry` via HTML5 drag events.
- **Inline resize:** `EventBlock` handles mouse events directly for drag-move and bottom-edge resize of entries.
- **No routing:** View switching (week/day/month) is local state inside `WeeklyCalendar`.
- **Date handling:** `date-fns` with Spanish locale (`es`) throughout.
