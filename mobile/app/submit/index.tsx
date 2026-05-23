import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { generateMarkerCode, markerDeepLink } from '@/lib/marker';
import { toGeohash } from '@/lib/geohash';
import * as Location from 'expo-location';

type Step = 'generate' | 'photo' | 'area' | 'submit';

export default function SubmitScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState<Step>('generate');
  const [markerCode] = useState(() => generateMarkerCode());
  const [photo, setPhoto] = useState<string | null>(null);
  const [areaName, setAreaName] = useState('');
  const [geohash, setGeohash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const deepLink = markerDeepLink(markerCode);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to photo your tag.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
      setStep('area');
    }
  };

  const detectLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Location needed to set tag area.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    const hash = toGeohash(loc.coords.latitude, loc.coords.longitude);
    setGeohash(hash);
  };

  const handleSubmit = async () => {
    if (!user || !photo || !areaName || !geohash) return;
    setLoading(true);

    try {
      // Upload photo via XHR — fetch+blob and FormData both fail in React Native
      const ext = photo.split('.').pop() ?? 'jpg';
      const path = `markers/${user.id}/${markerCode}.${ext}`;
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${supabaseUrl}/storage/v1/object/marker-photos/${path}`);
        xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`);
        xhr.setRequestHeader('Content-Type', `image/${ext}`);
        xhr.onload = () => xhr.status === 200 ? resolve() : reject(new Error(xhr.responseText));
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send({ uri: photo, type: `image/${ext}`, name: `photo.${ext}` } as any);
      });

      const { data: { publicUrl } } = supabase.storage
        .from('marker-photos')
        .getPublicUrl(path);

      // Insert marker record — auto-approved for testing
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: insertError } = await supabase.from('markers').insert({
        creator_id: user.id,
        marker_code: markerCode,
        area_name: areaName,
        geohash,
        photo_url: publicUrl,
        status: 'approved',
        approved_at: now.toISOString(),
        expires_at: expiresAt,
      });
      if (insertError) throw insertError;

      Alert.alert(
        'Tag live!',
        'Your tag is now live on the map for 30 days.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
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

      <Text style={styles.title}>Submit Tag</Text>

      {/* Step 1: Generate */}
      <View style={styles.section}>
        <Text style={styles.stepLabel}>1 · Your Unique Tag</Text>
        <Text style={styles.hint}>Screenshot and print this. Place it somewhere in the world.</Text>
        <View style={styles.qrContainer}>
          <QRCode value={deepLink} size={200} color="#fff" backgroundColor="#0a0a0a" />
          <View style={styles.qrBorder} pointerEvents="none" />
          <Text style={styles.wallzLabel}>WALLZ</Text>
        </View>
        <Text style={styles.codeText}>{markerCode.slice(0, 8)}...</Text>
        {step === 'generate' && (
          <TouchableOpacity style={styles.btn} onPress={() => setStep('photo')}>
            <Text style={styles.btnText}>I've placed it → Take photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Step 2: Photo */}
      {(step === 'photo' || step === 'area' || step === 'submit') && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>2 · Photo of placed tag</Text>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.preview} />
          ) : (
            <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
              <Text style={styles.photoBtnText}>📷  Take Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Step 3: Area */}
      {(step === 'area' || step === 'submit') && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>3 · Area name</Text>
          <Text style={styles.hint}>Give a rough area label (e.g. "Downtown SF", "East Village").</Text>
          <TextInput
            style={styles.input}
            placeholder="Area name"
            placeholderTextColor="#555"
            value={areaName}
            onChangeText={setAreaName}
          />
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={detectLocation}>
            <Text style={styles.btnText}>
              {geohash ? `✓ Location set (${geohash})` : '📍 Use Current Location'}
            </Text>
          </TouchableOpacity>
          {areaName && geohash && step === 'area' && (
            <TouchableOpacity style={styles.btn} onPress={() => setStep('submit')}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Step 4: Submit */}
      {step === 'submit' && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>4 · Submit for approval</Text>
          <Text style={styles.hint}>Our team will review and approve within 24h. Once live, the 30-day countdown starts.</Text>
          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.btnText}>Submit Tag</Text>
            }
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
  qrContainer: {
    alignSelf: 'center',
    padding: 24,
    backgroundColor: '#0a0a0a',
    borderWidth: 2,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  qrBorder: {
    position: 'absolute',
    top: 8, left: 8, right: 8, bottom: 8,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
  },
  wallzLabel: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 6,
    marginTop: 12,
    fontSize: 14,
  },
  codeText: { color: '#444', fontSize: 11, textAlign: 'center', marginBottom: 16 },
  btn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  btnSecondary: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  btnText: { color: '#000', fontWeight: '700' },
  photoBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 40,
    alignItems: 'center',
  },
  photoBtnText: { color: '#fff', fontSize: 16 },
  preview: { width: '100%', height: 200, borderRadius: 8, resizeMode: 'cover' },
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
