import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

type Stats = {
  myDiscoveries: number;
  myArtworksDiscovered: number;
};

export default function ProfileScreen() {
  const { profile, user, signOut } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const [discoveriesRes, myMarkersRes] = await Promise.all([
        supabase
          .from('discoveries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('markers')
          .select('id')
          .eq('creator_id', user.id)
          .eq('status', 'approved'),
      ]);

      const myDiscoveries = discoveriesRes.count ?? 0;

      let myArtworksDiscovered = 0;
      if (myMarkersRes.data && myMarkersRes.data.length > 0) {
        const ids = myMarkersRes.data.map((m) => m.id);
        const { count } = await supabase
          .from('discoveries')
          .select('*', { count: 'exact', head: true })
          .in('marker_id', ids);
        myArtworksDiscovered = count ?? 0;
      }

      setStats({ myDiscoveries, myArtworksDiscovered });
    };

    fetchStats();
  }, [user]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.username}>@{profile?.username ?? '...'}</Text>

        <View style={styles.statsRow}>
          <StatBox
            label="Discovered"
            value={stats?.myDiscoveries}
            sub="tags you found"
          />
          <View style={styles.divider} />
          <StatBox
            label="Your Reach"
            value={stats?.myArtworksDiscovered}
            sub="finds by others"
          />
        </View>
      </View>

      <TouchableOpacity style={styles.action} onPress={() => router.push('/submit')}>
        <Text style={styles.actionText}>+ Submit New Tag</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.action, styles.signOutBtn]} onPress={signOut}>
        <Text style={[styles.actionText, { color: '#ff4444' }]}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatBox({ label, value, sub }: { label: string; value?: number; sub: string }) {
  return (
    <View style={styles.statBox}>
      {value === undefined ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.statValue}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 60, padding: 24 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 32 },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  username: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 24 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statBox: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  statLabel: { color: '#aaa', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  statSub: { color: '#555', fontSize: 10 },
  divider: { width: 1, height: 40, backgroundColor: '#2a2a2a' },
  action: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  actionText: { color: '#fff', fontWeight: '600' },
  signOutBtn: { borderColor: '#3a1a1a' },
});
