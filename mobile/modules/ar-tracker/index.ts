import { requireNativeViewManager } from 'expo-modules-core';
import { ViewStyle } from 'react-native';

export interface ARTrackerViewProps {
  style?: ViewStyle;
  referenceImageBase64: string;
  physicalWidth?: number;
  isActive: boolean;
  onAnchorFound?: (event: { nativeEvent: { visible: boolean } }) => void;
  onAnchorUpdated?: (event: { nativeEvent: { normalX: number; normalY: number; visible: boolean } }) => void;
  onAnchorLost?: (event: { nativeEvent: Record<string, never> }) => void;
}

const NativeARTrackerView = requireNativeViewManager('ArTracker');
export { NativeARTrackerView as ARTrackerView };
