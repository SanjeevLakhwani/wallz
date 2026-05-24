// AR view: shown after CV reader decodes a Ring Tag.
// Captures the Ring Tag SVG as a PNG, registers it with ARKit, then overlays
// a flat info card anchored to the tracked physical marker in 3D space.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Defs, Filter, FeGaussianBlur, Rect } from 'react-native-svg';
import MaskedView from '@react-native-masked-view/masked-view';
import { ARTrackerView } from 'ar-tracker';
import { supabase } from '@/lib/supabase';
import { RingTagGenerator } from '@/components/RingTagGenerator';

interface MarkerInfo {
  photo_url: string | null;
  area_name: string;
}

interface Props {
  markerCode: string;
  markerId: string;
  physicalWidth?: number;
  onDismiss: () => void;
}

export function ARTagView({ markerCode, markerId, physicalWidth = 0.12, onDismiss }: Props) {
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const svgRef = useRef<Svg>(null);

  const [referenceImageBase64, setReferenceImageBase64] = useState<string | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [anchorPos, setAnchorPos] = useState<{ x: number; y: number } | null>(null);
  const [anchorVisible, setAnchorVisible] = useState(false);
  const [markerInfo, setMarkerInfo] = useState<MarkerInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  // Fetch marker info for the overlay card
  useEffect(() => {
    supabase
      .from('markers')
      .select('photo_url, area_name')
      .eq('id', markerId)
      .single()
      .then(({ data }) => {
        if (data) setMarkerInfo(data);
        setLoadingInfo(false);
      });
  }, [markerId]);

  // Give VisionCamera time to fully release its AVCaptureSession before ARKit starts.
  // iOS allows only one active camera session — overlap causes black screen.
  useEffect(() => {
    const t = setTimeout(() => setCamReady(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // Export Ring Tag SVG → base64 PNG for ARKit reference image registration.
  // Delay matches camReady so the SVG has time to paint off-screen.
  useEffect(() => {
    const t = setTimeout(() => {
      svgRef.current?.toDataURL((data: string) => {
        setReferenceImageBase64(data);
      });
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const handleAnchorUpdated = useCallback(
    (e: { nativeEvent: { normalX: number; normalY: number; visible: boolean } }) => {
      const { normalX, normalY, visible } = e.nativeEvent;
      const inViewport = normalX >= 0 && normalX <= 1 && normalY >= 0 && normalY <= 1;
      const isVisible = visible && inViewport;
      setAnchorVisible(isVisible);
      if (isVisible) setAnchorPos({ x: normalX * screenW, y: normalY * screenH });
    },
    [screenW, screenH],
  );

  const cardW = Math.round(screenW * 0.62);
  const cardH = Math.round(screenH * 0.42);
  const cardX = anchorPos
    ? Math.max(8, Math.min(screenW - cardW - 8, anchorPos.x - cardW / 2))
    : (screenW - cardW) / 2;
  const cardY = anchorPos ? Math.max(80, anchorPos.y - cardH - 24) : (screenH - cardH) / 2;

  return (
    <View style={styles.container}>
      {/* Off-screen Ring Tag for SVG → PNG export */}
      <View style={styles.offscreen} pointerEvents="none">
        <RingTagGenerator ref={svgRef} code={markerCode} size={400} />
      </View>

      {/* ARKit camera + image tracker — wait for both SVG export and camera handoff */}
      {referenceImageBase64 && camReady && (
        <ARTrackerView
          style={StyleSheet.absoluteFill}
          referenceImageBase64={referenceImageBase64}
          physicalWidth={physicalWidth}
          isActive
          onAnchorFound={() => setAnchorVisible(true)}
          onAnchorUpdated={handleAnchorUpdated}
          onAnchorLost={() => setAnchorVisible(false)}
        />
      )}

      {/* Flat info card floating above the physical marker */}
      {anchorVisible && !loadingInfo && markerInfo?.photo_url && (
        <MaskedView
          style={[styles.card, { left: cardX, top: cardY, width: cardW, height: cardH }]}
          maskElement={
            <Svg width={cardW} height={cardH}>
              <Defs>
                <Filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
                  <FeGaussianBlur stdDeviation="18" />
                </Filter>
              </Defs>
              <Rect
                x={28} y={28}
                width={cardW - 56} height={cardH - 56}
                rx={20} ry={20}
                fill="white"
                filter="url(#soft)"
              />
            </Svg>
          }
        >
          <Image source={{ uri: markerInfo.photo_url }} style={styles.photo} />
        </MaskedView>
      )}

      {(loadingInfo || !referenceImageBase64 || !camReady) && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#4f6eff" />
          <Text style={styles.loadingText}>Initialising AR…</Text>
        </View>
      )}

      <TouchableOpacity style={styles.close} onPress={onDismiss}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  offscreen: { position: 'absolute', left: -2000, top: -2000, opacity: 0 },
  card: {
    position: 'absolute',
  },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  loadingRow: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: { color: '#aaa', fontSize: 13 },
  close: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 16 },
});
