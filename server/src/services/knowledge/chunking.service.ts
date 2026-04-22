export interface TextChunk {
  id: string;
  content: string;
  source: string;
  index: number;
}

export interface ProcessedDocument {
  source: string;
  chunks: TextChunk[];
  metadata: Record<string, any>;
}

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 50;

export class ChunkingService {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = overlap;
  }

  chunkText(text: string, source: string = 'unknown'): TextChunk[] {
    const chunks: TextChunk[] = [];
    
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      
      if (trimmed.length === 0) continue;
      
      if (currentChunk.length + trimmed.length > this.chunkSize && currentChunk.length > 0) {
        chunks.push({
          id: `${source}-${chunkIndex}`,
          content: currentChunk.trim(),
          source,
          index: chunkIndex,
        });
        
        const overlapStart = currentChunk.length - this.chunkOverlap;
        currentChunk = overlapStart > 0 ? trimmed.slice(-this.chunkOverlap) + ' ' + trimmed : trimmed;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmed;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push({
        id: `${source}-${chunkIndex}`,
        content: currentChunk.trim(),
        source,
        index: chunkIndex,
      });
    }
    
    return chunks;
  }

  chunkMarkdown(text: string, source: string = 'unknown'): TextChunk[] {
    const chunks: TextChunk[] = [];
    
    const lines = text.split('\n');
    let currentSection = '';
    let currentHeading = '';
    let chunkIndex = 0;
    
    for (const line of lines) {
      const headingMatch = line.match(/^#+ (.+)/);
      
      if (headingMatch) {
        if (currentSection.trim()) {
          chunks.push({
            id: `${source}-${chunkIndex}`,
            content: currentSection.trim(),
            source,
            index: chunkIndex,
          });
          chunkIndex++;
        }
        
        currentHeading = headingMatch[1];
        currentSection = line + '\n';
      } else if (currentSection.length + line.length > this.chunkSize && currentSection.trim()) {
        chunks.push({
          id: `${source}-${chunkIndex}`,
          content: currentSection.trim(),
          source,
          index: chunkIndex,
        });
        
        currentSection = line + '\n';
        chunkIndex++;
      } else {
        currentSection += line + '\n';
      }
    }
    
    if (currentSection.trim()) {
      chunks.push({
        id: `${source}-${chunkIndex}`,
        content: currentSection.trim(),
        source,
        index: chunkIndex,
      });
    }
    
    return chunks;
  }

  chunkQ_and_A(text: string, source: string = 'unknown'): { question: TextChunk; answer: TextChunk }[] {
    const qaPairs: { question: TextChunk; answer: TextChunk }[] = [];
    
    const qPattern = /^Q[.:]\s*(.+)/i;
    const aPattern = /^A[.:]\s*(.+)/i;
    
    const lines = text.split('\n');
    let currentQ = '';
    let currentA = '';
    let qIndex = 0;
    
    for (const line of lines) {
      const qMatch = line.match(qPattern);
      const aMatch = line.match(aPattern);
      
      if (qMatch) {
        if (currentQ && currentA) {
          qaPairs.push({
            question: {
              id: `${source}-q-${qIndex}`,
              content: currentQ.trim(),
              source,
              index: qIndex,
            },
            answer: {
              id: `${source}-a-${qIndex}`,
              content: currentA.trim(),
              source,
              index: qIndex,
            },
          });
          qIndex++;
        }
        currentQ = qMatch[1];
        currentA = '';
      } else if (aMatch) {
        currentA = aMatch[1];
      } else if (currentA) {
        currentA += ' ' + line;
      }
    }
    
    if (currentQ && currentA) {
      qaPairs.push({
        question: {
          id: `${source}-q-${qIndex}`,
          content: currentQ.trim(),
          source,
          index: qIndex,
        },
        answer: {
          id: `${source}-a-${qIndex}`,
          content: currentA.trim(),
          source,
          index: qIndex,
        },
      });
    }
    
    return qaPairs;
  }

  chunkBySentences(text: string, source: string = 'unknown', sentencesPerChunk = 5): TextChunk[] {
    const chunks: TextChunk[] = [];
    
    const sentencePattern = /[^.!?]+[.!?]+/g;
    const sentences = text.match(sentencePattern) || [];
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > 0) {
        chunks.push({
          id: `${source}-${chunkIndex}`,
          content: currentChunk.trim(),
          source,
          index: chunkIndex,
        });
        
        currentChunk = '';
        chunkIndex++;
      }
      currentChunk += (currentChunk ? ' ' : '') + sentence.trim();
    }
    
    if (currentChunk.trim()) {
      chunks.push({
        id: `${source}-${chunkIndex}`,
        content: currentChunk.trim(),
        source,
        index: chunkIndex,
      });
    }
    
    return chunks;
  }

  detectFormat(text: string): 'plain' | 'markdown' | 'qa' {
    const qPattern = /^Q[.:]\s*/i;
    const mdPattern = /^#+ /m;
    
    if (qPattern.test(text) || text.includes('Q:') && text.includes('A:')) {
      return 'qa';
    }
    if (mdPattern.test(text)) {
      return 'markdown';
    }
    return 'plain';
  }

  processDocument(text: string, source: string): TextChunk[] {
    const format = this.detectFormat(text);
    
    switch (format) {
      case 'qa':
        const qaPairs = this.chunkQ_and_A(text, source);
        return qaPairs.flatMap(pair => [pair.question, pair.answer]);
      
      case 'markdown':
        return this.chunkMarkdown(text, source);
      
      default:
        return this.chunkText(text, source);
    }
  }
}

export const chunkingService = new ChunkingService();