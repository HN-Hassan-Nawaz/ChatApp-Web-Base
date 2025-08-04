import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    content: String,
    clientOffset: { type: String, unique: true, sparse: true },
    senderName: String,
    receiverName: String,
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    isFile: { type: Boolean, default: false },
    fileName: { type: String },
    fileType: { type: String },
    fileData: { type: String },
    fileSize: { type: Number },
    isVoice: { type: Boolean, default: false },
    voiceData: { type: String },
    voiceDuration: { type: Number },
    voiceMimeType: { type: String },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Message', messageSchema);