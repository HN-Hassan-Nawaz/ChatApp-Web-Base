import Message from '../models/Message.js';
import mongoose from 'mongoose';

export default function socketHandler(io) {
    io.on('connection', async (socket) => {
        console.log("🟢 New user connected:", socket.id);

        const currentUser = socket.handshake.auth.name;
        const currentRole = socket.handshake.auth.role;

        let lastSeen = socket.handshake.auth.serverOffset;
        if (!mongoose.Types.ObjectId.isValid(lastSeen)) {
            lastSeen = new mongoose.Types.ObjectId("000000000000000000000000");
        } else {
            lastSeen = new mongoose.Types.ObjectId(lastSeen);
        }

        // Initial message load with proper filtering
        try {
            const messages = await Message.find({
                _id: { $gt: lastSeen },
                $or: [
                    { senderName: currentUser },
                    { receiverName: currentUser },
                    // Admin can see all messages where they're either sender or receiver
                    ...(currentRole === 'admin' ? [
                        { receiverName: 'Admin' }
                    ] : [])
                ]
            }).sort({ _id: 1 });

            messages.forEach(m => {
                const commonData = {
                    id: m._id.toString(),
                    senderName: m.senderName,
                    receiverName: m.receiverName,
                    timestamp: m.createdAt,
                };

                if (m.isVoice) {
                    socket.emit('voice received', { ...commonData, voiceData: m.voiceData, voiceDuration: m.voiceDuration });
                } else if (m.isFile) {
                    socket.emit('file received', {
                        ...commonData,
                        fileName: m.fileName,
                        fileType: m.fileType,
                        fileData: m.fileData,
                        fileSize: m.fileSize || m.fileData.length
                    });
                } else {
                    socket.emit('chat message', { ...commonData, content: m.content });
                }
            });
        } catch (err) {
            console.error("Message fetch error:", err);
        }

        // In your chat message handler
        socket.on("chat message", async (msgData, clientOffset, callback) => {
            const { content, receiverName } = msgData;
            const senderName = socket.handshake.auth.name;
            const senderRole = socket.handshake.auth.role;

            // Validate receiver
            let actualReceiver;
            if (senderRole === 'admin') {
                // Admin must specify a valid receiver
                if (!receiverName) {
                    return callback({ error: "Admin must specify a receiver" });
                }
                actualReceiver = receiverName;
            } else {
                // Regular users can only message Admin
                actualReceiver = 'Admin';
            }

            try {
                const saved = await Message.create({
                    content,
                    clientOffset,
                    senderName,
                    receiverName: actualReceiver
                });

                // Emit back to sender for their UI
                socket.emit('chat message', {
                    id: saved._id.toString(),
                    content,
                    senderName,
                    receiverName: actualReceiver,
                    timestamp: saved.createdAt
                });

                // Find receiver sockets and emit to them
                const receiverSockets = await io.fetchSockets();
                receiverSockets.forEach(s => {
                    if (s.handshake.auth.name === actualReceiver) {
                        s.emit('chat message', {
                            id: saved._id.toString(),
                            content,
                            senderName,
                            receiverName: actualReceiver,
                            timestamp: saved.createdAt
                        });
                    }
                });

                callback();
            } catch (err) {
                if (err.code === 11000) return callback();
                console.error("Message save error:", err);
                callback({ error: "Failed to save message" });
            }
        });

        // Load history with proper filtering
        socket.on("load history", async () => {
            const user = socket.handshake.auth.name;
            const role = socket.handshake.auth.role;

            const query = role === "admin"
                ? {
                    $or: [
                        { senderName: user }, // Messages sent by admin
                        { receiverName: user }, // Messages received by admin
                        { receiverName: "Admin" } // All messages to Admin
                    ]
                }
                : {
                    $or: [
                        { senderName: user, receiverName: "Admin" }, // User's sent messages
                        { senderName: "Admin", receiverName: user } // User's received messages
                    ]
                };

            const messages = await Message.find(query).sort({ createdAt: 1 });

            messages.forEach(msg => {
                const base = {
                    id: msg._id.toString(),
                    senderName: msg.senderName,
                    receiverName: msg.receiverName,
                    timestamp: msg.createdAt,
                };

                if (msg.isVoice) {
                    socket.emit("voice received", { ...base, voiceData: msg.voiceData, voiceDuration: msg.voiceDuration });
                } else if (msg.isFile) {
                    socket.emit("file received", {
                        ...base,
                        fileName: msg.fileName,
                        fileType: msg.fileType,
                        fileData: msg.fileData,
                        fileSize: msg.fileSize || msg.fileData.length,
                    });
                } else {
                    socket.emit("chat message", { ...base, content: msg.content });
                }
            });
        });






        socket.on("file upload", async ({ fileName, fileData, fileType, receiverName }) => {
            const senderName = socket.handshake.auth.name;
            const senderRole = socket.handshake.auth.role;
            const actualReceiver = senderRole !== 'admin' ? 'Admin' : receiverName;

            try {
                const newMsg = await Message.create({
                    senderName,
                    receiverName: actualReceiver,
                    isFile: true,
                    fileName,
                    fileType,
                    fileData,
                    fileSize: fileData.length
                });

                io.emit("file received", {
                    id: newMsg._id.toString(),
                    fileName,
                    fileType,
                    fileData,
                    fileSize: fileData.length,
                    senderName,
                    receiverName: actualReceiver,
                    timestamp: newMsg.createdAt
                });
            } catch (err) {
                console.error("File upload error:", err);
                socket.emit("file upload error", { message: "Failed to upload file" });
            }
        });

        socket.on("voice upload", async (voiceData, callback) => {
            const senderName = socket.handshake.auth.name;
            const senderRole = socket.handshake.auth.role;
            const actualReceiver = senderRole !== 'admin' ? 'Admin' : voiceData.receiverName;

            try {
                const duration = Math.max(0.1, Math.min(voiceData.voiceDuration || 0, 300));
                const newMsg = await Message.create({
                    senderName,
                    receiverName: actualReceiver,
                    isVoice: true,
                    voiceData: voiceData.voiceData,
                    voiceDuration: duration
                });

                io.emit("voice received", {
                    id: newMsg._id.toString(),
                    voiceData: voiceData.voiceData,
                    voiceDuration: duration,
                    senderName,
                    receiverName: actualReceiver,
                    timestamp: newMsg.createdAt
                });

                callback({ success: true, messageId: newMsg._id.toString() });
            } catch (err) {
                console.error("Voice upload error:", err);
                callback({ success: false, error: "Failed to save voice message" });
            }
        });

        socket.on('disconnect', () => {
            console.log('🔴 User disconnected:', socket.id);
        });
    });
}