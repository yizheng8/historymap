import { useCallback, useRef, useMemo } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { EVENT_YEARS, HISTORY_EVENTS } from '@/data/events';
import { CHINA_COLOR, WORLD_COLOR } from '@/data/constants';

// Historical era definitions with unique colors
const ERA_DEFS = [
  { id: 'xianqin',  label: '先秦',     start: -2700, end: -222,  color: '#5d9e52' },
  { id: 'qinhan',   label: '秦汉',     start: -221,  end: 220,   color: '#c87840' },
  { id: 'zhonggu',  label: '魏晋—宋元', start: 221,   end: 1368,  color: '#4a88c0' },
  { id: 'mingqing', label: '明清',     start: 1369,  end: 1839,  color: '#a07038' },
  { id: 'modern',   label: '近现代',   start: 1840,  end: 2100,  color: '#b03838' },
] as const;

// Precompute year→category map outside render
const yearCatMap = new Map<number, 'china' | 'world' | 'both'>();
for (const y of EVENT_YEARS) {
  const evts = HISTORY_EVENTS.filter((e) => e.year === y);
  const hasChina = evts.some((e) => e.category === 'china');
  const hasWorld = evts.some((e) => e.category === 'world');
  yearCatMap.set(y, hasChina && hasWorld ? 'both' : hasWorld ? 'world' : 'china');
}

// Density histogram: 48 equal buckets across EVENT_YEARS
const N_BUCKETS = 48;
const LAST_IDX = EVENT_YEARS.length - 1;

interface DensityBucket { startPct: number; widthPct: number; count: number }
const densityBuckets: DensityBucket[] = Array.from({ length: N_BUCKETS }, (_, bi) => {
  const s = Math.round((bi / N_BUCKETS) * LAST_IDX);
  const e = Math.min(LAST_IDX, Math.round(((bi + 1) / N_BUCKETS) * LAST_IDX) - 1);
  return {
    startPct: (s / LAST_IDX) * 100,
    widthPct: ((Math.max(e, s) - s + 1) / (LAST_IDX + 1)) * 100,
    count: EVENT_YEARS.slice(s, e + 1).length,
  };
});
const maxBucketCount = Math.max(...densityBuckets.map((b) => b.count), 1);

interface Props {
  startIndex: number;
  endIndex: number;
  onRangeChange: (start: number, end: number) => void;
  height?: number;
}

const formatYear = (y: number) => (y < 0 ? `前 ${Math.abs(y)} 年` : `${y} 年`);

export default function Timeline({ startIndex, endIndex, onRangeChange, height = 175 }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  // 'start' | 'end' | null
  const draggingRef = useRef<'start' | 'end' | null>(null);

  // Resolve era first/last indices once
  const eraData = useMemo(() =>
    ERA_DEFS.map((era) => {
      const firstIdx = EVENT_YEARS.findIndex((y) => y >= era.start && y <= era.end);
      const lastIdx = EVENT_YEARS.reduce(
        (acc, y, i) => (y >= era.start && y <= era.end ? i : acc), -1,
      );
      return { ...era, firstIdx, lastIdx };
    }).filter((e) => e.firstIdx >= 0),
    [],
  );

  const getIdxFromX = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(pct * LAST_IDX);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const clickPct = (e.clientX - rect.left) / rect.width;
      const startPct = startIndex / LAST_IDX;
      const endPct = endIndex / LAST_IDX;
      // Pick the nearest handle
      draggingRef.current =
        Math.abs(clickPct - startPct) <= Math.abs(clickPct - endPct) ? 'start' : 'end';
      trackRef.current?.setPointerCapture(e.pointerId);
      const idx = getIdxFromX(e.clientX);
      if (draggingRef.current === 'start') {
        onRangeChange(Math.min(idx, endIndex), endIndex);
      } else {
        onRangeChange(startIndex, Math.max(idx, startIndex));
      }
    },
    [getIdxFromX, startIndex, endIndex, onRangeChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      const idx = getIdxFromX(e.clientX);
      if (draggingRef.current === 'start') {
        onRangeChange(Math.min(idx, endIndex), endIndex);
      } else {
        onRangeChange(startIndex, Math.max(idx, startIndex));
      }
    },
    [getIdxFromX, startIndex, endIndex, onRangeChange],
  );

  const handlePointerUp = useCallback(() => { draggingRef.current = null; }, []);

  const n = LAST_IDX;
  const startPct = (startIndex / n) * 100;
  const endPct = (endIndex / n) * 100;
  const startYear = EVENT_YEARS[startIndex];
  const endYear = EVENT_YEARS[endIndex];

  const startEra = eraData.find((era) => startYear >= era.start && startYear <= era.end);
  const endEra = eraData.find((era) => endYear >= era.start && endYear <= era.end);
  const isSingleEra = startEra && endEra && startEra.id === endEra.id;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height,
        zIndex: 30,
        background:
          'linear-gradient(to top, rgba(240,246,252,0.97) 65%, rgba(240,246,252,0) 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        px: { xs: 1.25, sm: 3, md: 5 },
        pb: 2,
      }}
    >
      {/* Range year display + legend */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: startEra?.color ?? CHINA_COLOR, lineHeight: 1 }}>
          {formatYear(startYear)}
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#8aaabb', fontWeight: 300 }}>—</Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: endEra?.color ?? CHINA_COLOR, lineHeight: 1 }}>
          {formatYear(endYear)}
        </Typography>
        {isSingleEra && (
          <Typography sx={{ fontSize: 11, color: '#7a9aaa', fontWeight: 500, letterSpacing: 0.5 }}>
            {startEra!.label}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: CHINA_COLOR }} />
            <Typography sx={{ fontSize: 10, color: '#546e7a' }}>中国</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '2px', background: WORLD_COLOR, transform: 'rotate(45deg)' }} />
            <Typography sx={{ fontSize: 10, color: '#546e7a' }}>世界</Typography>
          </Box>
        </Box>
      </Box>

      {/* Era navigation chips — click to jump to that era's full range */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 1 }}>
        {eraData.map((era) => {
          const inRange =
            startYear <= era.end && endYear >= era.start;
          return (
            <Chip
              key={era.id}
              label={era.label}
              size="small"
              onClick={() => onRangeChange(era.firstIdx, era.lastIdx)}
              sx={{
                fontSize: 11,
                height: 22,
                cursor: 'pointer',
                background: inRange ? `${era.color}28` : 'rgba(180,210,228,0.25)',
                color: inRange ? era.color : '#7a9aaa',
                border: `1px solid ${inRange ? era.color + '70' : 'transparent'}`,
                fontWeight: inRange ? 700 : 400,
                transition: 'all 0.25s',
                '&:hover': { background: `${era.color}20` },
              }}
            />
          );
        })}
      </Box>

      {/* Track */}
      <Box
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        sx={{
          position: 'relative',
          width: { xs: '96%', sm: '92%', md: '85%' },
          maxWidth: 1000,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          cursor: 'crosshair',
          userSelect: 'none',
        }}
      >
        {/* Base track rail */}
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 3,
          transform: 'translateY(-50%)',
          background: 'rgba(160,190,210,0.30)',
          borderRadius: 2,
        }} />

        {/* Era colored band segments */}
        {eraData.map((era) => {
          const leftPct = (era.firstIdx / n) * 100;
          const widthPct = ((era.lastIdx - era.firstIdx) / n) * 100;
          return (
            <Box key={`band-${era.id}`} sx={{
              position: 'absolute',
              top: '50%',
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              height: 3,
              transform: 'translateY(-50%)',
              background: era.color,
              opacity: 0.4,
              borderRadius: 1,
              pointerEvents: 'none',
            }} />
          );
        })}

        {/* Event density histogram bars (above the rail) */}
        {densityBuckets.map((bucket, bi) => {
          const barH = Math.max(2, (bucket.count / maxBucketCount) * 16);
          const bucketMidPct = bucket.startPct + bucket.widthPct / 2;
          const inSelectedRange =
            bucketMidPct >= startPct && bucketMidPct <= endPct;
          return (
            <Box key={`d-${bi}`} sx={{
              position: 'absolute',
              bottom: 'calc(50% + 3px)',
              left: `${bucket.startPct}%`,
              width: `${Math.max(bucket.widthPct - 0.3, 0.3)}%`,
              height: barH,
              background: inSelectedRange
                ? 'rgba(70,130,180,0.50)'
                : 'rgba(140,175,200,0.22)',
              borderRadius: '1px 1px 0 0',
              pointerEvents: 'none',
              transition: 'background 0.3s',
            }} />
          );
        })}

        {/* Selected range fill on the rail */}
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: `${startPct}%`,
          width: `${Math.max(endPct - startPct, 0)}%`,
          height: 5,
          transform: 'translateY(-50%)',
          background: 'rgba(70,130,180,0.40)',
          borderRadius: 3,
          pointerEvents: 'none',
          zIndex: 2,
        }} />

        {/* Era boundary ticks */}
        {eraData.map((era, ei) => {
          if (ei === 0) return null;
          const pct = (era.firstIdx / n) * 100;
          return (
            <Box key={`tick-${era.id}`} sx={{
              position: 'absolute',
              top: '50%',
              left: `${pct}%`,
              transform: 'translate(-50%, -50%)',
              width: 1,
              height: 16,
              background: '#a8c0cc',
              opacity: 0.7,
              zIndex: 1,
              pointerEvents: 'none',
            }} />
          );
        })}

        {/* Era labels below the rail */}
        {eraData.map((era) => {
          const midPct = ((era.firstIdx + era.lastIdx) / 2 / n) * 100;
          const isInRange = startYear <= era.end && endYear >= era.start;
          return (
            <Typography key={`lbl-${era.id}`} sx={{
              position: 'absolute',
              bottom: 2,
              left: `${midPct}%`,
              transform: 'translateX(-50%)',
              fontSize: 9,
              fontWeight: isInRange ? 600 : 400,
              color: isInRange ? era.color : '#b0c8d8',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              transition: 'color 0.3s, font-weight 0.3s',
            }}>
              {era.label}
            </Typography>
          );
        })}

        {/* START handle */}
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: `${startPct}%`,
          transform: 'translate(-50%, -50%)',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: startEra?.color ?? CHINA_COLOR,
          border: '2.5px solid rgba(255,255,255,0.9)',
          boxShadow: `0 0 0 2px ${(startEra?.color ?? CHINA_COLOR) + '55'}, 0 2px 6px rgba(0,0,0,0.18)`,
          zIndex: 6,
          cursor: 'grab',
          transition: 'box-shadow 0.2s',
          '&:hover': {
            boxShadow: `0 0 0 4px ${(startEra?.color ?? CHINA_COLOR) + '40'}, 0 2px 8px rgba(0,0,0,0.22)`,
          },
        }} />

        {/* END handle */}
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: `${endPct}%`,
          transform: 'translate(-50%, -50%)',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: endEra?.color ?? CHINA_COLOR,
          border: '2.5px solid rgba(255,255,255,0.9)',
          boxShadow: `0 0 0 2px ${(endEra?.color ?? CHINA_COLOR) + '55'}, 0 2px 6px rgba(0,0,0,0.18)`,
          zIndex: 6,
          cursor: 'grab',
          transition: 'box-shadow 0.2s',
          '&:hover': {
            boxShadow: `0 0 0 4px ${(endEra?.color ?? CHINA_COLOR) + '40'}, 0 2px 8px rgba(0,0,0,0.22)`,
          },
        }} />

        {/* Year label above start handle */}
        <Typography sx={{
          position: 'absolute',
          top: 'calc(50% - 24px)',
          left: `${startPct}%`,
          transform: 'translateX(-50%)',
          fontSize: 10,
          fontWeight: 600,
          color: startEra?.color ?? CHINA_COLOR,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          background: 'rgba(240,246,252,0.88)',
          px: 0.5,
          borderRadius: 0.5,
          zIndex: 7,
        }}>
          {formatYear(startYear)}
        </Typography>

        {/* Year label above end handle — hide if too close to start */}
        {endPct - startPct > 5 && (
          <Typography sx={{
            position: 'absolute',
            top: 'calc(50% - 24px)',
            left: `${endPct}%`,
            transform: 'translateX(-50%)',
            fontSize: 10,
            fontWeight: 600,
            color: endEra?.color ?? CHINA_COLOR,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            background: 'rgba(240,246,252,0.88)',
            px: 0.5,
            borderRadius: 0.5,
            zIndex: 7,
          }}>
            {formatYear(endYear)}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

