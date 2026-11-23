
import { Router } from 'express';
import { chatAi } from '../controllers/aiController';

const router = Router();

router.post('/chat', chatAi);

export default router;
