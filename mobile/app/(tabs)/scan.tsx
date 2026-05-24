import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { parseMarkerDeepLink } from '@/lib/marker';
import { useDiscovery } from '@/hooks/useDiscovery';
import { detectRingTag } from '@/lib/ringTagReader';
import { AROverlay } from '@/components/AROverlay';
import { ARTagView } from '@/components/ARTagView';

type ScanPhase = 'scanning' | 'ar' | 'navigating';

export default function ScanScreen() {
  const router = useRouter();
  const { code: deepLinkCode } = useLocalSearchParams<{ code?: string }>();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { discoverByCode, loading } = useDiscovery();

  const [phase, setPhase] = useState<ScanPhase>('scanning');
  const [detecting, setDetecting] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [discoveredMarkerId, setDiscoveredMarkerId] = useState<string | null>(null);

  const lockedRef = useRef(false);
  const lastCodeRef = useRef<string | null>(null);
  const frameCount = useSharedValue(0);

  const reset = useCallback(() => {
    lockedRef.current = false;
    lastCodeRef.current = null;
    setPhase('scanning');
    setDetecting(false);
    setPendingCode(null);
    setDiscoveredMarkerId(null);
  }, []);

  const handleCode = useCallback(
    async (markerCode: string) => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      setPendingCode(markerCode);

      const result = await discoverByCode(markerCode);

      switch (result.status) {
        case 'success':
          setDiscoveredMarkerId(result.markerId);
          setPhase('ar');
          break;
        case 'already_found':
          Alert.alert('Already in collection', 'You found this one before.', [
            { text: 'OK', onPress: reset },
          ]);
          break;
        case 'expired':
          Alert.alert('Tag expired', 'This tag expired 30 days after it was placed.', [
            { text: 'OK', onPress: reset },
          ]);
          break;
        case 'not_found':
          Alert.alert('Tag not found', 'This tag is pending approval or does not exist.', [
            { text: 'OK', onPress: reset },
          ]);
          break;
        case 'error':
          Alert.alert('Error', result.message, [{ text: 'OK', onPress: reset }]);
          break;
      }
    },
    [discoverByCode, router, reset],
  );

  const onDetection = useCallback(
    (detected: boolean, code: string | null) => {
      if (lockedRef.current) return;
      setDetecting(detected);
      if (code && code !== lastCodeRef.current) {
        lastCodeRef.current = code;
        handleCode(code);
      }
    },
    [handleCode],
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      frameCount.value++;
      if (frameCount.value % 3 !== 0) return;
      const result = detectRingTag(frame);
      runOnJS(onDetection)(result.center !== null, result.code);
    },
    [onDetection],
  );

  useEffect(() => {
    if (!deepLinkCode || lockedRef.current) return;
    const code = parseMarkerDeepLink(`wallz://scan/${deepLinkCode}`) ?? deepLinkCode;
    handleCode(code);
  }, [deepLinkCode, handleCode]);

  const handleARDismiss = useCallback(() => {
    if (discoveredMarkerId) {
      router.replace(`/marker/${discoveredMarkerId}`);
    } else {
      reset();
    }
  }, [discoveredMarkerId, router, reset]);

  if (phase === 'ar' && pendingCode && discoveredMarkerId) {
    return (
      <ARTagView
        markerCode={pendingCode}
        markerId={discoveredMarkerId}
        onDismiss={handleARDismiss}
      />
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permText}>Camera access needed to scan Ring Tags.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.permText}>No camera found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={phase === 'scanning'}
        frameProcessor={phase === 'scanning' ? frameProcessor : undefined}
        pixelFormat="yuv"
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>SCAN RING TAG</Text>
        <View style={[styles.frame, detecting && styles.frameActive]} />
        <Text style={styles.overlayHint}>Point camera at a Wallz Ring Tag</Text>
        {pendingCode && !loading && (
          <TouchableOpacity style={styles.btn} onPress={reset}>
            <Text style={styles.btnText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
      <AROverlay
        visible={detecting && !lockedRef.current}
        decoded={!!pendingCode}
        code={pendingCode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  overlayTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 4, marginBottom: 40 },
  frame: {
    width: 260,
    height: 260,
    borderWidth: 2,
    borderColor: '#ffffff44',
    borderRadius: 12,
    marginBottom: 40,
  },
  frameActive: { borderColor: '#7c3aed' },
  overlayHint: { color: '#aaa', fontSize: 13 },
  permText: { color: '#fff', marginBottom: 20, textAlign: 'center', padding: 24 },
  btn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  btnText: { color: '#000', fontWeight: '700' },
});
