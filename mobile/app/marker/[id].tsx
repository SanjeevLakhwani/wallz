import { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useComments } from '@/hooks/useComments';
import { daysUntilExpiry } from '@/lib/marker';
import { Marker } from '@/stores/markerStore';

export default function MarkerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [marker, setMarker] = useState<Marker | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [discovered, setDiscovered] = useState(false);
  const [commentText, setCommentText] = useState('');
  const { comments, addComment } = useComments(id);

  useEffect(() => {
    supabase
      .from('markers')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setMarker(data as Marker);
      });

    supabase
      .from('likes')
      .select('user_id', { count: 'exact', head: true })
      .eq('marker_id', id)
      .then(({ count }) => setLikeCount(count ?? 0));

    if (user) {
      supabase
        .from('likes')
        .select('user_id')
        .eq('marker_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => setLiked(!!data));

      supabase
        .from('discoveries')
        .select('marker_id')
        .eq('marker_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => setDiscovered(!!data));
    }
  }, [id]);

  const toggleLike = async () => {
    if (!user || !marker) return;
    if (liked) {
      await supabase.from('likes').delete().eq('marker_id', id).eq('user_id', user.id);
      setLiked(false);
      setLikeCount((c) => c - 1);
    } else {
      await supabase.from('likes').insert({ marker_id: id, user_id: user.id });
      setLiked(true);
      setLikeCount((c) => c + 1);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    await addComment(commentText.trim());
    setCommentText('');
  };

  if (!marker) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  const expired = marker.expires_at && new Date(marker.expires_at) < new Date();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
    >
      <TouchableOpacity style={styles.back} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll}>
        {discovered && marker.photo_url ? (
          <Image source={{ uri: marker.photo_url }} style={styles.photo} />
        ) : (
          <View style={styles.lockedPhoto}>
            <Text style={styles.lockedIcon}>🔒</Text>
            <Text style={styles.lockedText}>Scan the QR code in person to reveal</Text>
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.areaName}>{marker.area_name}</Text>

          {expired ? (
            <Text style={styles.expiredLabel}>EXPIRED</Text>
          ) : marker.expires_at ? (
            <Text style={styles.expiry}>{daysUntilExpiry(marker.expires_at)} days left</Text>
          ) : null}

          <View style={styles.stats}>
            <TouchableOpacity style={styles.likeBtn} onPress={toggleLike}>
              <Text style={styles.likeIcon}>{liked ? '❤️' : '🤍'}</Text>
              <Text style={styles.statText}>{likeCount}</Text>
            </TouchableOpacity>
            <View style={styles.stat}>
              <Text style={styles.statText}>
                {(marker as any).discovery_count ?? 0} found
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Comments</Text>

          {comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <Text style={styles.commentUser}>@{c.profiles?.username}</Text>
              <Text style={styles.commentBody}>{c.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.commentBar}>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor="#555"
          value={commentText}
          onChangeText={setCommentText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={submitComment}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loading: { color: '#555', textAlign: 'center', marginTop: 100 },
  back: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 8 },
  backText: { color: '#888', fontSize: 15 },
  scroll: { paddingBottom: 80 },
  photo: { width: '100%', height: 300, resizeMode: 'cover' },
  lockedPhoto: {
    width: '100%',
    height: 200,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  lockedIcon: { fontSize: 32 },
  lockedText: { color: '#555', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
  body: { padding: 20 },
  areaName: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  expiry: { color: '#f5a623', fontSize: 13, marginBottom: 16 },
  expiredLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  stats: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeIcon: { fontSize: 20 },
  stat: { justifyContent: 'center' },
  statText: { color: '#aaa', fontSize: 14 },
  sectionTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 12 },
  comment: { marginBottom: 16 },
  commentUser: { color: '#888', fontSize: 12, marginBottom: 4 },
  commentBody: { color: '#ddd', fontSize: 14 },
  commentBar: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 32,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
  },
  sendBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#000', fontWeight: '700' },
});
