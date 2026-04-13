import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  Fade,
  Box,
  Divider,
  TextField,
  CircularProgress,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PlaceIcon from '@mui/icons-material/Place';
import SendIcon from '@mui/icons-material/Send';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import PublicIcon from '@mui/icons-material/Public';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import type { HistoryEvent } from '@/data/events';
import { streamChat, type ChatMessage } from '@/utils/aiChat';
import { isAiConfigured } from '@/utils/aiConfig';
import { CHINA_COLOR, WORLD_COLOR, CAUSE_COLOR, INFLUENCE_COLOR } from '@/data/constants';
import { getCauses, getEffects, getParallels, EVENT_MAP } from '@/data/relationships';

interface Props {
  event: HistoryEvent | null;
  open: boolean;
  onClose: () => void;
  onEventNavigate: (event: HistoryEvent) => void;
}

export default function EventCard({ event, open, onClose, onEventNavigate }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Reset chat when event changes
  useEffect(() => {
    setMessages([]);
    setInput('');
    setLoading(false);
    setChatStarted(false);
    setSuggestedQuestions([]);
    abortRef.current?.abort();
  }, [event?.event]);

  // Auto scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!event || !text.trim() || loading) return;

      if (!isAiConfigured()) {
        setMessages([{
          role: 'assistant',
          content: '⚙ 请先点击右上角**设置图标**配置 AI 接口（Base URL、API Key、Model），保存后即可使用 AI 讲解功能。',
        }]);
        setChatStarted(true);
        return;
      }

      setSuggestedQuestions([]);
      const userMsg: ChatMessage = { role: 'user', content: text.trim() };
      const newHistory = [...messages, userMsg];
      setMessages(newHistory);
      setInput('');
      setLoading(true);

      const ac = new AbortController();
      abortRef.current = ac;

      let assistantContent = '';
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      try {
        await streamChat(
          event.ai_prompt,
          newHistory,
          (delta) => {
            assistantContent += delta;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
              return updated;
            });
          },
          ac.signal,
        );
        // Parse suggested questions and clean content
        const qMatch = assistantContent.match(/<questions>([\s\S]*?)<\/questions>/);
        if (qMatch) {
          const qs = qMatch[1].trim().split('\n').map((q) => q.trim()).filter(Boolean);
          setSuggestedQuestions(qs);
          const cleanContent = assistantContent.replace(/<questions>[\s\S]*?<\/questions>/, '').trimEnd();
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: cleanContent };
            return updated;
          });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: '⚠ 讲解加载失败，请检查网络或 API 配置。',
            };
            return updated;
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [event, messages, loading],
  );

  const handleStartChat = useCallback(() => {
    setChatStarted(true);
    sendMessage('请开始介绍这段历史。');
  }, [sendMessage]);

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!event) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={Fade}
      sx={{
        '& .MuiDialog-container': {
          justifyContent: { xs: 'center', md: 'flex-end' },
          alignItems: 'center',
          pr: { xs: 0.5, md: 2 },
          pl: { xs: 0.5, md: 1 },
        },
      }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(140,180,210,0.4)' } },
        paper: {
          sx: {
            background: '#ffffff',
            border: '1px solid rgba(80,120,160,0.2)',
            borderRadius: 2.5,
            boxShadow:
              '0 12px 48px rgba(0,0,0,0.18), 0 0 1px rgba(80,120,160,0.2)',
            width: { xs: '92vw', sm: 560, md: 580 },
            maxWidth: { xs: '92vw', md: '48vw' },
            maxHeight: '90vh',
            p: 0,
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      <DialogContent
        sx={{
          p: { xs: '20px 16px 14px', sm: '24px 24px 16px' },
          position: 'relative',
          flex: 'none',
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 12,
            color: '#78909c',
            '&:hover': { color: '#1565c0' },
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* Category badge */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.25,
            mb: 1,
            borderRadius: 1,
            border: `1px solid ${event.category === 'china' ? CHINA_COLOR : WORLD_COLOR}44`,
            background: `${event.category === 'china' ? CHINA_COLOR : WORLD_COLOR}18`,
          }}
        >
          {event.category === 'world'
            ? <PublicIcon sx={{ fontSize: 12, color: WORLD_COLOR }} />
            : <PlaceIcon sx={{ fontSize: 12, color: CHINA_COLOR }} />}
          <Typography
            sx={{ fontSize: 11, color: event.category === 'china' ? CHINA_COLOR : WORLD_COLOR, letterSpacing: 1 }}
          >
            {event.category === 'china' ? '中国历史' : `世界历史${event.region ? ' · ' + event.region : ''}`}
          </Typography>
        </Box>

        <Typography
          sx={{
            fontSize: 42,
            fontWeight: 800,
            lineHeight: 1,
            color: event.category === 'china' ? CHINA_COLOR : WORLD_COLOR,
            textShadow: `0 0 28px ${event.category === 'china' ? 'rgba(232,72,48,0.45)' : 'rgba(201,169,110,0.4)'}`,
          }}
        >
          {(() => {
            const fmt = (y: number) => y < 0 ? `前 ${Math.abs(y)} 年` : `${y} 年`;
            return event.yearEnd ? `${fmt(event.year)} — ${fmt(event.yearEnd)}` : fmt(event.year);
          })()}
        </Typography>

        <Typography
          sx={{ fontSize: 22, fontWeight: 700, color: '#1a2a3a', mt: 0.75, mb: 0.25 }}
        >
          {event.event}
        </Typography>

        <Typography
          sx={{
            fontSize: 13,
            color: '#546e7a',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <PlaceIcon sx={{ fontSize: 16 }} />
          {event.location}
        </Typography>

        {event.figures && event.figures.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.25 }}>
            {event.figures.map((fig) => (
              <Chip
                key={fig}
                label={fig}
                size="small"
                sx={{
                  height: 22,
                  fontSize: 11,
                  letterSpacing: 0.5,
                  color: '#1a3a5a',
                  background: 'rgba(26,90,138,0.08)',
                  border: '1px solid rgba(26,90,138,0.2)',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            ))}
          </Box>
        )}

        {/* Related events */}
        {(() => {
          const causes = getCauses(event.id);
          const effects = getEffects(event.id);
          const parallels = getParallels(event.id);
          if (causes.length === 0 && effects.length === 0 && parallels.length === 0) return null;
          const RelRow = ({ color, icon, label, relEvent }: { color: string; icon: React.ReactNode; label: string; relEvent: HistoryEvent }) => (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.3 }}>
              {icon}
              <Box>
                <Typography component="span" sx={{ fontSize: 11, color: '#78909c', mr: 0.5 }}>
                  {relEvent.yearEnd ? `${relEvent.year}–${relEvent.yearEnd}` : relEvent.year}
                </Typography>
                <Box
                  component="span"
                  onClick={() => onEventNavigate(relEvent)}
                  sx={{ fontSize: 12, color, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                >
                  {relEvent.event}
                </Box>
                <Typography component="span" sx={{ fontSize: 11, color: '#78909c', ml: 0.75 }}>
                  {label}
                </Typography>
              </Box>
            </Box>
          );
          return (
            <Box sx={{ mt: 1.5, pt: 1.25, borderTop: '1px dashed rgba(80,120,160,0.15)' }}>
              {causes.length > 0 && (
                <Box sx={{ mb: 0.75 }}>
                  <Typography sx={{ fontSize: 10, color: '#78909c', letterSpacing: 1.5, mb: 0.5, textTransform: 'uppercase' }}>前因</Typography>
                  {causes
                    .map((rel) => ({ rel, src: EVENT_MAP.get(rel.sourceId) }))
                    .filter((x): x is { rel: typeof x.rel; src: HistoryEvent } => x.src != null)
                    .sort((a, b) => a.src.year - b.src.year)
                    .map(({ rel, src }) => (
                      <RelRow key={rel.id} color={CAUSE_COLOR} icon={<ArrowForwardIcon sx={{ fontSize: 12, color: CAUSE_COLOR, mt: 0.25, flexShrink: 0 }} />} label={rel.description} relEvent={src} />
                    ))}
                </Box>
              )}
              {effects.length > 0 && (
                <Box sx={{ mb: 0.75 }}>
                  <Typography sx={{ fontSize: 10, color: '#78909c', letterSpacing: 1.5, mb: 0.5, textTransform: 'uppercase' }}>后果</Typography>
                  {effects
                    .map((rel) => ({ rel, tgt: EVENT_MAP.get(rel.targetId) }))
                    .filter((x): x is { rel: typeof x.rel; tgt: HistoryEvent } => x.tgt != null)
                    .sort((a, b) => a.tgt.year - b.tgt.year)
                    .map(({ rel, tgt }) => (
                      <RelRow key={rel.id} color='#ff8c42' icon={<ArrowForwardIcon sx={{ fontSize: 12, color: '#ff8c42', mt: 0.25, flexShrink: 0 }} />} label={rel.description} relEvent={tgt} />
                    ))}
                </Box>
              )}
              {parallels.length > 0 && (
                <Box>
                  <Typography sx={{ fontSize: 10, color: '#78909c', letterSpacing: 1.5, mb: 0.5, textTransform: 'uppercase' }}>同期对比</Typography>
                  {parallels
                    .map((rel) => ({ rel, other: EVENT_MAP.get(rel.sourceId === event.id ? rel.targetId : rel.sourceId) }))
                    .filter((x): x is { rel: typeof x.rel; other: HistoryEvent } => x.other != null)
                    .sort((a, b) => a.other.year - b.other.year)
                    .map(({ rel, other }) => (
                      <RelRow key={rel.id} color={INFLUENCE_COLOR} icon={<SwapHorizIcon sx={{ fontSize: 12, color: INFLUENCE_COLOR, mt: 0.25, flexShrink: 0 }} />} label={rel.description} relEvent={other} />
                    ))}
                </Box>
              )}
            </Box>
          );
        })()}
      </DialogContent>

      <Divider sx={{ borderColor: 'rgba(80,120,160,0.15)' }} />

      {/* Chat area */}
      {!chatStarted ? (
        <Box sx={{ px: 3, py: 2.5, display: 'flex', justifyContent: 'center' }}>
          <Box
            onClick={handleStartChat}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2.5,
              py: 1.25,
              border: '1px solid rgba(80,120,160,0.35)',
              borderRadius: 2,
              cursor: 'pointer',
              color: '#1565c0',
              fontSize: 14,
              letterSpacing: 1,
              transition: 'all 0.2s',
              '&:hover': {
                background: 'rgba(80,120,160,0.08)',
                borderColor: 'rgba(80,120,160,0.6)',
              },
            }}
          >
            <AutoStoriesIcon sx={{ fontSize: 18 }} />
            AI 历史讲解
          </Box>
        </Box>
      ) : (
        <>
          {/* Message list */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: { xs: 1.25, sm: 2.5 },
              py: 1.5,
              minHeight: { xs: 220, sm: 300, md: 360 },
              maxHeight: { xs: '50vh', md: 620 },
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            {messages.map((msg, i) => (
              <Box
                key={i}
                sx={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '86%',
                }}
              >
                <Box
                  sx={{
                    px: 1.75,
                    py: 1,
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background:
                      msg.role === 'user'
                        ? 'rgba(21,101,192,0.08)'
                        : 'rgba(0,0,0,0.03)',
                    border:
                      msg.role === 'user'
                        ? '1px solid rgba(21,101,192,0.2)'
                        : '1px solid rgba(0,0,0,0.08)',
                  }}
                >
                  {msg.content === '' && loading && i === messages.length - 1 ? (
                    <CircularProgress size={14} sx={{ color: '#1565c0' }} />
                  ) : msg.role === 'assistant' ? (
                    <Box
                      sx={{
                        fontSize: 15.5,
                        color: '#2a3a4a',
                        lineHeight: 1.85,
                        '& p': { m: 0, mb: 0.5 },
                        '& p:last-child': { mb: 0 },
                        '& ul, & ol': { pl: 2.5, my: 0.5 },
                        '& li': { mb: 0.25 },
                        '& strong': { fontWeight: 600 },
                        '& em': { fontStyle: 'italic' },
                        '& h1,& h2,& h3,& h4': { fontWeight: 700, my: 0.5, fontSize: '1em' },
                        '& code': {
                          fontFamily: 'monospace',
                          background: 'rgba(0,0,0,0.06)',
                          px: 0.5,
                          borderRadius: 0.5,
                          fontSize: '0.9em',
                        },
                        '& pre': {
                          background: 'rgba(0,0,0,0.06)',
                          p: 1,
                          borderRadius: 1,
                          overflowX: 'auto',
                          my: 0.5,
                          '& code': { background: 'none', p: 0 },
                        },
                        '& blockquote': {
                          borderLeft: '3px solid rgba(21,101,192,0.4)',
                          pl: 1,
                          ml: 0,
                          color: '#546e7a',
                          my: 0.5,
                        },
                        '& hr': { border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', my: 1 },
                      }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </Box>
                  ) : (
                    <Typography
                      sx={{
                        fontSize: 13.5,
                        color: '#1a2a3a',
                        lineHeight: 1.8,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {msg.content}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
            <div ref={bottomRef} />
          </Box>

          <Divider sx={{ borderColor: 'rgba(80,120,160,0.1)' }} />

          {/* Suggested questions */}
          {suggestedQuestions.length > 0 && !loading && (
            <Box sx={{ px: 2, pt: 1.25, pb: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {suggestedQuestions.map((q, i) => (
                <Chip
                  key={i}
                  label={q}
                  size="small"
                  onClick={() => sendMessage(q)}
                  sx={{
                    fontSize: 12,
                    height: 'auto',
                    py: 0.5,
                    cursor: 'pointer',
                    border: '1px solid rgba(21,101,192,0.3)',
                    background: 'rgba(21,101,192,0.05)',
                    color: '#1565c0',
                    '& .MuiChip-label': { whiteSpace: 'normal' },
                    '&:hover': { background: 'rgba(21,101,192,0.12)' },
                  }}
                />
              ))}
            </Box>
          )}

          {/* Input bar */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', px: 2, py: 1.5, gap: 1 }}>
            <TextField
              variant="standard"
              fullWidth
              multiline
              maxRows={3}
              placeholder="继续提问…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              slotProps={{
                input: {
                  disableUnderline: true,
                  sx: {
                    color: '#1a2a3a',
                    fontSize: 13.5,
                    px: 1.5,
                    py: 0.75,
                    background: 'rgba(0,0,0,0.03)',
                    borderRadius: 1.5,
                    border: '1px solid rgba(80,120,160,0.2)',
                    '&:focus-within': { borderColor: 'rgba(21,101,192,0.45)' },
                  },
                },
              }}
            />
            <IconButton
              onClick={handleSend}
              disabled={loading || !input.trim()}
              size="small"
              sx={{
                color: '#1565c0',
                mb: 0.25,
                '&:disabled': { color: '#b0bec5' },
                '&:hover': { color: '#1976d2' },
              }}
            >
              <SendIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </>
      )}
    </Dialog>
  );
}

