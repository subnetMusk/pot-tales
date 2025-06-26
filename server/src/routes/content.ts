import { Router } from 'express';
import path from 'path';
import { requireSession } from '@middleware/sessionAuth';

const router = Router();

// Serviamo sempre menu.html solo se la sessione è valida
router.get('/menu', requireSession, (_req, res) => {
  res.redirect('/static/menu.html');
});

export default router;
