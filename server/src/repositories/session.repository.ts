import Session from '@models/session.model';

export async function createSession(sessionId: string): Promise<void> {
  await Session.create({ sessionId });
}

export async function isValidSession(sessionId: string): Promise<boolean> {
  const count = await Session.countDocuments({ sessionId }).exec();
  return count > 0;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await Session.deleteOne({ sessionId }).exec();
}
