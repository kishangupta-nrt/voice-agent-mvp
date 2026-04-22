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
    this.baseUrl = ENV.OLLAMA_URL.replace('/api/generate', '');
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
      console.error('Embedding error:', error);
      return [];
    }
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const embedding = await this.embedText(text);
      if (embedding.length > 0) {
        embeddings.push(embedding);
      }
    }
    
    return embeddings;
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
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  findMostSimilar(queryEmbedding: number[], embeddings: number[][]): number {
    let bestIndex = 0;
    let bestScore = -1;
    
    for (let i = 0; i < embeddings.length; i++) {
      const score = this.cosineSimilarity(queryEmbedding, embeddings[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    
    return bestIndex;
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