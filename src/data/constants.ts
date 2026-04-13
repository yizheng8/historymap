/** China map GeoJSON sources: local first, then CDN fallback */
export const MAP_URLS = [
  '/china.json',
  'https://geo.datav.alipay.com/areas_v3/bound/100000_full.json',
  'https://fastly.jsdelivr.net/npm/echarts@5.5.0/map/json/china.json',
];

/** World map GeoJSON sources: local first, then CDN fallback */
export const WORLD_MAP_URLS = [
  '/world.json',
  'https://cdn.jsdelivr.net/npm/echarts@4/map/json/world.json',
  'https://fastly.jsdelivr.net/npm/echarts@4/map/json/world.json',
];

/** SVG path for the star marker (China events) */
export const STAR_SYMBOL =
  'path://M512 96l128 260 288 42-210 204 50 290-256-136-256 136 50-290L96 398l288-42z';

/** SVG path for diamond marker (World events) */
export const DIAMOND_SYMBOL =
  'path://M512 64L832 512L512 960L192 512Z';

/** Event category colors */
export const CHINA_COLOR = '#e84830';
export const WORLD_COLOR = '#c9a96e';

/** Geographic layer colors */
export const RIVER_COLOR = '#4a90d4';
export const MOUNTAIN_COLOR = '#7a6040';

/** Causal relationship line colors */
export const CAUSE_COLOR = '#ff6b50';
export const INFLUENCE_COLOR = '#4a90d4';
