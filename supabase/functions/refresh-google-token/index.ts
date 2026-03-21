import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar que el request viene de un usuario autenticado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verificar el JWT del usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Leer el refresh_token guardado en la DB
    const { data: integration, error: dbError } = await supabase
      .from('user_integrations')
      .select('refresh_token, token_expires_at, access_token')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single()

    if (dbError || !integration?.refresh_token) {
      return new Response(JSON.stringify({ error: 'No Google integration found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Si el token todavía es válido (con 5 min de margen), devolverlo directamente
    const expiresAt = new Date(integration.token_expires_at).getTime()
    const now = Date.now()
    if (expiresAt - now > 5 * 60 * 1000) {
      return new Response(
        JSON.stringify({ access_token: integration.access_token, refreshed: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Token expirado: renovar con Google
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        refresh_token: integration.refresh_token,
        grant_type:    'refresh_token',
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Google token refresh failed:', tokenData)
      return new Response(JSON.stringify({ error: 'Token refresh failed', detail: tokenData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newExpiresAt = new Date(now + (tokenData.expires_in ?? 3600) * 1000).toISOString()

    // Guardar nuevo access_token en la DB
    await supabase
      .from('user_integrations')
      .update({
        access_token:     tokenData.access_token,
        token_expires_at: newExpiresAt,
      })
      .eq('user_id', user.id)
      .eq('provider', 'google')

    return new Response(
      JSON.stringify({ access_token: tokenData.access_token, refreshed: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
