import OpenAI from 'openai';
import { getAiConfig } from '@/utils/aiConfig';

function createClient(): { client: OpenAI; model: string } {
  const cfg = getAiConfig();

  const client = new OpenAI({
    baseURL: cfg.baseURL,
    apiKey: cfg.apiKey || 'no-key',
    dangerouslyAllowBrowser: true,
  });
  return { client, model: cfg.model };
}

const SYSTEM_SUFFIX = `

请保持回答简洁，条理清晰，正文不超过1500字。回答结束后另起一行，提供2~3个用户可能感兴趣的后续问题，严格使用以下格式：
<questions>
问题一
问题二
问题三
</questions>`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 流式发送对话消息，通过 onChunk 回调逐字返回增量内容
 */
export async function streamChat(
  systemPrompt: string,
  history: ChatMessage[],
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { client, model } = createClient();
  const stream = await client.chat.completions.create(
    {
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt + SYSTEM_SUFFIX },
        ...history,
      ],
    },
    { signal },
  );

  for await (const chunk of stream) {
    if ((chunk as any).thought === true) continue;
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) onChunk(delta);
  }
}
