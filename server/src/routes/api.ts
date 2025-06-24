import { Router, Request, Response } from 'express';

const router = Router();

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Un endpoint di esempio per il futuro
router.get('/items', (_req: Request, res: Response) => {
  // Qui tornerai la lista di oggetti dal DB
  res.json([]);
});

// Endpoint di raccolta oggetto di esempio
router.post('/items/:id/collect', (req: Request, res: Response) => {
  const { id } = req.params;
  // In futuro verificherai pos e permessi, salverai su DB, ecc.
  res.json({ collected: true, itemId: id });
});

export default router;
