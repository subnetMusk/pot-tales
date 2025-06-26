import { Request, Response, NextFunction } from 'express';
import { validateSession } from '@services/session.service';

const cookieOptions = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path:     '/'
};

export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sessionId = req.cookies?.sessionId as string | undefined;
  if (!sessionId) {
    return res.sendStatus(401);
  }
  try {
    const valid = await validateSession(sessionId);
    if (!valid) {
      res.clearCookie('sessionId', cookieOptions);
      return res.sendStatus(401);
    }
    next();
  } catch (err) {
    console.error('SessionAuth error:', err);
    res.sendStatus(500);
  }
}
