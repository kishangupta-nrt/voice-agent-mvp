import { ragService } from '../server/src/services/knowledge/rag.service';
import * as fs from 'fs';
import * as path from 'path';

const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge-base');

async function loadKnowledge() {
  console.log('📚 Loading knowledge base...');
  
  try {
    const files = fs.readdirSync(KNOWLEDGE_DIR);
    const textFiles = files.filter(f => 
      f.endsWith('.txt') || f.endsWith('.md') || f.endsWith('.mdx')
    );
    
    console.log(`Found ${textFiles.length} knowledge files`);
    
    for (const file of textFiles) {
      const filePath = path.join(KNOWLEDGE_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const source = file.replace(/\.(txt|md|mdx)$/, '');
      
      console.log(`📖 Processing ${file}...`);
      
      const added = await ragService.addDocument(content, source);
      console.log(`   Added ${added} chunks`);
    }
    
    const stats = ragService.getStats();
    console.log(`✅ Knowledge loaded: ${stats.totalChunks} total chunks`);
    
  } catch (error) {
    console.error('⚠️  Knowledge load error:', error);
  }
}

if (require.main === module) {
  loadKnowledge()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { loadKnowledge };