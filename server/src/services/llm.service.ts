import axios, { AxiosResponse } from 'axios';
import { ENV } from '../config/env';
import { SYSTEM_PROMPT } from '../config/constants';

interface OllamaRequest {
  model: string;
  prompt: string;
  stream: boolean;
  options: {
    temperature: number;
    num_predict: number;
  };
}

interface OllamaResponse {
  response: string;
  done: boolean;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MistralRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature: number;
}

interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', mr: 'Marathi', bn: 'Bengali',
  ta: 'Tamil', te: 'Telugu', gu: 'Gujarati', kn: 'Kannada',
};

interface DynamicPromptLayers {
  memoryContext?: string;
  leadContext?: string;
  knowledgeContext?: string;
  style?: string;
}

const buildSystemContent = (layers: DynamicPromptLayers): string => {
  const parts = [SYSTEM_PROMPT];

  if (layers.memoryContext) {
    parts.push(layers.memoryContext);
  }

  if (layers.leadContext) {
    parts.push(layers.leadContext);
  }

  if (layers.knowledgeContext) {
    parts.push(`BUSINESS CONTEXT:\n${layers.knowledgeContext}`);
  }

  if (layers.style && layers.style !== 'english') {
    parts.push(
      `CONVERSATION STYLE: The user speaks in ${LANGUAGE_NAMES[layers.style] || layers.style}. Mirror their style exactly. Keep technical terms (React, API, AI, etc.) in English. Respond naturally — do not force pure translations.`
    );
  }

  return parts.filter(Boolean).join('\n\n');
};

const buildMistralMessages = (
  history: { role: string; content: string }[],
  current: string,
  layers: DynamicPromptLayers
): ChatMessage[] => {
  const systemContent = buildSystemContent(layers);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
  ];

  const recentHistory = history.slice(-8);
  for (const m of recentHistory) {
    messages.push({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    });
  }

  messages.push({ role: 'user', content: current });

  return messages;
};

const buildOllamaPrompt = (
  history: { role: string; content: string }[],
  current: string,
  layers: DynamicPromptLayers
): string => {
  const context = history
    .slice(-5)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const systemContent = buildSystemContent(layers);

  return `${systemContent}\n\nConversation:\n${context}\n\nUser: ${current}\nAssistant:`;
};

const sanitizeOutput = (text: string): string => {
  return text.replace(/[<>]/g, '').trim();
};

export class LlmService {
  private useOllama(): boolean {
    if (ENV.MISTRAL_API_KEY) return false;
    return !!ENV.OLLAMA_URL;
  }

  async generateResponse(
    message: string,
    history: { role: string; content: string }[] = [],
    layers: DynamicPromptLayers = {}
  ): Promise<string> {
    if (this.useOllama()) {
      return this.generateWithOllama(message, history, layers);
    } else if (ENV.MISTRAL_API_KEY) {
      return this.generateWithMistral(message, history, layers);
    } else {
      throw new Error('No LLM provider configured. Set OLLAMA_URL or MISTRAL_API_KEY');
    }
  }

  private async generateWithOllama(
    message: string,
    history: { role: string; content: string }[],
    layers: DynamicPromptLayers
  ): Promise<string> {
    const prompt = buildOllamaPrompt(history, message, layers);

    const requestData: OllamaRequest = {
      model: ENV.OLLAMA_MODEL || 'mistral',
      prompt,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 300,
      },
    };

    try {
      const res: AxiosResponse<OllamaResponse> = await axios.post(
        `${ENV.OLLAMA_URL}/api/generate`,
        requestData,
        { timeout: 60000 }
      );

      const content = res.data.response;

      if (!content) {
        throw new Error('Empty response from Ollama');
      }

      return sanitizeOutput(content);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Ollama request timed out. Make sure Ollama is running.');
        }
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to Ollama. Run: ollama serve');
        }
      }
      throw new Error('Ollama service failed');
    }
  }

  private async generateWithMistral(
    message: string,
    history: { role: string; content: string }[],
    layers: DynamicPromptLayers
  ): Promise<string> {
    const messages = buildMistralMessages(history, message, layers);

    const requestData: MistralRequest = {
      model: ENV.MISTRAL_MODEL || 'mistral-small-latest',
      messages,
      max_tokens: 400,
      temperature: 0.7,
    };

    try {
      const res: AxiosResponse<MistralResponse> = await axios.post(
        ENV.MISTRAL_API_URL,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ENV.MISTRAL_API_KEY}`,
          },
          timeout: 30000,
        }
      );

      const content = res.data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from Mistral');
      }

      return sanitizeOutput(content);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timed out. Please try again.');
        }
        if (error.response?.status === 401) {
          throw new Error('Invalid API key. Please check your Mistral API key.');
        }
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
      }
      throw new Error('LLM service failed');
    }
  }
}
