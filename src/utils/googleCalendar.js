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
    const err = new Error(`Google Calendar API error: ${res.status}`)
    err.status = res.status
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
 * Refresca el provider_token de Google via supabase.auth.refreshSession().
 * Actualiza el token en user_integrations y retorna el nuevo access token.
 * Si no hay token fresco disponible, retorna null (el llamador debe pedir reconexión).
 *
 * Nota: en producción se recomienda un Edge Function para usar el
 * refresh_token directamente contra la API de Google (requiere client_secret).
 */
export async function refreshGoogleToken(userId) {
  try {
    const { data } = await supabase.auth.refreshSession()
    const newToken = data?.session?.provider_token
    if (!newToken) return null

    await supabase
      .from('user_integrations')
      .update({
        access_token:     newToken,
        token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'google')

    return newToken
  } catch (err) {
    console.error('[GCal] refreshGoogleToken:', err)
    return null
  }
}
