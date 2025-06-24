import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: () => new Date() },
});

export default mongoose.model('Session', sessionSchema);
