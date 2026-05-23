import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.username}>@{profile?.username ?? '...'}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 60, padding: 24 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 32 },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  username: { color: '#fff', fontSize: 20, fontWeight: '700' },
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
