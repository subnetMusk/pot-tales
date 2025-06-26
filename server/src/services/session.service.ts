import { v4 as uuid } from 'uuid';
import {
  createSession,
  isValidSession,
  deleteSession
} from '@repositories/session.repository';

/**
 * Genera un nuovo sessionId e lo salva in DB.
 */
export async function generateSession(): Promise<string> {
  const sid = uuid();
  await createSession(sid);
  return sid;
}

/**
 * Valida un sessionId esistente.
 */
export async function validateSession(sessionId: string): Promise<boolean> {
  return isValidSession(sessionId);
}

/**
 * Revoca (cancella) una sessione.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await deleteSession(sessionId);
}
