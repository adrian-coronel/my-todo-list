/**
 * useGoogleCalendar — gestiona la integración bidireccional con Google Calendar.
 *
 * Estado persistido en la tabla `user_integrations` de Supabase.
 * Este hook es consumido por AppContext (CRUD sync) y por WeeklyCalendar (render).
 */
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchGoogleEvents, refreshGoogleToken } from '../utils/googleCalendar'

export function useGoogleCalendar() {
  const { user } = useAuth()
  const userId = user?.id

  const [integration, setIntegration] = useState(null)
  const [googleEvents, setGoogleEvents] = useState([])
  const [integrationLoading, setIntegrationLoading] = useState(true)

  // ── Carga inicial de user_integrations ─────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setIntegration(null)
      setIntegrationLoading(false)
      return
    }
    supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle()
      .then(({ data }) => {
        setIntegration(data)
        setIntegrationLoading(false)
      })
  }, [userId])

  // ── Detectar callback OAuth con scope de Calendar ──────────────────────────
  // IMPORTANTE: no hacer llamadas a supabase DB dentro del callback de
  // onAuthStateChange directamente — causa deadlock con el lock interno de auth.
  // Se usa setTimeout(0) para escapar del lock antes de consultar la DB.
  useEffect(() => {
    if (!userId) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') &&
          session?.provider_refresh_token
        ) {
          const tokenData = {
            user_id:          session.user.id,
            provider:         'google',
            access_token:     session.provider_token,
            refresh_token:    session.provider_refresh_token,
            token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          }
          // Escapar del lock de auth antes de hacer queries a la DB
          setTimeout(() => saveIntegration(tokenData), 0)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [userId])

  // Persiste los tokens de Google en user_integrations (upsert)
  const saveIntegration = useCallback(async (tokenData) => {
    const { data, error } = await supabase
      .from('user_integrations')
      .upsert(tokenData, { onConflict: 'user_id,provider' })
      .select()
      .single()
    if (error) {
      console.error('[GCal] Error al guardar integración:', error)
    } else {
      setIntegration(data)
    }
  }, [])

  // ── Derivados ──────────────────────────────────────────────────────────────
  const isConnected      = !!integration
  const syncToGoogle     = integration?.sync_to_google     ?? true
  const showGoogleEvents = integration?.show_google_events ?? true

  // ── Obtener access token fresco ────────────────────────────────────────────
  // Siempre usa el token guardado en user_integrations — es el único que
  // garantiza tener el scope de calendar.events (fue guardado durante el
  // OAuth de Calendar, no el login inicial de Google).
  const getAccessToken = useCallback(() => {
    return integration?.access_token || null
  }, [integration])

  // ── Conectar: solicita scope de Calendar (incremental auth) ────────────────
  const connect = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes:      'https://www.googleapis.com/auth/calendar.events',
        queryParams: { access_type: 'offline', prompt: 'consent' },
        redirectTo:  window.location.origin,
      },
    })
  }, [])

  // ── Desconectar ────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    if (!userId) return
    await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'google')
    setIntegration(null)
    setGoogleEvents([])
  }, [userId])

  // ── Toggles ────────────────────────────────────────────────────────────────
  const toggleSyncToGoogle = useCallback(async () => {
    if (!integration) return
    const newVal = !integration.sync_to_google
    const { data } = await supabase
      .from('user_integrations')
      .update({ sync_to_google: newVal })
      .eq('user_id', userId)
      .eq('provider', 'google')
      .select()
      .single()
    setIntegration(data)
  }, [integration, userId])

  const toggleShowGoogleEvents = useCallback(async () => {
    if (!integration) return
    const newVal = !integration.show_google_events
    const { data } = await supabase
      .from('user_integrations')
      .update({ show_google_events: newVal })
      .eq('user_id', userId)
      .eq('provider', 'google')
      .select()
      .single()
    setIntegration(data)
    if (!newVal) setGoogleEvents([])
  }, [integration, userId])

  // ── Cargar eventos de Google en un rango ──────────────────────────────────
  const loadGoogleEvents = useCallback(async (dateFrom, dateTo) => {
    if (!isConnected || !showGoogleEvents) return
    try {
      const token = await getAccessToken()
      if (!token) return
      const events = await fetchGoogleEvents(token, dateFrom, dateTo)
      setGoogleEvents(events)
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        // Token expirado o con scopes insuficientes: refrescar via Edge Function
        const newToken = await refreshGoogleToken(userId)
        if (!newToken) return
        try {
          const events = await fetchGoogleEvents(newToken, dateFrom, dateTo)
          setGoogleEvents(events)
        } catch {
          // Silencioso: Google falla pero la app no se rompe
        }
      }
    }
  }, [isConnected, showGoogleEvents, getAccessToken, userId])

  return {
    isConnected,
    syncToGoogle,
    showGoogleEvents,
    googleEvents,
    integrationLoading,
    connect,
    disconnect,
    toggleSyncToGoogle,
    toggleShowGoogleEvents,
    loadGoogleEvents,
    getAccessToken,
  }
}
