import { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import type Svg from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { generateMarkerCode } from '@/lib/marker';
import { toGeohash } from '@/lib/geohash';
import { RingTagGenerator } from '@/components/RingTagGenerator';
import { useRingTagSave } from '@/hooks/useRingTagSave';
import * as Location from 'expo-location';

type Step = 'photo' | 'location' | 'approving' | 'tag';

export default function SubmitScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState<Step>('photo');
  const [markerCode] = useState(() => generateMarkerCode());
  const ringTagRef = useRef<Svg>(null);
  const { save: saveToPhotos, saving: savingPhoto } = useRingTagSave(ringTagRef);
  const [artwork, setArtwork] = useState<string | null>(null);
  const [areaName, setAreaName] = useState('');
  const [geohash, setGeohash] = useState<string | null>(null);

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

  const uploadAndInsert = async () => {
    const ext = artwork!.split('.').pop() ?? 'jpg';
    const path = `markers/${user!.id}/${markerCode}.${ext}`;

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
      creator_id: user!.id,
      marker_code: markerCode,
      area_name: areaName,
      geohash,
      photo_url: publicUrl,
      status: 'approved',
      approved_at: now.toISOString(),
      expires_at: expiresAt,
    });
    if (error) throw error;
  };

  const handleSubmit = async () => {
    if (!user || !artwork || !areaName || !geohash) return;
    setStep('approving');
    try {
      await Promise.all([uploadAndInsert(), new Promise(r => setTimeout(r, 2000))]);
      setStep('tag');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Upload failed');
      setStep('location');
    }
  };

  // ── Step: photo ───────────────────────────────────────────────────────────
  if (step === 'photo') return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>New Tag</Text>
      <Text style={styles.stepLabel}>1 · Upload artwork</Text>
      <Text style={styles.hint}>Choose the image people will see when they scan your tag.</Text>

      {artwork ? (
        <>
          <Image source={{ uri: artwork }} style={styles.preview} />
          <TouchableOpacity style={[styles.btn, styles.btnSecondary, { marginTop: 12 }]} onPress={pickArtwork}>
            <Text style={styles.btnTextLight}>Change artwork</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { marginTop: 12 }]} onPress={() => setStep('location')}>
            <Text style={styles.btnText}>Next →</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.uploadBtn} onPress={pickArtwork}>
          <Text style={styles.uploadIcon}>🖼</Text>
          <Text style={styles.uploadText}>Choose from library</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Step: location ────────────────────────────────────────────────────────
  if (step === 'location') return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => setStep('photo')}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>New Tag</Text>
      <Text style={styles.stepLabel}>2 · Where is it?</Text>
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

      {areaName && geohash && (
        <TouchableOpacity style={[styles.btn, { marginTop: 12 }]} onPress={handleSubmit}>
          <Text style={styles.btnText}>Submit →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Step: approving ───────────────────────────────────────────────────────
  if (step === 'approving') return (
    <View style={[styles.container, styles.centered]}>
      <ActivityIndicator color="#4f6eff" size="large" />
      <Text style={[styles.hint, { marginTop: 20, textAlign: 'center' }]}>Reviewing your tag…</Text>
    </View>
  );

  // ── Step: tag (reveal) ────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tag Approved!</Text>
      <Text style={styles.hint}>Screenshot and print this (min 8×8 cm, matte paper). Place it somewhere in the world.</Text>

      <View style={styles.tagContainer}>
        <RingTagGenerator ref={ringTagRef} code={markerCode} size={200} />
        <Text style={styles.wallzLabel}>CAIRN</Text>
      </View>
      <Text style={styles.codeText}>{markerCode}</Text>

      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={saveToPhotos} disabled={savingPhoto}>
        {savingPhoto
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.btnTextLight}>Save to Photos</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, { marginTop: 12 }]} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.btnText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24, paddingTop: 60 },
  content: { paddingBottom: 60 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  back: { marginBottom: 8 },
  backText: { color: '#888', fontSize: 15 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 32 },
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
    backgroundColor: '#04101e',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  wallzLabel: { color: '#fff', fontWeight: '900', letterSpacing: 6, marginTop: 10, fontSize: 13 },
  codeText: { color: '#4f6eff', fontSize: 14, fontWeight: '700', textAlign: 'center', letterSpacing: 3, marginBottom: 16 },
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
