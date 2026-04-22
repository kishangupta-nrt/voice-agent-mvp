import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const controller = new ChatController();

router.use(authMiddleware);

router.post('/', controller.chat.bind(controller));

router.post('/verify', async (req, res) => {
  try {
    const { conversationId, phone } = req.body;
    if (!conversationId || !phone) {
      return res.status(400).json({ error: 'conversationId and phone required' });
    }
    const result = await controller.verifyCustomer(conversationId, phone);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Verification failed' });
  }
});

router.get('/', controller.getConversations.bind(controller));
router.get('/health', controller.healthCheck.bind(controller));

export default router;
