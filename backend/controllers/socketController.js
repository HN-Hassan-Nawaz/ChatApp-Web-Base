import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { getSocketByUserId } from '../socketState.js';



export const formatTextMessage = (msg) => ({
    id: msg._id.toString(),
    content: msg.content,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    senderName: msg.senderName,
    receiverName: msg.receiverName,
    timestamp: msg.createdAt,
});


// export const formatTextMessage = (msg) => ({
//     id: msg._id.toString(),
//     content: msg.content,
//     senderId: msg.senderId,
//     receiverId: msg.receiverId,
//     senderName: msg.senderName,
//     receiverName: msg.receiverName,
//     timestamp: msg.createdAt,
//     delivered: msg.delivered,
//     seen: msg.seen,
// });



export const formatFileMessage = (msg) => ({
    id: msg._id.toString(),
    fileName: msg.fileName,
    fileType: msg.fileType,
    fileData: msg.fileData,
    fileSize: msg.fileSize || msg.fileData.length,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    senderName: msg.senderName,
    receiverName: msg.receiverName,
    timestamp: msg.createdAt,
    isVideo: msg.fileType?.startsWith('video/')
});


export const formatVoiceMessage = (msg) => ({
    id: msg._id.toString(),
    voiceData: msg.voiceData,
    voiceDuration: msg.voiceDuration,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    senderName: msg.senderName,
    receiverName: msg.receiverName,
    timestamp: msg.createdAt,
});


export const getLastSeenId = (socket) => {
    const lastSeen = socket.handshake.auth.serverOffset;
    if (!mongoose.Types.ObjectId.isValid(lastSeen)) return null;
    return new mongoose.Types.ObjectId(lastSeen);
};


export const emitMessagesToClient = (socket, messages) => {
    messages.forEach((msg) => {
        if (msg.isVoice) {
            socket.emit('voice received', formatVoiceMessage(msg));
        } else if (msg.isFile) {
            socket.emit('file received', formatFileMessage(msg));
        } else {
            socket.emit('chat message', formatTextMessage(msg));
        }
    });
};


export const loadInitialMessages = async (socket, userId, role) => {
    try {
        let messages;
        const lastSeen = getLastSeenId(socket);

        if (role === 'admin') {
            messages = await Message.find({
                $or: [{ senderId: userId }, { receiverId: userId }],
                ...(lastSeen && { _id: { $gt: lastSeen } }),
            }).sort({ createdAt: 1 });
        } else {
            const adminUser = await User.findOne({ role: 'admin' });
            if (!adminUser) {
                console.log('Admin user not found');
                return socket.emit('history loaded');
            }

            messages = await Message.find({
                $or: [
                    { senderId: userId, receiverId: adminUser._id },
                    { senderId: adminUser._id, receiverId: userId },
                ],
                ...(lastSeen && { _id: { $gt: lastSeen } }),
            }).sort({ createdAt: 1 });
        }

        console.log(`📚 Loading ${messages.length} messages for ${role} ${userId}`);
        emitMessagesToClient(socket, messages);
        socket.emit('history loaded');
    } catch (err) {
        console.error('Message loading error:', err);
        socket.emit('history loaded');
    }
};


export const handleTextMessage = async (socket, io, msgData, userId, name, role, callback) => {
    try {
        const { content, receiverId, receiverName } = msgData;
        const receiver = role === 'admin'
            ? await User.findById(receiverId)
            : await User.findOne({ role: 'admin' });

        const room = `room_admin_${role === 'admin' ? userId : receiver._id}_user_${role === 'admin' ? receiverId : userId}`;
        const roomMembers = io.sockets.adapter.rooms.get(room);
        const isDelivered = roomMembers?.size > 1;

        console.log(`💬 Message from ${name} to ${receiver.name}`);
        console.log(`🔗 Room: ${room}`);
        console.log(`👥 Members in room: ${roomMembers ? roomMembers.size : 0}`);
        console.log(`📦 Message delivered? ${isDelivered}`);


        const saved = await Message.create({
            content,
            senderId: userId,
            senderName: name,
            receiverId: receiver._id,
            receiverName: receiver.name,
            delivered: isDelivered,
        });

        const messageData = formatTextMessage(saved);

        // ✅ Emit only to private room
        io.to(room).emit('chat message', messageData);

        if (typeof callback === 'function') {
            callback(); // ✅ safe
        }

    } catch (err) {
        console.error('Text message error:', err);
        callback({ error: 'Failed to save message' });
    }
};



export const handleFileUpload = async (socket, io, fileData, userId, name, role, callback) => {
    try {
        const { fileName, fileData: fileContent, fileType, receiverName, tempId, isVideo } = fileData;
        const actualReceiver = role === 'admin' ? receiverName : 'hassan nawaz';

        // Validate file size (50MB max)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (fileContent.length > maxSize) {
            throw new Error('File size exceeds 50MB limit');
        }

        // Validate video formats if it's a video
        if (isVideo) {
            const supportedVideoTypes = [
                'video/mp4',
                'video/webm',
                'video/quicktime', // .mov
                'video/x-msvideo' // .avi
            ];

            if (!supportedVideoTypes.includes(fileType)) {
                throw new Error('Unsupported video format. Please use MP4, WebM, MOV, or AVI');
            }
        }

        // Create message in database
        const newMsg = await Message.create({
            senderName: name,
            receiverName: actualReceiver,
            senderId: userId,
            receiverId: role === 'admin' ? fileData.receiverId : (await User.findOne({ role: 'admin' }))._id,
            isFile: true,
            fileName,
            fileType,
            fileData: fileContent,
            fileSize: fileContent.length,
            createdAt: new Date(),
        });

        // Format the response
        const fileMessage = {
            ...formatFileMessage(newMsg),
            tempId,
            isVideo: fileType.startsWith('video/') // Explicitly mark video files
        };

        // Broadcast to relevant clients
        if (isVideo) {
            io.emit('video received', fileMessage);
        } else {
            io.emit('file received', fileMessage);
        }

        callback({
            success: true,
            messageId: newMsg._id,
            fileType
        });

    } catch (err) {
        console.error('File upload error:', err);

        // Differentiate between validation errors and system errors
        const errorMessage = err.message.includes('Unsupported') ||
            err.message.includes('exceeds') ?
            err.message :
            'Failed to upload file';

        callback({
            success: false,
            error: errorMessage,
            tempId: fileData.tempId // Include tempId to help client clean up
        });
    }
};


export const handleVoiceUpload = async (socket, io, voiceData, userId, name, role, callback) => {
    try {
        console.log('📥 Voice upload triggered');
        console.log('📏 Voice data size:', (voiceData.voiceData.length / 1024).toFixed(2), 'KB');
        console.log('⏱ Duration:', voiceData.voiceDuration);

        const actualReceiver = role === 'admin' ? voiceData.receiverName : 'hassan nawaz';
        const duration = parseFloat(voiceData.voiceDuration) || 0;
        const validatedDuration = Math.max(0.1, Math.min(duration, 1800));

        const newMsg = await Message.create({
            senderName: name,
            receiverName: actualReceiver,
            senderId: userId,
            receiverId: role === 'admin' ? voiceData.receiverId : (await User.findOne({ role: 'admin' }))._id,
            isVoice: true,
            voiceData: voiceData.voiceData,
            voiceDuration: validatedDuration,
            createdAt: new Date(),
        });

        const voiceMessage = formatVoiceMessage(newMsg);
        io.emit('voice received', voiceMessage);
        callback({ success: true, messageId: newMsg._id.toString() });

    } catch (err) {
        console.error('❌ Voice upload error:', err);
        callback({ success: false, error: 'Failed to save voice message' });
    }
};


// image method 
export const handleImageUpload = async (socket, io, imageData, userId, name, role, callback) => {
    try {
        const actualReceiver = role === 'admin' ? imageData.receiverName : 'hassan nawaz';

        const newMsg = await Message.create({
            senderName: name,
            receiverName: actualReceiver,
            senderId: userId,
            receiverId: role === 'admin' ? imageData.receiverId : (await User.findOne({ role: 'admin' }))._id,
            isFile: true,
            isImage: true,
            fileName: imageData.fileName,
            fileType: imageData.fileType,
            fileData: imageData.fileData,
            createdAt: new Date()
        });

        const imageMessage = {
            id: newMsg._id.toString(),
            fileName: newMsg.fileName,
            fileType: newMsg.fileType,
            fileData: newMsg.fileData,
            senderId: newMsg.senderId,
            receiverId: newMsg.receiverId,
            senderName: newMsg.senderName,
            receiverName: newMsg.receiverName,
            timestamp: newMsg.createdAt,
            isImage: true
        };

        io.emit("image received", imageMessage);
        callback({ success: true, messageId: newMsg._id.toString() });

    } catch (err) {
        console.error("Image upload error:", err);
        callback({ success: false, error: "Failed to upload image" });
    }
};


export function setupMessageHandlers(socket, userId, role, name, io) {
    socket.on('chat message', (msgData, clientOffset, callback) =>
        handleTextMessage(socket, io, msgData, userId, name, role, callback)
    );

    socket.on('file upload', (fileData, callback) =>
        handleFileUpload(socket, io, fileData, userId, name, role, callback)
    );

    socket.on('voice upload', (voiceData, callback) =>
        handleVoiceUpload(socket, io, voiceData, userId, name, role, callback)
    );

    socket.on("mark messages seen", async ({ senderId, receiverId }) => {
        try {
            console.log(`👁️ [${name}] marking messages as seen from sender ${senderId} to receiver ${receiverId}`);

            const result = await Message.updateMany(
                { senderId, receiverId, seen: false },
                { $set: { seen: true, seenAt: new Date() } }
            );

            console.log(`✅ Seen status updated for ${result.modifiedCount} message(s)`);

            // ✅ Fix here by passing 'io'
            console.log(`🧠 Checking if sender (${senderId}) is online...`);
            const senderSocket = getSocketByUserId(senderId, io);
            if (senderSocket) {
                senderSocket.emit("messages seen", { receiverId });
                console.log(`📩 Sent 'messages seen' event to sender (${senderId})`);
            } else {
                console.log(`⚠️ Sender (${senderId}) is not connected`);
            }
        } catch (err) {
            console.error("❌ Error marking messages as seen:", err);
        }
    });




    socket.on("image upload", (imageData, callback) =>
        handleImageUpload(socket, io, imageData, userId, name, role, callback)
    );

    socket.on("message delivered", async ({ messageId }) => {
        try {
            await Message.findByIdAndUpdate(messageId, { delivered: true });
        } catch (err) {
            console.error("Delivery status update failed:", err);
        }
    });
}