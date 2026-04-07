import axios, { AxiosResponse } from 'axios';
import { ENV } from '../config/env';
import { SYSTEM_PROMPT } from '../config/constants';

interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MistralRequest {
  model: string;
  messages: MistralMessage[];
  max_tokens: number;
  temperature: number;
}

interface MistralResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const buildPrompt = (history: { role: string; content: string }[], current: string): string => {
  const context = history
    .slice(-5)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `${SYSTEM_PROMPT}\n\nConversation:\n${context}\n\nUser: ${current}\nAssistant:`;
};

const sanitizeOutput = (text: string): string => {
  return text.replace(/[<>]/g, '');
};

export class LlmService {
  public async generateResponse(
    message: string,
    history: { role: string; content: string }[] = []
  ): Promise<string> {
    if (!ENV.MISTRAL_API_KEY) {
      throw new Error('Mistral API key not configured');
    }

    try {
      const prompt = buildPrompt(history, message);

      const messages: MistralMessage[] = [
        { role: 'system', content: prompt },
      ];

      const requestData: MistralRequest = {
        model: ENV.MISTRAL_MODEL,
        messages,
        max_tokens: 300,
        temperature: 0.7,
      };

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
        throw new Error('Empty response from LLM');
      }

      return sanitizeOutput(content.trim());
    } catch (error) {
      console.error('LLM Error:', error);
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
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error.message || 'API error');
        }
      }
      throw new Error('LLM service failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}
