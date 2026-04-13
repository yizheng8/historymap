import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, CircularProgress, IconButton, Tooltip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import HistoryMap from '@/components/HistoryMap';
import Timeline from '@/components/Timeline';
import EventCard from '@/components/EventCard';
import SettingsDialog from '@/components/SettingsDialog';
import { ensureWorldMap } from '@/utils/mapLoader';
import { loadRivers, loadMountains } from '@/utils/geoFeatureLoader';
import { EVENT_YEARS, HISTORY_EVENTS, ALL_FIGURES, type HistoryEvent } from '@/data/events';
import { CHINA_COLOR, WORLD_COLOR, RIVER_COLOR, MOUNTAIN_COLOR } from '@/data/constants';
import { RELATIONSHIPS } from '@/data/relationships';
import type { RiverSegment, MountainFeature } from '@/data/geoFeatures';

type CategoryFilter = 'all' | 'china' | 'world';
const TIMELINE_HEIGHT = 175;

export default function App() {
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(EVENT_YEARS.length - 1);
  const [selectedEvent, setSelectedEvent] = useState<HistoryEvent | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [figureFilter, setFigureFilter] = useState<string | null>(null);
  const [showRivers, setShowRivers] = useState(false);
  const [showMountains, setShowMountains] = useState(false);
  const [showRelationships, setShowRelationships] = useState(false);
  const [rivers, setRivers] = useState<RiverSegment[]>([]);
  const [mountains, setMountains] = useState<MountainFeature[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    ensureWorldMap()
      .then(() => setMapReady(true))
      .catch((err: Error) => setMapError(err.message));
  }, []);

  // Lazy-load river data the first time the layer is toggled on
  useEffect(() => {
    if (showRivers && rivers.length === 0) {
      loadRivers().then(setRivers).catch(console.error);
    }
  }, [showRivers, rivers.length]);

  // Lazy-load mountain data the first time the layer is toggled on
  useEffect(() => {
    if (showMountains && mountains.length === 0) {
      loadMountains().then(setMountains).catch(console.error);
    }
  }, [showMountains, mountains.length]);

  const handleEventClick = useCallback(
    (event: HistoryEvent, _mouseEvent: { x: number; y: number }) => {
      setSelectedEvent(event);
      setCardOpen(true);
    },
    [],
  );

  const handleCloseCard = useCallback(() => setCardOpen(false), []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setStartIndex((s) => Math.max(0, s - 1));
        setEndIndex((en) => Math.max(1, en - 1));
      }
      if (e.key === 'ArrowRight') {
        setStartIndex((s) => Math.min(EVENT_YEARS.length - 2, s + 1));
        setEndIndex((en) => Math.min(EVENT_YEARS.length - 1, en + 1));
      }
      if (e.key === 'Escape') setCardOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const minYear = EVENT_YEARS[startIndex];
  const maxYear = EVENT_YEARS[endIndex];
  const visibleEvents = HISTORY_EVENTS.filter(
    (e) =>
      e.year >= minYear && e.year <= maxYear &&
      (categoryFilter === 'all' || e.category === categoryFilter) &&
      (!figureFilter || e.figures?.includes(figureFilter)),
  );
  const chinaCount = visibleEvents.filter((e) => e.category === 'china').length;
  const worldCount = visibleEvents.filter((e) => e.category === 'world').length;

  // Loading / error state
  if (!mapReady) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        {mapError ? (
          <Typography sx={{ color: '#7a9aaa', fontSize: 18, letterSpacing: 4 }}>
            {mapError}
          </Typography>
        ) : (
          <>
            <CircularProgress sx={{ color: '#1565c0' }} />
            <Typography
              sx={{ color: '#7a9aaa', fontSize: 18, letterSpacing: 6 }}
            >
              舆图绘制中
            </Typography>
          </>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Vignette overlay */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 3,
          background: 'radial-gradient(ellipse at 50% 45%, transparent 50%, rgba(140,180,210,0.25) 100%)',
        }}
      />

      {/* Title bar */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 64,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(to bottom, rgba(240,246,252,0.96), rgba(240,246,252,0))',
          pointerEvents: 'none',
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: 26,
            letterSpacing: 10,
            fontWeight: 700,
            color: '#1a3a5a',
            textShadow:
              '0 1px 3px rgba(255,255,255,0.8), 0 2px 6px rgba(0,0,0,0.12)',
          }}
        >
          中外历史对比地图
        </Typography>
        <Typography
          sx={{
            fontSize: 12,
            letterSpacing: 3,
            color: '#546e7a',
            ml: 2.25,
            mt: 0.75,
          }}
        >
          1840 — 1949 · 人教版核心考点
        </Typography>
      </Box>

      {/* Category filter buttons */}
      <Box
        sx={{
          position: 'fixed',
          top: { xs: 10, sm: 14 },
          left: { xs: 10, sm: 20 },
          right: { xs: 56, sm: 72 },
          zIndex: 20,
          display: 'flex',
          flexWrap: { xs: 'nowrap', md: 'wrap' },
          gap: 1,
          overflowX: { xs: 'auto', md: 'visible' },
          overflowY: 'hidden',
          pr: 0.5,
          pb: 0.5,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        }}
      >
        {(['all', 'china', 'world'] as CategoryFilter[]).map((cat) => {
          const label = cat === 'all' ? '全部' : cat === 'china' ? '中国' : '世界';
          const color =
            cat === 'china' ? CHINA_COLOR : cat === 'world' ? WORLD_COLOR : '#c9a96e';
          const isActive = categoryFilter === cat;
          return (
            <Box
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 1.5,
                fontSize: 12,
                letterSpacing: 1,
                cursor: 'pointer',
                border: `1px solid ${isActive ? color : 'rgba(80,120,160,0.25)'}`,
                background: isActive ? `${color}22` : 'rgba(255,255,255,0.85)',
                color: isActive ? color : '#546e7a',
                transition: 'all 0.2s',
                '&:hover': {
                  border: `1px solid ${color}88`,
                  color,
                },
              }}
            >
              {label}
            </Box>
          );
        })}

        {/* Separator */}
        <Box sx={{ width: '1px', background: 'rgba(80,120,160,0.2)', mx: 0.5 }} />

        {/* Figure filter */}
        <Box
          component="select"
          value={figureFilter ?? ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setFigureFilter(e.target.value || null)
          }
          sx={{
            fontSize: 12,
            letterSpacing: 0.5,
            color: figureFilter ? '#1a5a8a' : '#546e7a',
            background: figureFilter ? 'rgba(26,90,138,0.10)' : 'rgba(255,255,255,0.85)',
            border: `1px solid ${figureFilter ? 'rgba(26,90,138,0.55)' : 'rgba(80,120,160,0.25)'}`,
            borderRadius: '6px',
            px: 1.5,
            py: 0.5,
            cursor: 'pointer',
            outline: 'none',
            '&:hover': {
              border: '1px solid rgba(26,90,138,0.45)',
            },
          }}
        >
          <option value="">人物：全部</option>
          {ALL_FIGURES.map((fig) => (
            <option key={fig} value={fig}>{fig}</option>
          ))}
        </Box>

        {/* Separator */}
        <Box sx={{ width: '1px', background: 'rgba(80,120,160,0.2)', mx: 0.5 }} />

        {/* Geographic layer toggles */}
        {([
          { key: 'rivers',        label: '河流', color: RIVER_COLOR,    active: showRivers,         toggle: () => setShowRivers((v) => !v) },
          { key: 'mountains',     label: '山脉', color: MOUNTAIN_COLOR, active: showMountains,      toggle: () => setShowMountains((v) => !v) },
          { key: 'relationships', label: '因果', color: '#ff6b50',     active: showRelationships, toggle: () => setShowRelationships((v) => !v) },
        ] as const).map(({ key, label, color, active, toggle }) => (
          <Box
            key={key}
            onClick={toggle}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1.5,
              fontSize: 12,
              letterSpacing: 1,
              cursor: 'pointer',
              border: `1px solid ${active ? color : 'rgba(80,120,160,0.25)'}`,
              background: active ? `${color}22` : 'rgba(255,255,255,0.85)',
              color: active ? color : '#546e7a',
              transition: 'all 0.2s',
              '&:hover': {
                border: `1px solid ${color}88`,
                color,
              },
            }}
          >
            {label}
          </Box>
        ))}
      </Box>

      {/* Settings button */}
      <Tooltip title="AI 配置" placement="left">
        <IconButton
          onClick={() => setSettingsOpen(true)}
          size="small"
          sx={{
            position: 'fixed',
            top: 14,
            right: 20,
            zIndex: 20,
            color: '#78909c',
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(80,120,160,0.2)',
            borderRadius: 1.5,
            '&:hover': { color: '#1565c0', background: 'rgba(255,255,255,1)' },
          }}
        >
          <SettingsIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      {/* Counter */}
      <Box
        sx={{
          position: 'fixed',
          top: 60,
          right: 24,
          zIndex: 20,
          fontSize: 12,
          color: '#546e7a',
          letterSpacing: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 0.25,
        }}
      >
        <Typography sx={{ fontSize: 12, color: '#6a5a3a' }}>
          <Box component="span" sx={{ color: CHINA_COLOR, fontWeight: 700 }}>中 {chinaCount}</Box>
          {' · '}
          <Box component="span" sx={{ color: WORLD_COLOR, fontWeight: 700 }}>世 {worldCount}</Box>
        </Typography>
      </Box>

      {/* Map */}
      <HistoryMap
        minYear={minYear}
        maxYear={maxYear}
        categoryFilter={categoryFilter}
        figureFilter={figureFilter}
        bottomInset={TIMELINE_HEIGHT}
        onEventClick={handleEventClick}
        showRivers={showRivers}
        showMountains={showMountains}
        rivers={rivers}
        mountains={mountains}
        showRelationships={showRelationships}
        relationships={RELATIONSHIPS}
        selectedEventId={selectedEvent?.id ?? null}
      />

      {/* Event card dialog */}
      <EventCard
        event={selectedEvent}
        open={cardOpen}
        onClose={handleCloseCard}
        onEventNavigate={(evt) => {
          setSelectedEvent(evt);
          setCardOpen(true);
        }}
      />

      {/* Timeline */}
      <Timeline
        startIndex={startIndex}
        endIndex={endIndex}
        onRangeChange={(s, e) => { setStartIndex(s); setEndIndex(e); }}
        height={TIMELINE_HEIGHT}
      />

      {/* AI Settings dialog */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
}
