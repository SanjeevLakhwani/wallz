import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { daysUntilExpiry } from '@/lib/marker';

type SavedMarker = {
  discovered_at: string;
  markers: {
    id: string;
    area_name: string;
    status: string;
    expires_at: string | null;
    like_count?: number;
  };
};

export default function SavedScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [saved, setSaved] = useState<SavedMarker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('discoveries')
      .select('discovered_at, markers(id, area_name, status, expires_at)')
      .eq('user_id', user.id)
      .order('discovered_at', { ascending: false })
      .then(({ data }) => {
        setSaved((data as SavedMarker[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  const isExpired = (m: SavedMarker['markers']) =>
    m.status === 'expired' || (m.expires_at ? new Date(m.expires_at) < new Date() : false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Collection</Text>
      {loading ? (
        <Text style={styles.empty}>Loading...</Text>
      ) : saved.length === 0 ? (
        <Text style={styles.empty}>No tags found yet. Get out there!</Text>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item, i) => i.toString()}
          renderItem={({ item }) => {
            const expired = isExpired(item.markers);
            return (
              <TouchableOpacity
                style={[styles.row, expired && styles.rowExpired]}
                onPress={() => router.push(`/marker/${item.markers.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.area, expired && styles.textDim]}>
                    {item.markers.area_name}
                  </Text>
                  <Text style={styles.meta}>
                    Found {new Date(item.discovered_at).toLocaleDateString()}
                    {!expired && item.markers.expires_at
                      ? `  ·  ${daysUntilExpiry(item.markers.expires_at)}d left`
                      : expired ? '  ·  Expired' : ''}
                  </Text>
                </View>
                {expired && <Text style={styles.expiredBadge}>EXPIRED</Text>}
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 60 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', padding: 20, paddingBottom: 12 },
  empty: { color: '#555', textAlign: 'center', marginTop: 60 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  rowExpired: { opacity: 0.5 },
  area: { color: '#fff', fontSize: 15, fontWeight: '600' },
  textDim: { color: '#888' },
  meta: { color: '#555', fontSize: 12, marginTop: 4 },
  expiredBadge: {
    color: '#555',
    fontSize: 10,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  arrow: { color: '#555', fontSize: 20 },
});
