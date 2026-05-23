import ngeohash from 'ngeohash';

// Precision 5 ≈ 4.9km × 4.9km cell — enough to hint area, not pinpoint
const PRECISION = 5;

export const toGeohash = (lat: number, lng: number): string =>
  ngeohash.encode(lat, lng, PRECISION);

export const geohashCenter = (hash: string): { lat: number; lng: number } => {
  const { latitude, longitude } = ngeohash.decode(hash);
  return { lat: latitude, lng: longitude };
};

export const geohashBounds = (hash: string): [number, number, number, number] =>
  ngeohash.decode_bbox(hash) as [number, number, number, number];

export const geohashNeighbors = (hash: string): string[] =>
  Object.values(ngeohash.neighbors(hash));
