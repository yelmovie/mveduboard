/**
 * OpenAI API (gpt-4o-mini) 클라이언트
 * .env.local에 VITE_OPENAI_API_KEY 설정 필요
 */

type OpenAIRole = 'system' | 'user' | 'assistant';

interface OpenAIMessage {
  role: OpenAIRole;
  content: string;
}

interface OpenAIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_MODEL = 'gpt-4o-mini';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export const getOpenAIApiKey = (): string => {
  const metaEnv = import.meta.env ?? {};
  const injectedKey =
    typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : undefined;
  const injectedViteKey =
    typeof process !== 'undefined' ? process.env.VITE_OPENAI_API_KEY : undefined;
  return (
    metaEnv.VITE_OPENAI_API_KEY ||
    metaEnv.OPENAI_API_KEY ||
    injectedKey ||
    injectedViteKey ||
    ''
  );
};

const extractJsonBlock = (text: string): string => {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return '';
};

const requestChatCompletion = async (
  messages: OpenAIMessage[],
  options: OpenAIOptions = {}
): Promise<string> => {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 512,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response is empty');
  }
  return String(content);
};

export const generateText = async (
  prompt: string,
  options: OpenAIOptions = {},
  systemPrompt?: string
): Promise<string> => {
  const messages: OpenAIMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });
  return requestChatCompletion(messages, options);
};

export const generateJson = async <T = unknown>(
  prompt: string,
  options: OpenAIOptions = {},
  systemPrompt?: string
): Promise<T> => {
  const text = await generateText(prompt, options, systemPrompt);
  try {
    return JSON.parse(text) as T;
  } catch {
    const extracted = extractJsonBlock(text);
    if (extracted) {
      return JSON.parse(extracted) as T;
    }
    throw new Error('Invalid JSON response');
  }
};
