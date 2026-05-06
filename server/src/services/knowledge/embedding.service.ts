import axios from 'axios';
import { ENV } from '../../config/env';

export interface Embedding {
  index: number;
  embedding: number[];
}

interface OllamaEmbedResponse {
  embeddings: Embedding[];
}

export class EmbeddingService {
  private model: string;
  private baseUrl: string;

  constructor() {
    this.model = ENV.OLLAMA_MODEL || 'mistral';
    this.baseUrl = ENV.OLLAMA_URL;
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/embeddings`,
        {
          model: this.model,
          prompt: text,
        },
        { timeout: 30000 }
      );

      return response.data.embedding;
    } catch (error) {
      console.error('Embedding error:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`, { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
}

export const embeddingService = new EmbeddingService();
