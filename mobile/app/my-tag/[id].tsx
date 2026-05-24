import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { markerDeepLink, daysUntilExpiry } from '@/lib/marker';
import { useComments } from '@/hooks/useComments';

type TagDetail = {
  id: string;
  area_name: string;
  marker_code: string;
  status: string;
  expires_at: string | null;
  created_at: string;
};

type Stats = { likes: number; discoveries: number; comments: number };

export default function MyTagScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tag, setTag] = useState<TagDetail | null>(null);
  const [stats, setStats] = useState<Stats>({ likes: 0, discoveries: 0, comments: 0 });
  const [areaName, setAreaName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { comments } = useComments(id);

  useEffect(() => {
    supabase
      .from('markers')
      .select('id, area_name, marker_code, status, expires_at, created_at')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setTag(data as TagDetail);
          setAreaName(data.area_name);
        }
      });

    Promise.all([
      supabase.from('likes').select('*', { count: 'exact', head: true }).eq('marker_id', id),
      supabase.from('discoveries').select('*', { count: 'exact', head: true }).eq('marker_id', id),
      supabase.from('comments').select('*', { count: 'exact', head: true }).eq('marker_id', id),
    ]).then(([l, d, c]) => {
      setStats({ likes: l.count ?? 0, discoveries: d.count ?? 0, comments: c.count ?? 0 });
    });
  }, [id]);

  const saveAreaName = async () => {
    if (!areaName.trim()) return;
    setSaving(true);
    await supabase.from('markers').update({ area_name: areaName.trim() }).eq('id', id);
    setTag((t) => t ? { ...t, area_name: areaName.trim() } : t);
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete tag',
      'This will permanently remove your tag and QR code. Anyone who scans it will get an error. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await supabase.from('markers').delete().eq('id', id);
            if (error) {
              Alert.alert('Error', error.message);
              setDeleting(false);
            } else {
              router.replace('/(tabs)/saved');
            }
          },
        },
      ]
    );
  };

  if (!tag) {
    return <View style={styles.container}><ActivityIndicator color="#fff" style={{ marginTop: 100 }} /></View>;
  }

  const expired = tag.status === 'expired' || (tag.expires_at ? new Date(tag.expires_at) < new Date() : false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color="#888" />
      </TouchableOpacity>

      {/* Area name */}
      <View style={styles.header}>
        {editing ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.editInput}
              value={areaName}
              onChangeText={setAreaName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveAreaName}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveAreaName} disabled={saving}>
              {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(false); setAreaName(tag.area_name); }}>
              <Text style={styles.cancelBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.titleRow}>
            <Text style={styles.title}>{tag.area_name}</Text>
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={20} color="#555" />
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.status}>
          {tag.status === 'pending' ? '⏳ Pending approval' :
            expired ? '🔴 Expired' :
            tag.expires_at ? `🟢 Live · ${daysUntilExpiry(tag.expires_at)} days left` : '🟢 Live'}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.discoveries}</Text>
          <Text style={styles.statLabel}>Discovered</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.likes}</Text>
          <Text style={styles.statLabel}>Likes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.comments}</Text>
          <Text style={styles.statLabel}>Comments</Text>
        </View>
      </View>

      {/* QR code */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>QR Code</Text>
        <View style={styles.qrWrap}>
          <QRCode
            value={markerDeepLink(tag.marker_code)}
            size={200}
            color="#fff"
            backgroundColor="#0a0a0a"
          />
          <Text style={styles.wallzLabel}>CAIRN</Text>
        </View>
        <Text style={styles.hint}>Print this and place it where your artwork is</Text>
      </View>

      {/* Comments */}
      {comments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comments</Text>
          {comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <Text style={styles.commentUser}>@{c.profiles?.username}</Text>
              <Text style={styles.commentBody}>{c.body}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Delete */}
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting}>
        {deleting
          ? <ActivityIndicator color="#ff4444" />
          : (
            <View style={styles.deleteBtnInner}>
              <Ionicons name="trash-outline" size={16} color="#ff4444" />
              <Text style={styles.deleteBtnText}>Delete Tag</Text>
            </View>
          )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  back: { marginBottom: 20 },
  backText: { color: '#888', fontSize: 15 },
  header: { marginBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', flex: 1 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  editInput: {
    flex: 1, backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#2a2a2a', fontSize: 16,
  },
  saveBtn: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  cancelBtn: { padding: 8 },
  cancelBtnText: { color: '#555', fontSize: 16 },
  status: { color: '#888', fontSize: 13 },
  statsRow: {
    flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 20, marginBottom: 28, alignItems: 'center',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  statLabel: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: '#2a2a2a' },
  section: { marginBottom: 28 },
  sectionTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 16 },
  qrWrap: {
    alignSelf: 'center', padding: 24, backgroundColor: '#0a0a0a',
    borderWidth: 2, borderColor: '#2a2a2a', borderRadius: 12, alignItems: 'center', gap: 12,
  },
  wallzLabel: { color: '#fff', fontWeight: '900', letterSpacing: 6, fontSize: 13 },
  hint: { color: '#444', fontSize: 12, textAlign: 'center', marginTop: 12 },
  comment: { marginBottom: 14 },
  commentUser: { color: '#666', fontSize: 12, marginBottom: 3 },
  commentBody: { color: '#ddd', fontSize: 14 },
  deleteBtn: {
    borderWidth: 1, borderColor: '#3a1a1a', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  deleteBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtnText: { color: '#ff4444', fontWeight: '600' },
});
