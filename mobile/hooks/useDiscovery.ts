import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export type DiscoveryResult =
  | { status: 'success'; markerId: string }
  | { status: 'already_found' }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'error'; message: string };

export function useDiscovery() {
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  const discoverByCode = async (markerCode: string): Promise<DiscoveryResult> => {
    if (!user) return { status: 'error', message: 'Not logged in' };
    setLoading(true);

    try {
      const { data: marker, error } = await supabase
        .from('markers')
        .select('id, status, expires_at')
        .eq('marker_code', markerCode)
        .single();

      if (error || !marker) return { status: 'not_found' };
      if (marker.status !== 'approved') return { status: 'not_found' };
      if (marker.expires_at && new Date(marker.expires_at) < new Date()) {
        return { status: 'expired' };
      }

      const { error: insertError } = await supabase
        .from('discoveries')
        .insert({ user_id: user.id, marker_id: marker.id });

      if (insertError?.code === '23505') return { status: 'already_found' };
      if (insertError) return { status: 'error', message: insertError.message };

      return { status: 'success', markerId: marker.id };
    } finally {
      setLoading(false);
    }
  };

  return { discoverByCode, loading };
}
