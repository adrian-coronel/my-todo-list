/**
 * googleCalendar.js — Utilidades para Google Calendar API v3.
 * Los errores nunca rompen la app: las funciones públicas capturan silenciosamente.
 */
import { supabase } from '../lib/supabase'

const BASE = 'https://www.googleapis.com/calendar/v3'

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function entryToGoogleEvent(entry) {
  return {
    summary: entry.title || entry.notes || 'Bloque de tiempo',
    start:   { dateTime: `${entry.date}T${entry.startTime}:00` },
    end:     { dateTime: `${entry.date}T${entry.endTime}:00` },
  }
}

async function apiFetch(url, options) {
  const res = await fetch(url, options)
  if (res.status === 204) return null
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    console.error('[GCal] API error body:', JSON.stringify(body, null, 2))
    const err = new Error(`Google Calendar API error: ${res.status}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Obtiene eventos del calendario en el rango indicado.
 * Excluye eventos recurrentes individuales y eventos de todo el día.
 */
export async function fetchGoogleEvents(accessToken, dateFrom, dateTo) {
  try {
    const params = new URLSearchParams({
      timeMin:      `${dateFrom}T00:00:00Z`,
      timeMax:      `${dateTo}T23:59:59Z`,
      singleEvents: 'true',
      orderBy:      'startTime',
      maxResults:   '250',
    })
    const data = await apiFetch(
      `${BASE}/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    return (data?.items || []).filter(e => e.start?.dateTime)
  } catch (err) {
    console.error('[GCal] fetchGoogleEvents:', err)
    throw err // re-throw para que el hook decida si refrescar token
  }
}

/**
 * Crea un evento en Google Calendar y retorna su ID.
 */
export async function createGoogleEvent(accessToken, entry) {
  try {
    const data = await apiFetch(
      `${BASE}/calendars/primary/events`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(entryToGoogleEvent(entry)),
      }
    )
    return data?.id || null
  } catch (err) {
    console.error('[GCal] createGoogleEvent:', err)
    throw err
  }
}

/**
 * Actualiza un evento existente en Google Calendar.
 */
export async function updateGoogleEvent(accessToken, googleEventId, entry) {
  try {
    await apiFetch(
      `${BASE}/calendars/primary/events/${googleEventId}`,
      {
        method:  'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(entryToGoogleEvent(entry)),
      }
    )
  } catch (err) {
    console.error('[GCal] updateGoogleEvent:', err)
    throw err
  }
}

/**
 * Elimina un evento de Google Calendar.
 */
export async function deleteGoogleEvent(accessToken, googleEventId) {
  try {
    await apiFetch(
      `${BASE}/calendars/primary/events/${googleEventId}`,
      {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
  } catch (err) {
    console.error('[GCal] deleteGoogleEvent:', err)
    throw err
  }
}

/**
 * Refresca el access token de Google via Edge Function.
 * La Edge Function usa el refresh_token + client_secret (server-side)
 * para obtener un nuevo token sin exponer credenciales en el frontend.
 */
export async function refreshGoogleToken(_userId) {
  try {
    const { data, error } = await supabase.functions.invoke('refresh-google-token')
    if (error) {
      console.error('[GCal] refreshGoogleToken edge error:', error)
      return null
    }
    return data?.access_token || null
  } catch (err) {
    console.error('[GCal] refreshGoogleToken:', err)
    return null
  }
}
