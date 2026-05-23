import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export const generateMarkerCode = (): string => uuidv4();

export const markerDeepLink = (code: string): string =>
  `wallz://scan/${code}`;

export const parseMarkerDeepLink = (url: string): string | null => {
  const match = url.match(/wallz:\/\/scan\/([a-f0-9-]{36})/);
  return match ? match[1] : null;
};

export const daysUntilExpiry = (expiresAt: string): number => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};
