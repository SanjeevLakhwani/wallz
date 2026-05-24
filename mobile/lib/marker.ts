const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// 7-char uppercase alphanumeric code (36^7 ≈ 78 billion unique values)
export const generateMarkerCode = (): string =>
  Array.from({ length: 7 }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join('');

export const markerDeepLink = (code: string): string => `cairn://scan/${code}`;

// Accept both new 7-char codes and legacy 36-char UUIDs
export const parseMarkerDeepLink = (url: string): string | null => {
  const m = url.match(/cairn:\/\/scan\/([A-Z0-9]{7}|[a-f0-9-]{36})/);
  return m ? m[1] : null;
};

export const daysUntilExpiry = (expiresAt: string): number => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};
