import * as echarts from 'echarts';
import { WORLD_MAP_URLS, MAP_URLS } from '@/data/constants';

let worldRegistered = false;
let chinaRegistered = false;

export async function ensureWorldMap(): Promise<void> {
  if (worldRegistered) return;

  for (const url of WORLD_MAP_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geo = await res.json();
      echarts.registerMap('world', geo);
      worldRegistered = true;
      return;
    } catch {
      console.warn(`世界地图数据源加载失败: ${url}`);
    }
  }

  throw new Error('所有世界地图数据源均不可用，请检查网络连接');
}

/**
 * 加载并注册 'china' 地图（含省份边界）。
 * china.json 为 echarts UTF-8 编码格式，直接交由 echarts.registerMap 内部解码，
 * 无需手动解析坐标。失败时静默降级，不抛出异常。
 */
export async function ensureChinaMap(): Promise<boolean> {
  if (chinaRegistered) return true;

  for (const url of MAP_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geo = await res.json();
      echarts.registerMap('china', geo);
      chinaRegistered = true;
      return true;
    } catch {
      console.warn(`中国省份地图数据加载失败: ${url}`);
    }
  }

  console.warn('中国省份地图所有来源均不可用，省份边界层已禁用');
  return false;
}


export type ProvinceLineItem = { coords: [number, number][] };
export type ProvinceNameItem = { value: [number, number]; name: string };

interface ProvinceData {
  lines: ProvinceLineItem[];
  names: ProvinceNameItem[];
}

let provinceCache: ProvinceData | null = null;

/** 加载中国省份 GeoJSON 并提取省界线坐标和省份名称 */
export async function loadChinaProvinces(): Promise<ProvinceData> {
  if (provinceCache) return provinceCache;

  for (const url of MAP_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geo = await res.json();

      const lines: ProvinceLineItem[] = [];
      const names: ProvinceNameItem[] = [];

      for (const feature of geo.features ?? []) {
        const name: string = feature.properties?.name ?? '';
        const geom = feature.geometry;
        if (!geom) continue;

        const extractRings = (coords: [number, number][][]) => {
          for (const ring of coords) {
            if (ring.length > 1) lines.push({ coords: ring });
          }
        };

        if (geom.type === 'Polygon') {
          extractRings(geom.coordinates as [number, number][][]);
        } else if (geom.type === 'MultiPolygon') {
          for (const polygon of geom.coordinates as [number, number][][][]) {
            extractRings(polygon);
          }
        }

        // 用外环质心计算省份标签位置
        const outerRing: [number, number][] =
          geom.type === 'Polygon'
            ? geom.coordinates[0]
            : geom.coordinates[0]?.[0] ?? [];
        if (outerRing.length > 0) {
          const sumLon = outerRing.reduce((s: number, p: [number, number]) => s + p[0], 0);
          const sumLat = outerRing.reduce((s: number, p: [number, number]) => s + p[1], 0);
          names.push({ value: [sumLon / outerRing.length, sumLat / outerRing.length], name });
        }
      }

      provinceCache = { lines, names };
      return provinceCache;
    } catch {
      console.warn(`中国省份数据加载失败: ${url}`);
    }
  }

  throw new Error('中国省份数据所有来源均不可用');
}
