import { Router } from 'express';
import { getStok, addStok, updateStok, deleteStok } from '../controllers/stokController';

const router = Router();

router.get('/', getStok);
router.post('/', addStok);
router.put('/:id', updateStok);
router.delete('/:id', deleteStok);

export default router;