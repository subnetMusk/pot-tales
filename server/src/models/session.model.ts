import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  sessionId:   { type: String, required: true, unique: true },
  createdAt:   { type: Date,   default: () => new Date() },
});

const Session = mongoose.model('Session', sessionSchema);
export default Session;
