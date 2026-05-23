import { create } from 'zustand';

export type MarkerStatus = 'pending' | 'approved' | 'expired';

export type Marker = {
  id: string;
  creator_id: string;
  marker_code: string;
  area_name: string;
  geohash: string;
  photo_url: string | null;
  status: MarkerStatus;
  created_at: string;
  approved_at: string | null;
  expires_at: string | null;
  // joined stats
  like_count?: number;
  discovery_count?: number;
  comment_count?: number;
};

export type GeohashCell = {
  geohash: string;
  count: number;
  discoveredCount: number;
  lat: number;
  lng: number;
};

type MarkerState = {
  cells: GeohashCell[];
  selectedMarkerId: string | null;
  setCells: (cells: GeohashCell[]) => void;
  selectMarker: (id: string | null) => void;
};

export const useMarkerStore = create<MarkerState>((set) => ({
  cells: [],
  selectedMarkerId: null,
  setCells: (cells) => set({ cells }),
  selectMarker: (id) => set({ selectedMarkerId: id }),
}));
