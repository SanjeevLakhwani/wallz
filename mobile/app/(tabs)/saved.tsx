import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { daysUntilExpiry, markerDeepLink } from '@/lib/marker';

type SavedMarker = {
  discovered_at: string;
  markers: {
    id: string;
    area_name: string;
    status: string;
    expires_at: string | null;
  };
};

type MyTag = {
  id: string;
  area_name: string;
  marker_code: string;
  status: string;
  expires_at: string | null;
  created_at: string;
};

type Tab = 'collection' | 'mytags';

export default function SavedScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('collection');
  const [saved, setSaved] = useState<SavedMarker[]>([]);
  const [myTags, setMyTags] = useState<MyTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrTag, setQrTag] = useState<MyTag | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      supabase
        .from('discoveries')
        .select('discovered_at, markers(id, area_name, status, expires_at)')
        .eq('user_id', user.id)
        .order('discovered_at', { ascending: false }),
      supabase
        .from('markers')
        .select('id, area_name, marker_code, status, expires_at, created_at')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false }),
    ]).then(([discRes, tagsRes]) => {
      setSaved((discRes.data as SavedMarker[]) ?? []);
      setMyTags((tagsRes.data as MyTag[]) ?? []);
      setLoading(false);
    });
  }, [user]);

  const isExpired = (tag: { status: string; expires_at: string | null }) =>
    tag.status === 'expired' || (tag.expires_at ? new Date(tag.expires_at) < new Date() : false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Collection</Text>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'collection' && styles.tabActive]}
          onPress={() => setTab('collection')}
        >
          <Text style={[styles.tabText, tab === 'collection' && styles.tabTextActive]}>
            Discovered ({saved.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'mytags' && styles.tabActive]}
          onPress={() => setTab('mytags')}
        >
          <Text style={[styles.tabText, tab === 'mytags' && styles.tabTextActive]}>
            My Tags ({myTags.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.empty}>Loading...</Text>
      ) : tab === 'collection' ? (
        saved.length === 0 ? (
          <Text style={styles.empty}>No tags found yet. Get out there!</Text>
        ) : (
          <FlatList
            data={saved}
            keyExtractor={(_, i) => i.toString()}
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
                  <Ionicons name="chevron-forward" size={18} color="#555" />
                </TouchableOpacity>
              );
            }}
          />
        )
      ) : myTags.length === 0 ? (
        <Text style={styles.empty}>You haven't submitted any tags yet.</Text>
      ) : (
        <FlatList
          data={myTags}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const expired = isExpired(item);
            return (
              <TouchableOpacity
                style={[styles.row, expired && styles.rowExpired]}
                onPress={() => router.push(`/my-tag/${item.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.area, expired && styles.textDim]}>
                    {item.area_name}
                  </Text>
                  <Text style={styles.meta}>
                    {item.status === 'pending' ? 'Pending approval' :
                      expired ? 'Expired' :
                      item.expires_at ? `${daysUntilExpiry(item.expires_at)}d left` : ''}
                  </Text>
                </View>
                {expired && <Text style={styles.expiredBadge}>EXPIRED</Text>}
                <TouchableOpacity style={styles.qrBtn} onPress={(e) => { e.stopPropagation(); setQrTag(item); }}>
                  <Ionicons name="qr-code-outline" size={16} color="#fff" />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={18} color="#555" />
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* QR Code modal */}
      <Modal visible={!!qrTag} transparent animationType="fade" onRequestClose={() => setQrTag(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{qrTag?.area_name}</Text>
            {qrTag && (
              <View style={styles.qrWrap}>
                <QRCode
                  value={markerDeepLink(qrTag.marker_code)}
                  size={220}
                  color="#fff"
                  backgroundColor="#0a0a0a"
                />
                <Text style={styles.wallzLabel}>WALLZ</Text>
              </View>
            )}
            <Text style={styles.modalHint}>Print and place this where your artwork is</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setQrTag(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 60 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', padding: 20, paddingBottom: 12 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  tabActive: { backgroundColor: '#fff', borderColor: '#fff' },
  tabText: { color: '#666', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#000' },
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
  qrBtn: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 16,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  qrWrap: {
    backgroundColor: '#0a0a0a',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 12,
  },
  wallzLabel: { color: '#fff', fontWeight: '900', letterSpacing: 6, fontSize: 13 },
  modalHint: { color: '#555', fontSize: 12, textAlign: 'center' },
  closeBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeBtnText: { color: '#000', fontWeight: '700' },
});
