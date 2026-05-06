import fs from 'fs';
import path from 'path';

export interface KnowledgeSection {
  heading: string;
  content: string;
  source: string;
}

interface LoadedDocument {
  source: string;
  sections: KnowledgeSection[];
  fullText: string;
}

const INTENT_DOC_MAP: Record<string, string[]> = {
  website_inquiry: ['services.md', 'pricing.md'],
  app_inquiry: ['services.md', 'pricing.md'],
  ai_inquiry: ['services.md', 'pricing.md'],
  pricing_inquiry: ['pricing.md'],
  timeline_inquiry: ['services.md', 'pricing.md'],
  tech_stack_inquiry: ['tech-stack.md'],
  portfolio_inquiry: ['services.md'],
  maintenance_inquiry: ['services.md', 'pricing.md'],
  schedule_meeting: [],
  collect_contact: [],
  greeting: [],
  who_are_you: [],
  services_overview: ['services.md'],
  help: [],
};

const SECTION_KEYWORDS: Record<string, string[]> = {
  website_inquiry: ['web', 'landing', 'next.js', 'react', 'ecommerce', 'e-commerce', 'web app', 'cms', 'saas', 'wordpress'],
  app_inquiry: ['mobile', 'android', 'ios', 'react native', 'flutter', 'mvp', 'app store', 'push notification', 'offline'],
  ai_inquiry: ['ai', 'chatbot', 'voice agent', 'automation', 'ml', 'machine learning', 'gpt', 'llm', 'rag', 'whisper', 'tts', 'nlp'],
  tech_stack_inquiry: ['react', 'next.js', 'node', 'supabase', 'postgres', 'typescript', 'tailwind', 'docker', 'aws', 'vercel', 'stripe', 'razorpay'],
  pricing_inquiry: ['price', 'cost', 'budget', 'pricing', 'rupee', 'lakh', 'retainer', 'monthly', 'advance', 'payment'],
  timeline_inquiry: ['week', 'timeline', 'deadline', 'month', 'delivery', 'launch', 'fast', 'quick', 'time'],
  maintenance_inquiry: ['maintenance', 'support', 'bug', 'update', 'retainer', 'monthly', 'monitoring'],
  portfolio_inquiry: ['portfolio', 'past work', 'previous', 'example', 'sample', 'built', 'project', 'client'],
};

class KnowledgeService {
  private documents: Map<string, LoadedDocument> = new Map();
  private isLoaded = false;

  loadDocuments(baseDir?: string): void {
    if (this.isLoaded) return;

    const dir = baseDir || path.join(__dirname, '../knowledge/knowledge-base');

    try {
      if (!fs.existsSync(dir)) {
        return;
      }

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const sections = this.parseMarkdownSections(content, file);

        this.documents.set(file, {
          source: file,
          sections,
          fullText: content,
        });
      }

      this.isLoaded = true;
    } catch {
      // Knowledge base is optional — fallback to no retrieval
    }
  }

  getKnowledgeForIntent(intentId: string, maxSections = 3): string {
    const docNames = INTENT_DOC_MAP[intentId];
    if (!docNames || docNames.length === 0) {
      return '';
    }

    const parts: string[] = [];

    for (const docName of docNames) {
      const doc = this.documents.get(docName);
      if (!doc) continue;

      const relevantSections = this.getRelevantSections(doc, intentId, maxSections);

      if (relevantSections.length > 0) {
        parts.push(
          relevantSections.map(s => `${s.heading}\n${s.content}`).join('\n\n')
        );
      } else if (doc.sections.length <= maxSections) {
        parts.push(doc.fullText);
      } else {
        parts.push(
          doc.sections.slice(0, maxSections).map(s => `${s.heading}\n${s.content}`).join('\n\n')
        );
      }
    }

    return parts.join('\n\n');
  }

  getStats(): { docsLoaded: number; totalSections: number } {
    let totalSections = 0;
    for (const doc of this.documents.values()) {
      totalSections += doc.sections.length;
    }
    return {
      docsLoaded: this.documents.size,
      totalSections,
    };
  }

  private parseMarkdownSections(content: string, source: string): KnowledgeSection[] {
    const lines = content.split('\n');
    const sections: KnowledgeSection[] = [];
    let currentHeading = 'Overview';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
      if (headingMatch) {
        if (currentContent.length > 0) {
          sections.push({
            heading: currentHeading,
            content: currentContent.join('\n').trim(),
            source,
          });
        }
        currentHeading = headingMatch[2].trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentContent.length > 0) {
      sections.push({
        heading: currentHeading,
        content: currentContent.join('\n').trim(),
        source,
      });
    }

    return sections.filter(s => s.content.length > 10);
  }

  private getRelevantSections(doc: LoadedDocument, intentId: string, max: number): KnowledgeSection[] {
    const keywords = SECTION_KEYWORDS[intentId];
    if (!keywords || keywords.length === 0) {
      return doc.sections.slice(0, max);
    }

    const scored = doc.sections.map(section => {
      let score = 0;
      const sectionLower = section.content.toLowerCase() + ' ' + section.heading.toLowerCase();
      for (const kw of keywords) {
        if (sectionLower.includes(kw.toLowerCase())) score += 1;
      }
      return { section, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored
      .filter(s => s.score > 0)
      .slice(0, max)
      .map(s => s.section);
  }
}

export const knowledgeService = new KnowledgeService();
