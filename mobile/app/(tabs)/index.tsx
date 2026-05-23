import { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useMapCells, getMarkersInCell, SortOption } from '@/hooks/useMarkers';
import { useMarkerStore, Marker } from '@/stores/markerStore';
import { daysUntilExpiry } from '@/lib/marker';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Recent', value: 'recent' },
  { label: 'Likes', value: 'likes' },
  { label: 'Expiring', value: 'expiring' },
];

export default function MapScreen() {
  const router = useRouter();
  const { fetchCells } = useMapCells();
  const cells = useMarkerStore((s) => s.cells);
  const [sort, setSort] = useState<SortOption>('recent');
  const [cellMarkers, setCellMarkers] = useState<Marker[]>([]);
  const [selectedGeohash, setSelectedGeohash] = useState<string | null>(null);
  const sheetRef = useRef<BottomSheet>(null);

  const onCellPress = useCallback(async (geohash: string) => {
    setSelectedGeohash(geohash);
    const markers = await getMarkersInCell(geohash, sort);
    setCellMarkers(markers as Marker[]);
    sheetRef.current?.snapToIndex(1);
  }, [sort]);

  const onSortChange = (s: SortOption) => {
    setSort(s);
    fetchCells(s);
    if (selectedGeohash) onCellPress(selectedGeohash);
  };

  return (
    <View style={styles.container}>
      <MapboxGL.MapView style={styles.map} styleURL={MapboxGL.StyleURL.Dark}>
        <MapboxGL.Camera
          defaultSettings={{ centerCoordinate: [0, 20], zoomLevel: 2 }}
        />
        {cells.map((cell) => (
          <MapboxGL.MarkerView
            key={cell.geohash}
            coordinate={[cell.lng, cell.lat]}
          >
            <TouchableOpacity
              style={styles.bubble}
              onPress={() => onCellPress(cell.geohash)}
            >
              <Text style={styles.bubbleText}>{cell.count}</Text>
            </TouchableOpacity>
          </MapboxGL.MarkerView>
        ))}
      </MapboxGL.MapView>

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
                <Text style={styles.markerArea}>{item.area_name}</Text>
                <Text style={styles.markerMeta}>
                  {item.expires_at ? `${daysUntilExpiry(item.expires_at)}d left` : 'No expiry'}
                  {'  ·  '}
                  {item.like_count ?? 0} likes
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
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
  bubbleText: { color: '#000', fontWeight: '700', fontSize: 13 },
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
  markerArea: { color: '#fff', fontSize: 15, fontWeight: '600' },
  markerMeta: { color: '#666', fontSize: 12, marginTop: 4 },
  arrow: { color: '#555', fontSize: 20 },
});
