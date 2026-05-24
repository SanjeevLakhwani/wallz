import { useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useMapCells, getMarkersInCell, SortOption } from '@/hooks/useMarkers';
import { useMarkerStore, Marker } from '@/stores/markerStore';
import { useAuthStore } from '@/stores/authStore';
import { daysUntilExpiry } from '@/lib/marker';

function zoomToPrecision(zoom: number): number {
  if (zoom < 4) return 2;
  if (zoom < 6) return 3;
  if (zoom < 9) return 4;
  return 5;
}

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Recent', value: 'recent' },
  { label: 'Likes', value: 'likes' },
  { label: 'Expiring', value: 'expiring' },
];

export default function MapScreen() {
  const router = useRouter();
  const { fetchCells, loading, error } = useMapCells();
  const cells = useMarkerStore((s) => s.cells);
  const user = useAuthStore((s) => s.user);
  const [sort, setSort] = useState<SortOption>('recent');
  const [cellMarkers, setCellMarkers] = useState<Marker[]>([]);
  const [selectedGeohash, setSelectedGeohash] = useState<string | null>(null);
  const [zoom, setZoom] = useState(2);
  const sheetRef = useRef<BottomSheet>(null);

  const displayCells = useMemo(() => {
    const precision = zoomToPrecision(zoom);
    if (precision >= 5) return cells;
    const agg = new Map<string, { count: number; discoveredCount: number; latSum: number; lngSum: number }>();
    for (const cell of cells) {
      const prefix = cell.geohash.slice(0, precision);
      const existing = agg.get(prefix);
      if (existing) {
        existing.count += cell.count;
        existing.discoveredCount += cell.discoveredCount;
        existing.latSum += cell.lat * cell.count;
        existing.lngSum += cell.lng * cell.count;
      } else {
        agg.set(prefix, { count: cell.count, discoveredCount: cell.discoveredCount, latSum: cell.lat * cell.count, lngSum: cell.lng * cell.count });
      }
    }
    return Array.from(agg.entries()).map(([geohash, { count, discoveredCount, latSum, lngSum }]) => ({
      geohash, count, discoveredCount, lat: latSum / count, lng: lngSum / count,
    }));
  }, [cells, zoom]);

  const onCellPress = useCallback(async (geohash: string) => {
    setSelectedGeohash(geohash);
    const markers = await getMarkersInCell(geohash, sort, user?.id);
    setCellMarkers(markers as Marker[]);
    sheetRef.current?.snapToIndex(1);
  }, [sort, user?.id]);

  const onSortChange = (s: SortOption) => {
    setSort(s);
    fetchCells(s);
    if (selectedGeohash) onCellPress(selectedGeohash);
  };

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Dark}
        onMapIdle={(state: any) => {
          const z = state.properties?.zoom ?? state.properties?.zoomLevel;
          if (z != null) setZoom(z);
        }}
        onRegionIsChanging={(feature: any) => {
          const z = feature.properties?.zoomLevel;
          if (z != null) setZoom(z);
        }}
      >
        <MapboxGL.Camera
          defaultSettings={{ centerCoordinate: [0, 20], zoomLevel: 2 }}
        />
        {displayCells.map((cell) => (
          <MapboxGL.MarkerView
            key={cell.geohash}
            coordinate={[cell.lng, cell.lat]}
          >
            <TouchableOpacity
              style={[styles.bubble, cell.discoveredCount > 0 && styles.bubbleDiscovered]}
              onPress={() => onCellPress(cell.geohash)}
            >
              <Text style={[styles.bubbleText, cell.discoveredCount > 0 && styles.bubbleTextDiscovered]}>
                {cell.count}
              </Text>
              {cell.discoveredCount > 0 && (
                <Text style={styles.bubbleCheck}>✓{cell.discoveredCount}</Text>
              )}
            </TouchableOpacity>
          </MapboxGL.MarkerView>
        ))}
      </MapboxGL.MapView>

      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}

      {!loading && error && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Failed to load map</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchCells(sort)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && cells.length === 0 && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayText}>No tags out there yet</Text>
          <Text style={styles.overlaySubtext}>Be the first to place one</Text>
        </View>
      )}

      {/* Sort bar */}
      <View style={styles.sortBar}>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.sortBtn, sort === opt.value && styles.sortBtnActive]}
            onPress={() => onSortChange(opt.value)}
          >
            <Text style={[styles.sortText, sort === opt.value && styles.sortTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={['35%', '70%']}
        enablePanDownToClose
        backgroundStyle={styles.sheet}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetFlatList
          data={cellMarkers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.sheetContent}
          ListHeaderComponent={
            <Text style={styles.sheetHeader}>
              {cellMarkers.length} tag{cellMarkers.length !== 1 ? 's' : ''} in this area
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.markerRow}
              onPress={() => router.push(`/marker/${item.id}`)}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.markerRowTop}>
                  <Text style={styles.markerArea}>{item.area_name}</Text>
                  {(item as any).is_discovered && (
                    <View style={styles.foundBadge}>
                      <Text style={styles.foundBadgeText}>✓ Found</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.markerMeta}>
                  {item.expires_at ? `${daysUntilExpiry(item.expires_at)}d left` : 'No expiry'}
                  {'  ·  '}
                  {item.like_count ?? 0} likes
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#555" />
            </TouchableOpacity>
          )}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  map: { flex: 1 },
  bubble: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 36,
  },
  bubbleDiscovered: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1.5,
    borderColor: '#4ade80',
  },
  bubbleText: { color: '#000', fontWeight: '700', fontSize: 13 },
  bubbleTextDiscovered: { color: '#fff' },
  bubbleCheck: { color: '#4ade80', fontSize: 9, fontWeight: '700', marginTop: 1 },
  sortBar: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  sortBtn: {
    backgroundColor: '#1a1a1aCC',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sortBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  sortText: { color: '#888', fontSize: 13, fontWeight: '600' },
  sortTextActive: { color: '#000' },
  sheet: { backgroundColor: '#111' },
  sheetHandle: { backgroundColor: '#333' },
  sheetContent: { padding: 16 },
  sheetHeader: { color: '#888', fontSize: 13, marginBottom: 12 },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  markerRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  markerArea: { color: '#fff', fontSize: 15, fontWeight: '600' },
  foundBadge: {
    backgroundColor: '#14532d',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  foundBadgeText: { color: '#4ade80', fontSize: 10, fontWeight: '700' },
  markerMeta: { color: '#666', fontSize: 12, marginTop: 4 },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlayText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  overlaySubtext: { color: '#888', fontSize: 13, marginTop: 6 },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#000', fontWeight: '700' },
});
