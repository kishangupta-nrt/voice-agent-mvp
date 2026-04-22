import { Router } from 'express';
import { ragService } from '../services/knowledge/rag.service';

const router = Router();

router.post('/ingest', async (req, res) => {
  try {
    const { text, source } = req.body;
    
    if (!text || !source) {
      return res.status(400).json({ error: 'text and source required' });
    }
    
    const added = await ragService.addDocument(text, source);
    
    return res.status(200).json({
      success: true,
      chunksAdded: added,
      totalChunks: ragService.getStats().totalChunks,
    });
  } catch (error) {
    console.error('Ingest error:', error);
    return res.status(500).json({ error: 'Failed to ingest document' });
  }
});

router.post('/search', async (req, res) => {
  try {
    const { query, topK } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'query required' });
    }
    
    const results = await ragService.search(query, topK || 3);
    
    return res.status(200).json({
      query,
      results: results.map(r => ({
        content: r.chunk.content,
        source: r.chunk.source,
        score: r.score,
      })),
    });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = ragService.getStats();
    const ready = await ragService.isReady();
    
    return res.status(200).json({
      ...stats,
      ollamaReady: ready,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Stats failed' });
  }
});

router.post('/clear', async (req, res) => {
  try {
    ragService.clear();
    
    return res.status(200).json({
      success: true,
      message: 'Knowledge base cleared',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Clear failed' });
  }
});

router.get('/health', async (req, res) => {
  try {
    const ready = await ragService.isReady();
    const stats = ragService.getStats();
    
    return res.status(200).json({
      status: ready ? 'ready' : 'not_ready',
      ollamaAvailable: ready,
      chunksIndexed: stats.totalChunks,
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;