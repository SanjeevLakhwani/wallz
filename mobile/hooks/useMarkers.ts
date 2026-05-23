import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { geohashCenter } from '@/lib/geohash';
import { useMarkerStore, GeohashCell } from '@/stores/markerStore';
import { useAuthStore } from '@/stores/authStore';

export type SortOption = 'recent' | 'likes' | 'views' | 'expiring';

export function useMapCells() {
  const setCells = useMarkerStore((s) => s.setCells);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);

  const fetchCells = async (_sort: SortOption = 'recent') => {
    setLoading(true);
    setError(null);

    const [markersRes, discoveriesRes] = await Promise.all([
      supabase.from('markers').select('id, geohash').eq('status', 'approved'),
      user
        ? supabase.from('discoveries').select('marker_id').eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ]);

    setLoading(false);

    if (markersRes.error) {
      setError(markersRes.error.message);
      return;
    }

    if (!markersRes.data) return;

    const discoveredIds = new Set((discoveriesRes.data ?? []).map((d: any) => d.marker_id));

    const totals: Record<string, number> = {};
    const discovered: Record<string, number> = {};

    for (const row of markersRes.data) {
      totals[row.geohash] = (totals[row.geohash] ?? 0) + 1;
      if (discoveredIds.has(row.id)) {
        discovered[row.geohash] = (discovered[row.geohash] ?? 0) + 1;
      }
    }

    const cells: GeohashCell[] = Object.entries(totals).map(([geohash, count]) => {
      const { lat, lng } = geohashCenter(geohash);
      return { geohash, count, discoveredCount: discovered[geohash] ?? 0, lat, lng };
    });

    setCells(cells);
  };

  useEffect(() => {
    fetchCells();
  }, []);

  return { fetchCells, loading, error };
}

export async function getMarkersInCell(geohash: string, sort: SortOption = 'recent', userId?: string) {
  let query = supabase
    .from('markers')
    .select('*')
    .eq('status', 'approved');

  // When geohash is a cluster prefix (< precision 5), match all cells within it
  if (geohash.length < 5) {
    query = query.like('geohash', `${geohash}%`);
  } else {
    query = query.eq('geohash', geohash);
  }

  if (sort === 'recent') query = query.order('approved_at', { ascending: false });
  if (sort === 'expiring') query = query.order('expires_at', { ascending: true });

  const { data, error } = await query;
  if (error) console.error('getMarkersInCell error:', error.message);
  if (!data || data.length === 0) return [];

  const ids = data.map((m) => m.id);
  const [likesRes, discoveriesRes] = await Promise.all([
    supabase.from('likes').select('marker_id').in('marker_id', ids),
    userId
      ? supabase.from('discoveries').select('marker_id').eq('user_id', userId).in('marker_id', ids)
      : Promise.resolve({ data: [] }),
  ]);

  const likeCounts = (likesRes.data ?? []).reduce<Record<string, number>>((acc, l) => {
    acc[l.marker_id] = (acc[l.marker_id] ?? 0) + 1;
    return acc;
  }, {});

  const discoveredIds = new Set((discoveriesRes.data ?? []).map((d: any) => d.marker_id));

  return data.map((m) => ({
    ...m,
    like_count: likeCounts[m.id] ?? 0,
    is_discovered: discoveredIds.has(m.id),
  }));
}
