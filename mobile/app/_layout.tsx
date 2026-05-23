import 'react-native-get-random-values';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { parseMarkerDeepLink } from '@/lib/marker';

export default function RootLayout() {
  const { session, setSession, fetchProfile } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const handleURL = ({ url }: { url: string }) => {
      if (!session) return;
      const code = parseMarkerDeepLink(url);
      if (code) router.push({ pathname: '/(tabs)/scan', params: { code } });
    };

    const sub = Linking.addEventListener('url', handleURL);
    Linking.getInitialURL().then((url) => {
      if (url && session) handleURL({ url });
    });

    return () => sub.remove();
  }, [session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
