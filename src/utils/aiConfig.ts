const STORAGE_KEY = 'historymap_ai_config';

export type AiProvider = 'openai' | 'azure' | 'ollama' | 'dashscope' | 'custom';

export interface AiProviderPreset {
  id: AiProvider;
  name: string;
  defaultBaseURL: string;
  requiresApiKey: boolean;
  modelPlaceholder: string;
}

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseURL: 'https://api.openai.com/v1/',
    requiresApiKey: true,
    modelPlaceholder: 'gpt-4o',
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    defaultBaseURL: '',
    requiresApiKey: true,
    modelPlaceholder: 'gpt-4o',
  },
  {
    id: 'ollama',
    name: 'Ollama（本地）',
    defaultBaseURL: 'http://localhost:11434/v1/',
    requiresApiKey: false,
    modelPlaceholder: 'llama3',
  },
  {
    id: 'dashscope',
    name: '阿里云百炼（DashScope）',
    defaultBaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
    requiresApiKey: true,
    modelPlaceholder: 'qwen-plus',
  },
  {
    id: 'custom',
    name: '自定义',
    defaultBaseURL: '',
    requiresApiKey: true,
    modelPlaceholder: 'your-model-name',
  },
];

export interface AiConfig {
  provider: AiProvider;
  baseURL: string;
  apiKey: string;
  model: string;
}

const EMPTY_CONFIG: AiConfig = {
  provider: 'custom',
  baseURL: '',
  apiKey: '',
  model: '',
};

export function getAiConfig(): AiConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AiConfig>;
      return {
        provider: parsed.provider ?? 'custom',
        baseURL: parsed.baseURL ?? '',
        apiKey: parsed.apiKey ?? '',
        model: parsed.model ?? '',
      };
    }
  } catch {
    // ignore parse errors
  }
  return { ...EMPTY_CONFIG };
}

export function isAiConfigured(): boolean {
  const cfg = getAiConfig();
  if (!cfg.baseURL || !cfg.model) return false;
  const preset = AI_PROVIDER_PRESETS.find((p) => p.id === cfg.provider);
  if (preset?.requiresApiKey) return !!cfg.apiKey;
  return true;
}

export function setAiConfig(config: AiConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearAiConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}
