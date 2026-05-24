import { useState, useEffect, useRef } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { CameraView } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const SCALE = 7; // artwork appears this many times larger than the QR code

type Bounds = { x: number; y: number; w: number; h: number };

export default function ARScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [areaName, setAreaName] = useState('');
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const lastSeen = useRef(0);

  useEffect(() => {
    supabase
      .from('markers')
      .select('photo_url, area_name')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setPhotoUrl(data.photo_url);
          setAreaName(data.area_name);
        }
      });
  }, [id]);

  // Clear overlay when QR code leaves frame
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastSeen.current > 400) setBounds(null);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const handleBarcodeScanned = ({ bounds: b }: any) => {
    if (!b) return;
    lastSeen.current = Date.now();
    const x = b.origin?.x ?? b.x ?? 0;
    const y = b.origin?.y ?? b.y ?? 0;
    const w = b.size?.width ?? b.width ?? 100;
    const h = b.size?.height ?? b.height ?? 100;
    setBounds({ x, y, w, h });
  };

  const overlayStyle = bounds ? {
    position: 'absolute' as const,
    left: bounds.x + bounds.w / 2 - (bounds.w * SCALE) / 2,
    top: bounds.y + bounds.h / 2 - (bounds.h * SCALE) / 2,
    width: bounds.w * SCALE,
    height: bounds.h * SCALE,
    opacity: 0.78,
    borderRadius: 8,
  } : null;

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Artwork anchored to QR code position, scaled to fill wall */}
      {photoUrl && overlayStyle && (
        <Image
          source={{ uri: photoUrl }}
          style={overlayStyle}
          resizeMode="cover"
        />
      )}

      {/* Scanning hint when QR not in frame */}
      {!bounds && (
        <View style={styles.hintWrap} pointerEvents="none">
          <View style={styles.hint}>
            <Text style={styles.hintText}>Point camera at the QR code</Text>
          </View>
        </View>
      )}

      {/* Area label top */}
      {areaName ? (
        <View style={styles.label}>
          <Text style={styles.labelText}>WALLZ · {areaName.toUpperCase()}</Text>
        </View>
      ) : null}

      {/* Bottom controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.btn} onPress={() => router.push(`/marker/${id}`)}>
          <Text style={styles.btnText}>View Tag →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  hintWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  hintText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  label: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  labelText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 3 },
  controls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
  },
  btn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
});
