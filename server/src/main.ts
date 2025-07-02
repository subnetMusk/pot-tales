// src/main.ts
import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import path from 'path';

import { validateSession } from '@services/session.service'; // o il tuo helper
import authRouter    from '@routes/auth';
import apiRouter     from '@routes/api';
import contentRouter from '@routes/content'; // Assicurati di avere questo router

import sandboxRouter from '@routes/sandbox';

const app = express();
const PORT = process.env.PORT || 3000;

// 1) Parser
app.use(express.json());
app.use(cookieParser());

// 2) Mount API e Auth
app.use('/static', express.static(path.resolve(__dirname, '../public')));
app.use('/auth', authRouter);
app.use('/api', apiRouter);
app.use('/content', contentRouter);

if(process.env.NODE_ENV === 'development') {
  // 2.1) Dev UI per debug (opzionale)
  app.use('/sandbox', sandboxRouter);
}

// 3) Serve tutto il resto via GET /
//    – se sessione valida → manda menu.html
//    – altrimenti → manda consent.html
app.get('/', async (req: Request, res: Response) => {
  try {
    const sid = req.cookies.sessionId as string | undefined;
    const isValid = sid ? await validateSession(sid) : false;

    const file = isValid
      ? 'menu.html'
      : 'consent.html';

    return res.sendFile(
      path.resolve(__dirname, '../public', file)
    );
  } catch (err) {
    console.error('Errore in GET /:', err);
    return res.sendStatus(500);
  }
});

// 4) Serve asset statici (JS/CSS/immagini) da public/
//    Attenzione: deve venire DOPO il get('/') se vuoi che index non venga preso come asset.
app.use(
  express.static(path.resolve(__dirname, '../public'))
);

// 5) Fallback per SPA “deep link” (opzionale)
//    Se avrai future rotte client-side che devono puntare a /, puoi lasciare:
// app.get('*', (_req, res) => {
//   res.sendFile(path.resolve(__dirname, '../public/index.html'));
// });

// 6) Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// 7) Mongo + Avvio
mongoose
  .connect(process.env.MONGO_URI ?? 'mongodb://localhost:27017/mydb')
  .then(() => {
    console.log('MongoDB connesso');
    app.listen(PORT, () => console.log(`Server su porta ${PORT}`));
  })
  .catch(err => {
    console.error('Errore connessione MongoDB:', err);
    process.exit(1);
  });
