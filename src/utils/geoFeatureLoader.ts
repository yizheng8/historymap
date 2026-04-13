import type { RiverSegment, MountainFeature } from '@/data/geoFeatures';

let cachedRivers: RiverSegment[] | null = null;
let cachedMountains: MountainFeature[] | null = null;

export async function loadRivers(): Promise<RiverSegment[]> {
  if (cachedRivers) return cachedRivers;
  const resp = await fetch('/rivers.json');
  if (!resp.ok) throw new Error(`Failed to load rivers.json: ${resp.status}`);
  cachedRivers = (await resp.json()) as RiverSegment[];
  return cachedRivers;
}

export async function loadMountains(): Promise<MountainFeature[]> {
  if (cachedMountains) return cachedMountains;
  const resp = await fetch('/mountains.json');
  if (!resp.ok) throw new Error(`Failed to load mountains.json: ${resp.status}`);
  cachedMountains = (await resp.json()) as MountainFeature[];
  return cachedMountains;
}
