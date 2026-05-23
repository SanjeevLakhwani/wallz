import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { parseMarkerDeepLink } from '@/lib/marker';
import { useDiscovery } from '@/hooks/useDiscovery';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const { discoverByCode, loading } = useDiscovery();

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);

    const code = parseMarkerDeepLink(data);
    if (!code) {
      Alert.alert('Not a Wallz tag', 'Try scanning a valid Wallz fiducial marker.', [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
      return;
    }

    const result = await discoverByCode(code);

    switch (result.status) {
      case 'success':
        router.push(`/marker/${result.markerId}`);
        break;
      case 'already_found':
        Alert.alert('Already in collection', 'You found this one before.', [
          { text: 'View it', onPress: () => setScanned(false) },
        ]);
        break;
      case 'expired':
        Alert.alert('Tag expired', 'This tag expired 30 days after it was placed.', [
          { text: 'OK', onPress: () => setScanned(false) },
        ]);
        break;
      case 'not_found':
        Alert.alert('Tag not found', 'This tag is pending approval or does not exist.', [
          { text: 'OK', onPress: () => setScanned(false) },
        ]);
        break;
      case 'error':
        Alert.alert('Error', result.message, [
          { text: 'OK', onPress: () => setScanned(false) },
        ]);
        break;
    }
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permText}>Camera access needed to scan tags.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>SCAN TAG</Text>
        <View style={styles.frame} />
        <Text style={styles.overlayHint}>Point camera at a Wallz fiducial marker</Text>
        {scanned && !loading && (
          <TouchableOpacity style={styles.btn} onPress={() => setScanned(false)}>
            <Text style={styles.btnText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  overlayTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 40,
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
    marginBottom: 40,
  },
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
