import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Divider,
  Fade,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  getAiConfig,
  setAiConfig,
  type AiConfig,
  type AiProvider,
  AI_PROVIDER_PRESETS,
} from '@/utils/aiConfig';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: Props) {
  const [form, setForm] = useState<AiConfig>(() => getAiConfig());
  const [saved, setSaved] = useState(false);

  const currentPreset = AI_PROVIDER_PRESETS.find((p) => p.id === form.provider)!;

  // Reload form values when dialog opens
  useEffect(() => {
    if (open) {
      setForm(getAiConfig());
      setSaved(false);
    }
  }, [open]);

  const handleChange = useCallback(
    (key: keyof AiConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      setSaved(false);
    },
    [],
  );

  const handleProviderChange = useCallback((providerId: AiProvider) => {
    const preset = AI_PROVIDER_PRESETS.find((p) => p.id === providerId)!;
    setForm((prev) => ({
      ...prev,
      provider: providerId,
      baseURL: preset.defaultBaseURL || prev.baseURL,
    }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    setAiConfig(form);
    setSaved(true);
  }, [form]);

  const handleReset = useCallback(() => {
    setForm({ provider: 'custom', baseURL: '', apiKey: '', model: '' });
    setSaved(false);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      slots={{ transition: Fade }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(140,180,210,0.4)' } },
        paper: {
          sx: {
            background: '#ffffff',
            border: '1px solid rgba(80,120,160,0.2)',
            borderRadius: 2.5,
            boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
            width: 480,
            maxWidth: '92vw',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          px: 3,
          pt: 2.5,
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: '#1a3a5a',
          letterSpacing: 2,
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        <SettingsIcon sx={{ fontSize: 20, color: '#546e7a' }} />
        AI 服务配置
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ ml: 'auto', color: '#78909c', '&:hover': { color: '#1565c0' } }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Typography sx={{ fontSize: 12, color: '#78909c', letterSpacing: 0.5, lineHeight: 1.6 }}>
          配置您自己的 OpenAI 兼容接口参数，保存后立即生效。
        </Typography>

        <FormControl fullWidth size="small">
          <InputLabel shrink>API 服务商</InputLabel>
          <Select
            label="API 服务商"
            value={form.provider}
            onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
            notched
          >
            {AI_PROVIDER_PRESETS.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Base URL"
          value={form.baseURL}
          onChange={handleChange('baseURL')}
          fullWidth
          size="small"
          placeholder={currentPreset.defaultBaseURL || 'https://your-api-endpoint/v1/'}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        {currentPreset.requiresApiKey && (
          <TextField
            label="API Key"
            value={form.apiKey}
            onChange={handleChange('apiKey')}
            fullWidth
            size="small"
            type="password"
            placeholder="sk-..."
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}

        <TextField
          label="Model"
          value={form.model}
          onChange={handleChange('model')}
          fullWidth
          size="small"
          placeholder={currentPreset.modelPlaceholder}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        {saved && (
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: 1,
              background: 'rgba(21,101,192,0.08)',
              border: '1px solid rgba(21,101,192,0.2)',
              fontSize: 12,
              color: '#1565c0',
              letterSpacing: 0.5,
            }}
          >
            ✓ 配置已保存，下次 AI 对话将使用新配置
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        <Button
          size="small"
          onClick={handleReset}
          sx={{ color: '#78909c', fontSize: 12, letterSpacing: 1 }}
        >
          恢复默认
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          onClick={onClose}
          sx={{ color: '#546e7a', fontSize: 12, letterSpacing: 1 }}
        >
          取消
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={handleSave}
          sx={{ fontSize: 12, letterSpacing: 1, boxShadow: 'none' }}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
