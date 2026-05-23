import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { geohashCenter } from '@/lib/geohash';
import { useMarkerStore, GeohashCell } from '@/stores/markerStore';

export type SortOption = 'recent' | 'likes' | 'views' | 'expiring';

export function useMapCells() {
  const setCells = useMarkerStore((s) => s.setCells);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCells = async (_sort: SortOption = 'recent') => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('markers')
      .select('geohash')
      .eq('status', 'approved');

    setLoading(false);

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    if (!data) return;

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

  return { fetchCells, loading, error };
}

export async function getMarkersInCell(geohash: string, sort: SortOption = 'recent') {
  let query = supabase
    .from('markers')
    .select('*')
    .eq('status', 'approved')
    .eq('geohash', geohash);

  if (sort === 'recent') query = query.order('approved_at', { ascending: false });
  if (sort === 'expiring') query = query.order('expires_at', { ascending: true });

  const { data, error } = await query;
  if (error) console.error('getMarkersInCell error:', error.message);
  return data ?? [];
}
