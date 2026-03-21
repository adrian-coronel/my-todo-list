import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export function usePlan() {
  const { user } = useAuth()
  const [plan, setPlan] = useState('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }

    // Fetch inicial
    supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setPlan(data?.plan ?? 'free')
        setLoading(false)
      })

    // Realtime: si el plan cambia (ej. upgrade desde Supabase dashboard)
    const channel = supabase
      .channel('plan-changes')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => { setPlan(payload.new.plan ?? 'free') }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  return {
    plan,
    isFree: plan === 'free',
    isPro: plan === 'pro',
    isLifetime: plan === 'lifetime',
    loading,
  }
}
