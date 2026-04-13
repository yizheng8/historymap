import { useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';
import { STAR_SYMBOL, DIAMOND_SYMBOL, CHINA_COLOR, WORLD_COLOR, RIVER_COLOR, MOUNTAIN_COLOR, CAUSE_COLOR, INFLUENCE_COLOR } from '@/data/constants';
import { HISTORY_EVENTS, type HistoryEvent } from '@/data/events';
import { EVENT_MAP, type Relationship } from '@/data/relationships';
import type { RiverSegment, MountainFeature } from '@/data/geoFeatures';
import { ensureChinaMap, loadChinaProvinces } from '@/utils/mapLoader';

/** 显示省份边界线的最小缩放级别 */
const PROVINCE_BORDER_ZOOM = 3;
/** 显示省份名称标签的最小缩放级别 */
const PROVINCE_NAME_ZOOM = 5;
/** 显示全部事件标签的最小缩放级别 */
const EVENT_LABEL_ZOOM = 1.0;

/**
 * 动态计算世界地图到中国地图的 zoom 换算比例。
 * 原理：两个 geo 组件均使用等经纬度投影，为使相同地理坐标在画布上落在相同像素，
 * 需要 world_scale * world_zoom = china_scale * china_zoom，
 * 其中 scale = min(containerW / bboxW, containerH / bboxH)。
 * World bbox ≈ 360° × 145°（echarts world.json 不含南极洲）
 * China bbox ≈ 62° × 35°
 */
function computeZoomRatio(containerW: number, containerH: number): number {
  const worldPPD = Math.min(containerW / 360, containerH / 145);
  const chinaPPD = Math.min(containerW / 62, containerH / 35);
  return worldPPD / chinaPPD;
}

/** 更新 china-geo 的可见性、缩放及标签，使其与 world-geo 视口对齐 */
function updateChinaOverlay(
  chart: ECharts,
  worldZoom: number,
  worldCenter: [number, number],
  zoomRatio: number,
) {
  const show = worldZoom >= PROVINCE_BORDER_ZOOM;
  const showLabel = worldZoom >= PROVINCE_NAME_ZOOM;
  chart.setOption({
    geo: [
      { id: 'world-geo' },  // 明确指定 id，保持 world-geo 不变
      {
        id: 'china-geo',
        show,
        center: worldCenter,
        zoom: worldZoom * zoomRatio,
        label: { show: showLabel },
      },
    ],
  });
}

interface Props {
  minYear: number;
  maxYear: number;
  categoryFilter: 'all' | 'china' | 'world';
  figureFilter: string | null;
  bottomInset?: number;
  onEventClick: (event: HistoryEvent, mouseEvent: { x: number; y: number }) => void;
  showRivers: boolean;
  showMountains: boolean;
  rivers: RiverSegment[];
  mountains: MountainFeature[];
  showRelationships: boolean;
  relationships: Relationship[];
  selectedEventId: string | null;
}

interface EventPointData {
  name: string;
  value: [number, number];
  evt: HistoryEvent;
  symbolOffset?: [number, number];
}

function buildOverlapOffsets(events: HistoryEvent[]): Map<string, [number, number]> {
  const grouped = new Map<string, HistoryEvent[]>();

  for (const event of events) {
    const key = event.coordinates.join(',');
    const group = grouped.get(key);
    if (group) {
      group.push(event);
    } else {
      grouped.set(key, [event]);
    }
  }

  const offsets = new Map<string, [number, number]>();

  for (const group of grouped.values()) {
    if (group.length <= 1) continue;

    const radius = Math.min(10 + (group.length - 2) * 2, 18);
    group.forEach((event, index) => {
      const angle = (-Math.PI / 2) + (index * Math.PI * 2) / group.length;
      offsets.set(event.id, [
        Math.round(Math.cos(angle) * radius),
        Math.round(Math.sin(angle) * radius),
      ]);
    });
  }

  return offsets;
}

function withDisplayOffsets(events: HistoryEvent[]): EventPointData[] {
  const offsetMap = buildOverlapOffsets(events);
  return events.map((event) => ({
    name: event.event,
    value: event.coordinates,
    evt: event,
    symbolOffset: offsetMap.get(event.id),
  }));
}

export default function HistoryMap({ minYear, maxYear, categoryFilter, figureFilter, bottomInset = 145, onEventClick, showRivers, showMountains, rivers, mountains, showRelationships, relationships, selectedEventId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const chinaMapReadyRef = useRef<boolean>(false);
  const currentZoomRef = useRef<number>(1.2);
  const currentCenterRef = useRef<[number, number]>([40, 30]);
  const selectedEventIdRef = useRef<string | null>(selectedEventId);
  const zoomRatioRef = useRef<number>(62 / 360);  // 初始值，init 后从容器尺寸重算
  const provinceDataRef = useRef<{ lines: { coords: [number, number][] }[]; names: { value: [number, number]; name: string }[] } | null>(null);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  const buildData = useCallback(() => {
    const visible = HISTORY_EVENTS.filter(
      (e) =>
        e.year >= minYear && e.year <= maxYear &&
        (categoryFilter === 'all' || e.category === categoryFilter) &&
        (!figureFilter || e.figures?.includes(figureFilter)),
    );
    const displayData = withDisplayOffsets(visible);
    const china = displayData.filter((item) => item.evt.category === 'china');
    const world = displayData.filter((item) => item.evt.category === 'world');
    return { china, world, all: visible };
  }, [minYear, maxYear, categoryFilter, figureFilter]);

  const buildRelationshipData = useCallback(() => {
    if (!showRelationships) return { cause: [] as object[], influence: [] as object[] };
    const visibleIds = new Set(
      HISTORY_EVENTS.filter(
        (e) =>
          e.year >= minYear && e.year <= maxYear &&
          (categoryFilter === 'all' || e.category === categoryFilter) &&
          (!figureFilter || e.figures?.includes(figureFilter)),
      ).map((e) => e.id),
    );
    const relevant = selectedEventId
      ? relationships.filter(
          (r) =>
            (r.sourceId === selectedEventId || r.targetId === selectedEventId) &&
            visibleIds.has(r.sourceId) &&
            visibleIds.has(r.targetId),
        )
      : relationships.filter(
          (r) => visibleIds.has(r.sourceId) && visibleIds.has(r.targetId),
        );
    const toLineItem = (r: Relationship) => {
      const src = EVENT_MAP.get(r.sourceId);
      const tgt = EVENT_MAP.get(r.targetId);
      if (!src || !tgt) return null;
      return { coords: [src.coordinates, tgt.coordinates], rel: r };
    };
    const cause = relevant.filter((r) => r.type === 'cause').map(toLineItem).filter(Boolean);
    const influence = relevant.filter((r) => r.type === 'influence').map(toLineItem).filter(Boolean);
    return { cause, influence };
  }, [showRelationships, selectedEventId, minYear, maxYear, categoryFilter, figureFilter, relationships]);

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;

    chart.setOption({
      backgroundColor: '#a8cce0',
      legend: {
        show: true,
        top: 12,
        right: 80,
        orient: 'vertical',
        data: [
          { name: '中国历史', icon: STAR_SYMBOL },
          { name: '世界历史', icon: DIAMOND_SYMBOL },
        ],
        textStyle: { color: '#1a2a3a', fontSize: 13 },
        itemWidth: 14,
        itemHeight: 14,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderColor: 'rgba(80,120,160,0.3)',
        borderWidth: 1,
        padding: [8, 14],
        borderRadius: 4,
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255,255,255,0.97)',
        borderColor: 'rgba(80,120,160,0.3)',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: { color: '#1a2a3a', fontSize: 13 },
        formatter(p: { data?: { evt?: HistoryEvent; rel?: Relationship } }) {
          const d = p.data?.evt;
          if (d) {
            const yearLabel = d.yearEnd ? `${d.year} — ${d.yearEnd}` : `${d.year}`;
            const catColor = d.category === 'china' ? CHINA_COLOR : WORLD_COLOR;
            const catLabel = d.category === 'china' ? '中国' : '世界';
            const regionStr = d.region ? ` · ${d.region}` : '';
            return (
              `<b style="color:${catColor};font-size:20px">${yearLabel}</b>` +
              `<span style="color:${catColor};font-size:11px;margin-left:8px">[${catLabel}${regionStr}]</span>` +
              `<b style="color:#1a2a3a;font-size:15px">${d.event}</b>` +
              `<br/><span style="color:#546e7a;font-size:12px">📍 ${d.location}</span>` +
              `<br/><span style="color:#78909c;font-size:11px">（点击查看考点详情）</span>`
            );
          }
          const r = p.data?.rel;
          if (r) {
            const srcEvt = EVENT_MAP.get(r.sourceId);
            const tgtEvt = EVENT_MAP.get(r.targetId);
            const typeLabel = r.type === 'cause' ? '直接因果' : r.type === 'influence' ? '间接影响' : '同期对比';
            const color = r.type === 'cause' ? CAUSE_COLOR : INFLUENCE_COLOR;
            return (
              `<b style="color:${color};font-size:12px">[${typeLabel}]</b><br/>` +
              `<b style="color:#1a2a3a">${srcEvt?.event ?? ''}</b>` +
              `<span style="color:#546e7a"> → </span>` +
              `<b style="color:#1a2a3a">${tgtEvt?.event ?? ''}</b>` +
              `<br/><span style="color:#546e7a;font-size:12px">${r.description}</span>`
            );
          }
          return '';
        },
        extraCssText: 'border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.5);',
      },
      geo: [
        // index 0: world map (interactive, all series bind here)
        {
          id: 'world-geo',
          map: 'world',
          roam: true,
          center: [40, 30],
          zoom: 1.2,
          scaleLimit: { min: 0.8, max: 15 },
          itemStyle: {
            areaColor: {
              type: 'radial',
              x: 0.5,
              y: 0.5,
              r: 0.9,
              colorStops: [
                { offset: 0, color: '#d8ecc8' },
                { offset: 1, color: '#c4d8b0' },
              ],
            },
            borderColor: '#7aabb8',
            borderWidth: 0.8,
          },
          emphasis: {
            disabled: false,
            itemStyle: {
              areaColor: '#b4cca8',
              borderColor: '#5a9ab0',
              borderWidth: 1.2,
            },
            label: { show: false },
          },
          label: { show: false },
          select: { disabled: true },
        },
        // index 1 slot: china-geo 在地图注册成功后动态追加
      ],
      series: [
        // 0: China effectScatter
        {
          id: 'china-events',
          name: '中国历史',
          type: 'effectScatter',
          coordinateSystem: 'geo',
          zlevel: 2,
          data: [],
          symbol: STAR_SYMBOL,
          symbolSize: 20,
          rippleEffect: {
            brushType: 'stroke',
            period: 5,
            scale: 4,
            number: 2,
            color: 'rgba(255,60,30,0.35)',
          },
          itemStyle: {
            color: CHINA_COLOR,
            shadowBlur: 18,
            shadowColor: 'rgba(255,50,20,0.65)',
          },
          label: {
            show: true,
            position: 'right',
            distance: 8,
            fontSize: 11,
            color: '#1a2a3a',
            textShadowColor: 'rgba(255,255,255,0.9)',
            textShadowBlur: 3,
            formatter: (p: { data?: { evt?: HistoryEvent } }) => {
              const evt = p.data?.evt;
              if (!evt) return '';
              if (currentZoomRef.current >= EVENT_LABEL_ZOOM) return evt.event;
              return evt.id === selectedEventIdRef.current ? evt.event : '';
            },
          },
          labelLayout: { hideOverlap: true },
        },
        // 1: World effectScatter
        {
          id: 'world-events',
          name: '世界历史',
          type: 'effectScatter',
          coordinateSystem: 'geo',
          zlevel: 2,
          data: [],
          symbol: DIAMOND_SYMBOL,
          symbolSize: 18,
          rippleEffect: {
            brushType: 'stroke',
            period: 6,
            scale: 3.5,
            number: 2,
            color: 'rgba(201,169,110,0.35)',
          },
          itemStyle: {
            color: WORLD_COLOR,
            shadowBlur: 14,
            shadowColor: 'rgba(201,169,110,0.5)',
          },
          label: {
            show: true,
            position: 'right',
            distance: 8,
            fontSize: 11,
            color: '#1a2a3a',
            textShadowColor: 'rgba(255,255,255,0.9)',
            textShadowBlur: 3,
            formatter: (p: { data?: { evt?: HistoryEvent } }) => {
              const evt = p.data?.evt;
              if (!evt) return '';
              if (currentZoomRef.current >= EVENT_LABEL_ZOOM) return evt.event;
              return evt.id === selectedEventIdRef.current ? evt.event : '';
            },
          },
          labelLayout: { hideOverlap: true },
        },
        // 2: Clickable hitbox (both)
        {
          type: 'scatter',
          coordinateSystem: 'geo',
          zlevel: 3,
          data: [],
          symbol: 'circle',
          symbolSize: 30,
          itemStyle: { color: 'rgba(0,0,0,0)' },
          label: { show: false },
          silent: false,
        },
        // 3: Path lines
        {
          id: 'path-lines',
          type: 'lines',
          coordinateSystem: 'geo',
          zlevel: 1,
          data: [],
          polyline: true,
          lineStyle: {
            color: CHINA_COLOR,
            width: 2,
            opacity: 0.5,
            type: 'dashed',
            curveness: 0,
          },
          effect: {
            show: true,
            period: 6,
            trailLength: 0.3,
            symbol: 'arrow',
            symbolSize: 7,
            color: '#ff6b50',
          },
          silent: true,
        },
        // 4: Rivers
        {
          type: 'lines',
          coordinateSystem: 'geo',
          zlevel: 0,
          polyline: true,
          data: [],
          lineStyle: {
            color: RIVER_COLOR,
            width: 1.2,
            opacity: 0.6,
            type: 'solid',
          },
          silent: true,
        },
        // 5: Mountains / ranges
        {
          type: 'scatter',
          coordinateSystem: 'geo',
          zlevel: 1,
          data: [],
          symbol: 'triangle',
          symbolSize: 10,
          itemStyle: { color: MOUNTAIN_COLOR, opacity: 0.85 },
          label: {
            show: true,
            // Only show text for mountain range labels (type === 'range')
            formatter: (p: { data?: { isRange?: boolean; zh?: string; name?: string } }) =>
              p.data?.isRange ? (p.data.zh ?? p.data.name ?? '') : '',
            fontSize: 9,
            color: '#3d2a10',
            textShadowColor: 'rgba(255,255,255,0.85)',
            textShadowBlur: 2,
            position: 'top',
            distance: 3,
          },
          silent: true,
        },
        // 6: Direct cause relationship lines
        {
          type: 'lines',
          coordinateSystem: 'geo',
          zlevel: 1,
          data: [],
          polyline: false,
          lineStyle: {
            color: CAUSE_COLOR,
            width: 2,
            opacity: 0.7,
            type: 'solid',
            curveness: 0.2,
          },
          effect: {
            show: true,
            period: 4,
            trailLength: 0.2,
            symbol: 'arrow',
            symbolSize: 8,
            color: CAUSE_COLOR,
          },
          silent: false,
        },
        // 7: Influence relationship lines
        {
          type: 'lines',
          coordinateSystem: 'geo',
          zlevel: 1,
          data: [],
          polyline: false,
          lineStyle: {
            color: INFLUENCE_COLOR,
            width: 1.5,
            opacity: 0.55,
            type: 'dashed',
            curveness: 0.15,
          },
          effect: {
            show: true,
            period: 5,
            trailLength: 0.15,
            symbol: 'arrow',
            symbolSize: 6,
            color: INFLUENCE_COLOR,
          },
          silent: false,
        },
        // 8: Province border lines（由 loadChinaProvinces 填充）
        {
          id: 'province-lines',
          type: 'lines',
          coordinateSystem: 'geo',
          geoIndex: 0,
          zlevel: 1,
          polyline: true,
          data: [],
          lineStyle: {
            color: '#5a8a6a',
            width: 0.7,
            opacity: 0.75,
          },
          silent: true,
        },
        // 9: Province name labels（由 loadChinaProvinces 填充）
        {
          id: 'province-names',
          type: 'scatter',
          coordinateSystem: 'geo',
          geoIndex: 0,
          zlevel: 2,
          data: [],
          symbol: 'none',
          symbolSize: 0,
          label: {
            show: false,
            color: '#2a4a3a',
            fontSize: 10,
            textShadowColor: 'rgba(255,255,255,0.9)',
            textShadowBlur: 3,
            formatter: (p: { data?: { name?: string } }) => p.data?.name ?? '',
          },
          silent: true,
        },
      ],
    });

    // 从容器尺寸计算正确的 zoom 换算比例
    if (containerRef.current) {
      zoomRatioRef.current = computeZoomRatio(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight,
      );
    }

    // 后台加载中国省份地图，注册成功后追加 china-geo（避免初始化时引用未注册地图）
    ensureChinaMap().then((chinaReady) => {
      if (disposed || !chinaReady) return;
      chinaMapReadyRef.current = true;
      // 追加 china-geo 到 geo 数组（index 1）
      chart.setOption({
        geo: [
          { id: 'world-geo' },  // 明确指定 id，保持不变
          {
            id: 'china-geo',
            map: 'china',
            roam: false,
            silent: true,
            show: false,
            center: currentCenterRef.current,
            zoom: currentZoomRef.current * zoomRatioRef.current,
            scaleLimit: { min: 0.1, max: 1000 },
            itemStyle: {
              areaColor: 'transparent',
              borderColor: '#5a8a6a',
              borderWidth: 0.8,
            },
            emphasis: { disabled: true },
            label: {
              show: false,
              color: '#2a4a3a',
              fontSize: 10,
              textShadowColor: 'rgba(255,255,255,0.9)',
              textShadowBlur: 3,
            },
            select: { disabled: true },
          },
        ],
      });
      // 已有缩放级别达到阈值时立刻显示
      if (currentZoomRef.current >= PROVINCE_BORDER_ZOOM) {
        updateChinaOverlay(chart, currentZoomRef.current, currentCenterRef.current, zoomRatioRef.current);
      }

      // 同步加载省界线/省份标签数据（与 china-geo 使用同一份 GeoJSON）
      loadChinaProvinces().then((pd) => {
        if (disposed) return;
        provinceDataRef.current = pd;
        updateProvinceOverlay(currentZoomRef.current);
      }).catch(() => {
        console.warn('省界线数据加载失败，已由 china-geo 降级处理');
      });
    });

    // 按当前缩放级别显示/隐藏省界线和省份名称标签
    const updateProvinceOverlay = (wZoom: number) => {
      const pd = provinceDataRef.current;
      if (!pd) return;
      const showBorders = wZoom >= PROVINCE_BORDER_ZOOM;
      const showNames = wZoom >= PROVINCE_NAME_ZOOM;
      chart.setOption({
        series: [
          { id: 'province-lines', data: showBorders ? pd.lines : [] },
          { id: 'province-names', data: showNames ? pd.names : [], label: { show: showNames } },
        ],
      });
    };

    // Click handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chart.on('click', 'series', (params: any) => {
      if (params.data?.evt) {
        onEventClick(params.data.evt, {
          x: params.event?.offsetX ?? 0,
          y: params.event?.offsetY ?? 0,
        });
      }
    });

    // Hover: show path only for the hovered event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chart.on('mouseover', 'series', (params: any) => {
      const evt = params.data?.evt as HistoryEvent | undefined;
      if (evt?.path && (evt.path as [number, number][]).length > 0) {
        chart.setOption({
          series: [{ id: 'path-lines', data: [{ coords: evt.path, evt }] }],
        });
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chart.on('mouseout', 'series', (_params: any) => {
      chart.setOption({
        series: [{ id: 'path-lines', data: [] }],
      });
    });

    // georoam: 缩放/平移时同步 china-geo 的视口并按缩放级别决定是否显示
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chart.on('georoam', (event: any) => {
      // 只处理 world-geo (geoIndex=0) 的缩放/平移事件
      if (event.geoIndex !== 0) return;
      if (event.roamType === 'zoom' && typeof event.zoom === 'number') {
        currentZoomRef.current *= event.zoom;
      } else if (event.roamType === 'move' && containerRef.current) {
        // 用 dx/dy 像素偏移量换算地理坐标偏移，避免依赖 getOption() 的延迟
        // 使用 min(w/360, h/145) 匹配 ECharts 等经纬度投影缩放基准
        const pxPerDeg = Math.min(
          containerRef.current.clientWidth / 360,
          containerRef.current.clientHeight / 145,
        ) * currentZoomRef.current;
        currentCenterRef.current = [
          currentCenterRef.current[0] - (event.dx as number) / pxPerDeg,
          currentCenterRef.current[1] + (event.dy as number) / pxPerDeg,
        ];
      }
      if (chinaMapReadyRef.current) {
        updateChinaOverlay(chart, currentZoomRef.current, currentCenterRef.current, zoomRatioRef.current);
      }
      updateProvinceOverlay(currentZoomRef.current);
    });

    const handleResize = () => {
      chart.resize();
      // 容器尺寸变化时重新计算比例并立即同步覆盖层
      if (containerRef.current) {
        zoomRatioRef.current = computeZoomRatio(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight,
        );
      }
      if (chinaMapReadyRef.current) {
        updateChinaOverlay(chart, currentZoomRef.current, currentCenterRef.current, zoomRatioRef.current);
      }
      updateProvinceOverlay(currentZoomRef.current);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update data when maxYear / filter changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const { china, world, all } = buildData();
    const { cause: causeData, influence: influenceData } = buildRelationshipData();
    const allDisplayData = withDisplayOffsets(all);
    chart.setOption({
      series: [
        { data: china },
        { data: world },
        { data: allDisplayData },
        { id: 'path-lines', data: [] },
        {
          data: showRivers
            ? rivers.map((r) => ({ coords: r.coords }))
            : [],
        },
        {
          data: showMountains
            ? mountains.map((m) => ({
                value: m.coords,
                name: m.zh ?? m.name,
                zh: m.zh,
                isRange: m.type === 'range',
              }))
            : [],
        },
        { data: causeData },
        { data: influenceData },
      ],
    });
  }, [buildData, buildRelationshipData, showRivers, showMountains, rivers, mountains]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: `calc(100vh - ${bottomInset}px)` }}
    />
  );
}

