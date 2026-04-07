import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';
import { AuthRequest } from '../middleware/auth.js';

const isValidUUID = (id: string): boolean => {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
};

export class ChatController {
  private chatService = new ChatService();

  public async chat(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { message, conversationId } = req.body;

      if (typeof message !== 'string') {
        return res.status(400).json({ error: 'Invalid message type' });
      }

      if (conversationId && !isValidUUID(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversationId' });
      }

      const sanitizedMessage = message.trim().slice(0, 1000);

      if (!sanitizedMessage) {
        return res.status(400).json({ error: 'Message cannot be empty' });
      }

      const result = await this.chatService.processMessage(
        sanitizedMessage,
        userId,
        conversationId
      );

      return res.status(200).json(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Internal server error';
      return res.status(500).json({ error: errorMessage });
    }
  }

  public async getConversations(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const conversations = await this.chatService.getConversations(userId, limit);
      return res.status(200).json({ conversations });
    } catch {
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  }

  public async healthCheck(req: Request, res: Response): Promise<Response> {
    try {
      const dbHealthy = await this.chatService.healthCheck();
      return res.status(200).json({
        status: 'ok',
        database: dbHealthy ? 'connected' : 'not_configured',
        timestamp: new Date().toISOString(),
      });
    } catch {
      return res.status(500).json({
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
