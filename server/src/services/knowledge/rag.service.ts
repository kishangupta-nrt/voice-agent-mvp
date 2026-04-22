import { TextChunk, chunkingService } from './chunking.service';
import { embeddingService } from './embedding.service';

export interface KnowledgeEntry {
  chunk: TextChunk;
  embedding: number[];
}

export interface SearchResult {
  chunk: TextChunk;
  score: number;
}

export class RagService {
  private knowledgeBase: KnowledgeEntry[] = [];
  private isIndexed = false;

  async addDocument(text: string, source: string): Promise<number> {
    const chunks = chunkingService.processDocument(text, source);
    
    console.log(`Processing ${chunks.length} chunks from ${source}...`);
    
    let added = 0;
    
    for (const chunk of chunks) {
      const embedding = await embeddingService.embedText(chunk.content);
      
      if (embedding.length > 0) {
        this.knowledgeBase.push({
          chunk,
          embedding,
        });
        added++;
      }
    }
    
    this.isIndexed = true;
    console.log(`Added ${added} chunks to knowledge base. Total: ${this.knowledgeBase.length}`);
    
    return added;
  }

  async search(query: string, topK = 3): Promise<SearchResult[]> {
    if (this.knowledgeBase.length === 0) {
      return [];
    }
    
    const queryEmbedding = await embeddingService.embedText(query);
    
    if (queryEmbedding.length === 0) {
      return [];
    }
    
    const scores: { index: number; score: number }[] = [];
    
    for (let i = 0; i < this.knowledgeBase.length; i++) {
      const score = embeddingService.cosineSimilarity(
        queryEmbedding,
        this.knowledgeBase[i].embedding
      );
      scores.push({ index: i, score });
    }
    
    scores.sort((a, b) => b.score - a.score);
    
    const topResults = scores.slice(0, topK).map(s => ({
      chunk: this.knowledgeBase[s.index].chunk,
      score: s.score,
    }));
    
    return topResults;
  }

  getContext(results: SearchResult[]): string {
    if (results.length === 0) return '';
    
    return results
      .map(r => r.chunk.content)
      .join('\n\n');
  }

  getAnswerWithContext(query: string, results: SearchResult[]): string {
    const context = this.getContext(results);
    
    if (!context) {
      return '';
    }
    
    return `Use this information to answer the user's question:\n\n${context}\n\nUser question: ${query}\n\nAnswer:`;
  }

  clear(): void {
    this.knowledgeBase = [];
    this.isIndexed = false;
  }

  getStats(): { totalChunks: number; isIndexed: boolean } {
    return {
      totalChunks: this.knowledgeBase.length,
      isIndexed: this.isIndexed,
    };
  }

  async isReady(): Promise<boolean> {
    return embeddingService.isAvailable();
  }
}

export const ragService = new RagService();