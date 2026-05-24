import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import type Svg from 'react-native-svg';

export function useRingTagSave(svgRef: React.RefObject<Svg>) {
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to save Ring Tags.');
      return;
    }
    setSaving(true);
    svgRef.current?.toDataURL(async (base64: string) => {
      try {
        const path = `${FileSystem.cacheDirectory}ring-tag-${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(path, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await MediaLibrary.saveToLibraryAsync(path);
        await FileSystem.deleteAsync(path, { idempotent: true });
        Alert.alert('Saved', 'Ring Tag saved to Photos.');
      } catch (e: any) {
        Alert.alert('Error', e.message ?? 'Could not save.');
      } finally {
        setSaving(false);
      }
    });
  }, [svgRef]);

  return { save, saving };
}
