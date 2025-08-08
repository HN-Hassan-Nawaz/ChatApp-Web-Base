// server/models/Message.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  content: String,
  clientOffset: { type: String, unique: true, sparse: true },

  senderName: String,
  receiverName: String,

  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // files / voice / image
  isFile: { type: Boolean, default: false },
  isImage: { type: Boolean, default: false },
  fileName: String,
  fileType: String,
  fileData: String,
  fileSize: Number,

  isVoice: { type: Boolean, default: false },
  voiceData: String,
  voiceDuration: Number,
  voiceMimeType: String,

  uploadId: String,
  chunkIndex: Number,
  totalChunks: Number,

  // ticks
  delivered: { type: Boolean, default: false },
  seen: { type: Boolean, default: false },
  seenAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Message', messageSchema);