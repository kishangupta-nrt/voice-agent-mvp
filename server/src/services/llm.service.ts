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
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const buildPrompt = (history: { role: string; content: string }[], current: string): string => {
  const context = history
    .slice(-5)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `${SYSTEM_PROMPT}\n\nConversation:\n${context}\n\nUser: ${current}\nAssistant:`;
};

const sanitizeOutput = (text: string): string => {
  return text.replace(/[<>]/g, '').trim();
};

export class LlmService {
  private useOllama(): boolean {
    return !!ENV.OLLAMA_URL && !ENV.MISTRAL_API_KEY;
  }

  async generateResponse(
    message: string,
    history: { role: string; content: string }[] = []
  ): Promise<string> {
    if (this.useOllama()) {
      return this.generateWithOllama(message, history);
    } else if (ENV.MISTRAL_API_KEY) {
      return this.generateWithMistral(message, history);
    } else {
      throw new Error('No LLM provider configured. Set OLLAMA_URL or MISTRAL_API_KEY');
    }
  }

  private async generateWithOllama(
    message: string,
    history: { role: string; content: string }[]
  ): Promise<string> {
    const prompt = buildPrompt(history, message);

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
        `${ENV.OLLAMA_URL}/generate`,
        requestData,
        { timeout: 60000 }
      );

      const content = res.data.response;

      if (!content) {
        throw new Error('Empty response from Ollama');
      }

      return sanitizeOutput(content);
    } catch (error) {
      console.error('Ollama Error:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Ollama request timed out. Make sure Ollama is running.');
        }
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to Ollama. Run: ollama serve');
        }
      }
      throw new Error('Ollama service failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async generateWithMistral(
    message: string,
    history: { role: string; content: string }[]
  ): Promise<string> {
    const prompt = buildPrompt(history, message);

    const messages: MistralMessage[] = [
      { role: 'system', content: prompt },
    ];

    const requestData: MistralRequest = {
      model: ENV.MISTRAL_MODEL || 'mistral-small-latest',
      messages,
      max_tokens: 300,
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
      console.error('Mistral Error:', error);
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
      throw new Error('LLM service failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}
