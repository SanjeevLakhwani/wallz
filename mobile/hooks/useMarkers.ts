import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { geohashCenter } from '@/lib/geohash';
import { useMarkerStore, GeohashCell } from '@/stores/markerStore';

export type SortOption = 'recent' | 'likes' | 'views' | 'expiring';

export function useMapCells() {
  const setCells = useMarkerStore((s) => s.setCells);

  const fetchCells = async (sort: SortOption = 'recent') => {
    const { data, error } = await supabase
      .from('markers')
      .select('geohash')
      .eq('status', 'approved');

    if (error || !data) return;

    // Group by geohash client-side (simple for hackathon scale)
    const counts = data.reduce<Record<string, number>>((acc, row) => {
      acc[row.geohash] = (acc[row.geohash] ?? 0) + 1;
      return acc;
    }, {});

    const cells: GeohashCell[] = Object.entries(counts).map(([geohash, count]) => {
      const { lat, lng } = geohashCenter(geohash);
      return { geohash, count, lat, lng };
    });

    setCells(cells);
  };

  useEffect(() => {
    fetchCells();
  }, []);

  return { fetchCells };
}

export async function getMarkersInCell(geohash: string, sort: SortOption = 'recent') {
  let query = supabase
    .from('markers')
    .select(`
      *,
      marker_stats (like_count, discovery_count, comment_count)
    `)
    .eq('status', 'approved')
    .eq('geohash', geohash);

  if (sort === 'recent') query = query.order('approved_at', { ascending: false });
  if (sort === 'expiring') query = query.order('expires_at', { ascending: true });

  const { data } = await query;
  return data ?? [];
}
