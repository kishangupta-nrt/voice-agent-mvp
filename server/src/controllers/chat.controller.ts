import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';
import { AuthRequest } from '../middleware/auth';
import type { Customer } from '../services/tools/customer.service';
import { adminRepository } from '../repositories/admin.repository';

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

      const { message, conversationId, language } = req.body;

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
        conversationId,
        language
      );

      return res.status(200).json({
        response: result.response,
        conversationId: result.conversationId,
        requiresAuth: result.requiresAuth || false,
        style: result.style,
        language: result.language,
      });
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

  public async verifyCustomer(conversationId: string, phone: string): Promise<{ success: boolean; message: string; customer?: Customer }> {
    return this.chatService.verifyCustomer(conversationId, phone);
  }

  public async adminStats(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      const days = parseInt(req.query.days as string) || 30;
      const stats = await adminRepository.getStats(days, userId);
      if (!stats) return res.status(500).json({ error: 'Failed to fetch stats' });
      return res.status(200).json(stats);
    } catch {
      return res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
  }

  public async adminConversations(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      const conversations = await adminRepository.getAllConversations(limit, offset, userId);
      return res.status(200).json({ conversations, total: conversations.length });
    } catch {
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  }

  public async adminConversationDetail(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      const { id } = req.params;
      if (!id || !isValidUUID(id)) {
        return res.status(400).json({ error: 'Valid conversation ID required' });
      }
      const detail = await adminRepository.getConversationDetail(id, userId);
      if (!detail) return res.status(404).json({ error: 'Conversation not found' });
      return res.status(200).json(detail);
    } catch {
      return res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  }

  public async adminLeads(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      const leads = await adminRepository.getLeadSummaries(userId);
      return res.status(200).json({ leads, total: leads.length });
    } catch {
      return res.status(500).json({ error: 'Failed to fetch leads' });
    }
  }
}
