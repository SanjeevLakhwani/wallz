import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { generateMarkerCode } from '@/lib/marker';
import { toGeohash } from '@/lib/geohash';
import { RingTagGenerator } from '@/components/RingTagGenerator';
import * as Location from 'expo-location';

type Step = 'tag' | 'details' | 'submit';

export default function SubmitScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState<Step>('tag');
  const [markerCode] = useState(() => generateMarkerCode());
  const [artwork, setArtwork] = useState<string | null>(null);
  const [areaName, setAreaName] = useState('');
  const [geohash, setGeohash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickArtwork = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to upload artwork.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
    if (!result.canceled) setArtwork(result.assets[0].uri);
  };

  const detectLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Location needed to set tag area.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setGeohash(toGeohash(loc.coords.latitude, loc.coords.longitude));
  };

  const handleSubmit = async () => {
    if (!user || !artwork || !areaName || !geohash) return;
    setLoading(true);
    try {
      const ext = artwork.split('.').pop() ?? 'jpg';
      const path = `markers/${user.id}/${markerCode}.${ext}`;

      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${supabaseUrl}/storage/v1/object/marker-photos/${path}`);
        xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`);
        xhr.setRequestHeader('Content-Type', `image/${ext}`);
        xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(xhr.responseText)));
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send({ uri: artwork, type: `image/${ext}`, name: `photo.${ext}` } as any);
      });

      const { data: { publicUrl } } = supabase.storage.from('marker-photos').getPublicUrl(path);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from('markers').insert({
        creator_id: user.id,
        marker_code: markerCode,
        area_name: areaName,
        geohash,
        photo_url: publicUrl,
        status: 'approved',
        approved_at: now.toISOString(),
        expires_at: expiresAt,
      });
      if (error) throw error;

      Alert.alert('Tag live!', 'Your tag is now live on the map for 30 days.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Submit Artwork</Text>

      {/* Step 1: Generate Ring Tag */}
      <View style={styles.section}>
        <Text style={styles.stepLabel}>1 · Your Unique Ring Tag</Text>
        <Text style={styles.hint}>Screenshot and print this (min 8×8 cm, matte paper). Place it somewhere in the world.</Text>
        <View style={styles.tagContainer}>
          <RingTagGenerator code={markerCode} size={200} />
          <Text style={styles.wallzLabel}>WALLZ</Text>
        </View>
        <Text style={styles.codeText}>{markerCode}</Text>
        {step === 'tag' && (
          <TouchableOpacity style={styles.btn} onPress={() => setStep('details')}>
            <Text style={styles.btnText}>I've placed it →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Step 2: Artwork + location */}
      {(step === 'details' || step === 'submit') && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>2 · Upload your artwork</Text>
          <Text style={styles.hint}>Choose the image people will see when they scan your tag.</Text>
          {artwork ? (
            <View>
              <Image source={{ uri: artwork }} style={styles.preview} />
              <TouchableOpacity style={[styles.btn, styles.btnSecondary, { marginTop: 12 }]} onPress={pickArtwork}>
                <Text style={styles.btnTextLight}>Change artwork</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBtn} onPress={pickArtwork}>
              <Text style={styles.uploadIcon}>🖼</Text>
              <Text style={styles.uploadText}>Choose from library</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.stepLabel, { marginTop: 24 }]}>3 · Where is it?</Text>
          <Text style={styles.hint}>Give a rough area name so others can find it.</Text>
          <TextInput
            style={styles.input}
            placeholder="Area name (e.g. Downtown SF)"
            placeholderTextColor="#555"
            value={areaName}
            onChangeText={setAreaName}
          />
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={detectLocation}>
            <Text style={styles.btnTextLight}>
              {geohash ? '✓ Location set' : '📍 Use Current Location'}
            </Text>
          </TouchableOpacity>
          {artwork && areaName && geohash && step === 'details' && (
            <TouchableOpacity style={[styles.btn, { marginTop: 12 }]} onPress={() => setStep('submit')}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Step 3: Submit */}
      {step === 'submit' && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>4 · Go live</Text>
          <Text style={styles.hint}>Your tag will appear on the map for 30 days.</Text>
          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>Submit Tag</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  back: { marginBottom: 8 },
  backText: { color: '#888', fontSize: 15 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 32 },
  section: { marginBottom: 36 },
  stepLabel: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  hint: { color: '#666', fontSize: 13, marginBottom: 16 },
  uploadBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderStyle: 'dashed',
    padding: 48,
    alignItems: 'center',
    gap: 12,
  },
  uploadIcon: { fontSize: 40 },
  uploadText: { color: '#888', fontSize: 15 },
  preview: { width: '100%', height: 240, borderRadius: 12, resizeMode: 'cover' },
  tagContainer: {
    alignSelf: 'center',
    padding: 16,
    backgroundColor: '#0f0a1e',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  wallzLabel: { color: '#fff', fontWeight: '900', letterSpacing: 6, marginTop: 10, fontSize: 13 },
  codeText: { color: '#7c3aed', fontSize: 14, fontWeight: '700', textAlign: 'center', letterSpacing: 3, marginBottom: 16 },
  btn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  btnSecondary: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  btnText: { color: '#000', fontWeight: '700' },
  btnTextLight: { color: '#fff', fontWeight: '700' },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    fontSize: 16,
    marginBottom: 8,
  },
});
