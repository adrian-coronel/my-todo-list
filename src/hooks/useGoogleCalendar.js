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
  // provider_refresh_token solo está presente cuando se pidió access_type:'offline'
  // (nuestro flujo de Calendar OAuth), no en el login normal.
  useEffect(() => {
    if (!userId) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') &&
          session?.provider_refresh_token
        ) {
          const tokenData = {
            user_id:          userId,
            provider:         'google',
            access_token:     session.provider_token,
            refresh_token:    session.provider_refresh_token,
            token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          }

          // Verificar si ya existe la fila
          const { data: existing } = await supabase
            .from('user_integrations')
            .select('id, sync_to_google, show_google_events')
            .eq('user_id', userId)
            .eq('provider', 'google')
            .maybeSingle()

          if (!existing) {
            // Primera conexión: insertar con settings por defecto
            const { data } = await supabase
              .from('user_integrations')
              .insert(tokenData)
              .select()
              .single()
            setIntegration(data)
          } else {
            // Ya existe: solo actualizar tokens, preservar settings del usuario
            const { data } = await supabase
              .from('user_integrations')
              .update({
                access_token:     tokenData.access_token,
                refresh_token:    tokenData.refresh_token,
                token_expires_at: tokenData.token_expires_at,
              })
              .eq('user_id', userId)
              .eq('provider', 'google')
              .select()
              .single()
            setIntegration(data)
          }
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [userId])

  // ── Derivados ──────────────────────────────────────────────────────────────
  const isConnected      = !!integration
  const syncToGoogle     = integration?.sync_to_google     ?? true
  const showGoogleEvents = integration?.show_google_events ?? true

  // ── Obtener access token fresco ────────────────────────────────────────────
  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data?.session?.provider_token || null
  }, [])

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
      if (err?.status === 401) {
        // Token expirado: intentar refrescar una vez
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
