import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const controller = new ChatController();

router.use(authMiddleware);

router.post('/', controller.chat.bind(controller));
router.get('/', controller.getConversations.bind(controller));
router.get('/health', controller.healthCheck.bind(controller));

export default router;
