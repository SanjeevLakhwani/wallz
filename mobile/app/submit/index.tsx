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

type Step = 'upload' | 'qr' | 'submit';

export default function SubmitScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState<Step>('upload');
  const [markerCode] = useState(() => generateMarkerCode());
  const [artwork, setArtwork] = useState<string | null>(null);
  const [areaName, setAreaName] = useState('');
  const [geohash, setGeohash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const deepLink = markerDeepLink(markerCode);

  const pickArtwork = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to upload artwork.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 1,
    });
    if (!result.canceled) {
      setArtwork(result.assets[0].uri);
      setStep('qr');
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
        xhr.onload = () => xhr.status === 200 ? resolve() : reject(new Error(xhr.responseText));
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send({ uri: artwork, type: `image/${ext}`, name: `photo.${ext}` } as any);
      });

      const { data: { publicUrl } } = supabase.storage
        .from('marker-photos')
        .getPublicUrl(path);

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
        'Print the QR code and stick it where your art is. Anyone who scans it will see your artwork.',
        [{ text: 'Done', onPress: () => router.replace('/(tabs)') }]
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

      <Text style={styles.title}>Submit Artwork</Text>

      {/* Step 1: Upload artwork */}
      <View style={styles.section}>
        <Text style={styles.stepLabel}>1 · Upload your artwork</Text>
        <Text style={styles.hint}>Choose the image you want people to see when they scan your tag.</Text>
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
      </View>

      {/* Step 2: QR Code + location */}
      {(step === 'qr' || step === 'submit') && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>2 · Your QR code</Text>
          <Text style={styles.hint}>Print this and stick it on the wall where your artwork is placed. Anyone who scans it sees your art in AR.</Text>

          <View style={styles.qrContainer}>
            <QRCode value={deepLink} size={200} color="#fff" backgroundColor="#0a0a0a" />
            <Text style={styles.wallzLabel}>WALLZ</Text>
          </View>
          <Text style={styles.codeText}>{markerCode.slice(0, 8)}...</Text>

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
              {geohash ? `✓ Location set` : '📍 Use Current Location'}
            </Text>
          </TouchableOpacity>

          {areaName && geohash && step === 'qr' && (
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
          <Text style={styles.hint}>Your artwork will appear in AR when someone scans your QR code.</Text>
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
