/** A single river segment (one continuous polyline). */
export interface RiverSegment {
  /** English name */
  name: string;
  /** Chinese name (if available) */
  zh?: string;
  /** Natural Earth scalerank 1-3 (1 = most prominent) */
  rank: number;
  /** Coordinate pairs [lon, lat] */
  coords: [number, number][];
}

/** A mountain peak or mountain range label point. */
export interface MountainFeature {
  /** English name */
  name: string;
  /** Chinese name (if available) */
  zh?: string;
  /** Feature class: 'mountain' | 'pass' | 'range' */
  type: string;
  /** Center coordinate [lon, lat] */
  coords: [number, number];
  /** Elevation in metres (only for peaks) */
  elev?: number;
}
