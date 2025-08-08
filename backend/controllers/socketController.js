// server/controllers/socketController.js
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { getSocketByUserId } from '../socketState.js';

const baseMeta = (m) => ({
    id: m._id.toString(),
    senderId: m.senderId,
    receiverId: m.receiverId,
    senderName: m.senderName,
    receiverName: m.receiverName,
    timestamp: m.createdAt,
    delivered: !!m.delivered,
    seen: !!m.seen,
    seenAt: m.seenAt || null
});

export const formatTextMessage = (m) => ({ ...baseMeta(m), content: m.content });
export const formatFileMessage = (m) => ({ ...baseMeta(m), isVideo: m.fileType?.startsWith('video/'), fileName: m.fileName, fileType: m.fileType, fileData: m.fileData, fileSize: m.fileSize || m.fileData?.length || 0 });
export const formatVoiceMessage = (m) => ({ ...baseMeta(m), voiceData: m.voiceData, voiceDuration: m.voiceDuration });

export const getLastSeenId = (socket) => {
    const id = socket.handshake.auth.serverOffset;
    return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
};

export const emitMessagesToClient = (socket, list) => {
    list.forEach((m) => {
        if (m.isVoice) socket.emit('voice received', formatVoiceMessage(m));
        else if (m.isFile) {
            if (m.fileType?.startsWith('video/')) socket.emit('video received', formatFileMessage(m));
            else socket.emit('file received', formatFileMessage(m));
        } else socket.emit('chat message', formatTextMessage(m));
    });
};

export const loadInitialMessages = async (socket, userId, role, io) => {
    try {
        const lastSeen = getLastSeenId(socket);
        let messages;

        if (role === 'admin') {
            messages = await Message.find({
                $or: [{ senderId: userId }, { receiverId: userId }],
                ...(lastSeen && { _id: { $gt: lastSeen } })
            }).sort({ createdAt: 1 });
        } else {
            const admin = await User.findOne({ role: 'admin' });
            if (!admin) return socket.emit('history loaded');
            messages = await Message.find({
                $or: [
                    { senderId: userId, receiverId: admin._id },
                    { senderId: admin._id, receiverId: userId }
                ],
                ...(lastSeen && { _id: { $gt: lastSeen } })
            }).sort({ createdAt: 1 });
        }

        // 1) send history
        emitMessagesToClient(socket, messages);

        // 2) mark messages TO this user as delivered and notify original senders
        const toThisUser = messages.filter(m => String(m.receiverId) === String(userId) && !m.delivered);
        if (toThisUser.length) {
            const ids = toThisUser.map(m => m._id);
            await Message.updateMany({ _id: { $in: ids } }, { $set: { delivered: true } });
            for (const m of toThisUser) {
                const s = getSocketByUserId(String(m.senderId), io);
                s?.emit('messages delivered', { messageIds: [m._id.toString()] });
            }
        }

        socket.emit('history loaded');
    } catch (e) {
        console.error('Message loading error:', e);
        socket.emit('history loaded');
    }
};

export const handleTextMessage = async (socket, io, msg, userId, name, role, cb) => {
    try {
        const receiver = role === 'admin'
            ? await User.findById(msg.receiverId)
            : await User.findOne({ role: 'admin' });

        const room = `room_admin_${role === 'admin' ? userId : receiver._id}_user_${role === 'admin' ? msg.receiverId : userId}`;
        const inRoom = io.sockets.adapter.rooms.get(room)?.size || 0;
        const isDelivered = inRoom > 1;

        const saved = await Message.create({
            content: msg.content,
            senderId: userId,
            senderName: name,
            receiverId: receiver._id,
            receiverName: receiver.name,
            delivered: isDelivered
        });

        io.to(room).emit('chat message', formatTextMessage(saved));
        cb?.();
    } catch (e) {
        console.error('Text message error:', e);
        cb?.({ error: 'Failed to save message' });
    }
};

export const handleFileUpload = async (socket, io, file, userId, name, role, cb) => {
    try {
        const receiver = role === 'admin' ? await User.findById(file.receiverId) : await User.findOne({ role: 'admin' });
        const room = `room_admin_${role === 'admin' ? userId : receiver._id}_user_${role === 'admin' ? receiver._id : userId}`;
        const inRoom = io.sockets.adapter.rooms.get(room)?.size || 0;
        const delivered = inRoom > 1;

        // validations trimmed for brevity…

        const newMsg = await Message.create({
            senderName: name,
            receiverName: receiver.name,
            senderId: userId,
            receiverId: receiver._id,
            isFile: true,
            isImage: file.fileType?.startsWith('image/'),
            fileName: file.fileName,
            fileType: file.fileType,
            fileData: file.fileData,
            fileSize: file.fileData?.length || 0,
            delivered
        });

        const payload = formatFileMessage(newMsg);
        if (payload.isVideo) io.to(room).emit('video received', payload);
        else if (payload.isImage) io.to(room).emit('image received', { ...payload, isImage: true });
        else io.to(room).emit('file received', payload);

        cb?.({ success: true, messageId: newMsg._id, fileType: file.fileType });
    } catch (e) {
        console.error('File upload error:', e);
        cb?.({ success: false, error: 'Failed to upload file', tempId: file.tempId });
    }
};

export const handleVoiceUpload = async (socket, io, voice, userId, name, role, cb) => {
    try {
        const receiver = role === 'admin' ? await User.findById(voice.receiverId) : await User.findOne({ role: 'admin' });
        const room = `room_admin_${role === 'admin' ? userId : receiver._id}_user_${role === 'admin' ? receiver._id : userId}`;
        const inRoom = io.sockets.adapter.rooms.get(room)?.size || 0;
        const delivered = inRoom > 1;

        const duration = Math.max(0.1, Math.min(parseFloat(voice.voiceDuration) || 0, 1800));

        const newMsg = await Message.create({
            senderName: name,
            receiverName: receiver.name,
            senderId: userId,
            receiverId: receiver._id,
            isVoice: true,
            voiceData: voice.voiceData,
            voiceDuration: duration,
            delivered
        });

        io.to(room).emit('voice received', formatVoiceMessage(newMsg));
        cb?.({ success: true, messageId: newMsg._id.toString() });
    } catch (e) {
        console.error('Voice upload error:', e);
        cb?.({ success: false, error: 'Failed to save voice message' });
    }
};

export function setupMessageHandlers(socket, userId, role, name, io) {
    socket.on('chat message', (data, _clientOffset, cb) => handleTextMessage(socket, io, data, userId, name, role, cb));
    socket.on('file upload', (data, cb) => handleFileUpload(socket, io, data, userId, name, role, cb));
    socket.on('voice upload', (data, cb) => handleVoiceUpload(socket, io, data, userId, name, role, cb));
    socket.on('image upload', (data, cb) => handleFileUpload(socket, io, { ...data, isVideo: false }, userId, name, role, cb));


    // ✅ Receiver confirms delivery of a live message (text/image/file/video/voice)
    socket.on('message delivered', async ({ messageId }) => {
        try {
            const msg = await Message.findByIdAndUpdate(
                messageId,
                { delivered: true },
                { new: true }
            );
            if (msg) {
                const s = getSocketByUserId(String(msg.senderId), io);
                s?.emit('messages delivered', { messageIds: [String(msg._id)] });
            }
        } catch (e) {
            console.error('Delivery status update failed:', e);
        }
    });

    // ✅ Seen logic (pair-based) — still useful when switching chats or bulk marking
    socket.on('mark messages seen', async ({ senderId, receiverId }) => {
        try {
            const result = await Message.updateMany(
                { senderId, receiverId, seen: false },
                { $set: { seen: true, seenAt: new Date(), delivered: true } } // seen implies delivered
            );

            // Send back explicit IDs so the sender updates ticks deterministically
            const seenMsgs = await Message.find({ senderId, receiverId, seen: true }).select('_id');
            const ids = seenMsgs.map(d => d._id.toString());

            const s = getSocketByUserId(String(senderId), io);
            if (s) {
                s.emit('messages seen', { receiverId, messageIds: ids });
                s.emit('messages delivered', { messageIds: ids }); // ensure ✓✓ as well
            }
        } catch (e) {
            console.error('Error marking seen:', e);
        }
    });

    // ✅ Seen logic (ID-based) — bulletproof for media & races
    socket.on('mark messages seen by ids', async ({ messageIds = [] }) => {
        try {
            const ids = messageIds.map(id => new mongoose.Types.ObjectId(String(id)));

            // Mark seen + delivered
            const res = await Message.updateMany(
                { _id: { $in: ids }, seen: false },
                { $set: { seen: true, seenAt: new Date(), delivered: true } }
            );

            // Notify original senders; group by sender
            const msgs = await Message.find({ _id: { $in: ids } }).select('senderId receiverId _id');
            const bySender = msgs.reduce((acc, m) => {
                const k = String(m.senderId);
                (acc[k] ||= { receiverId: String(m.receiverId), ids: [] }).ids.push(String(m._id));
                return acc;
            }, {});

            for (const [senderId, payload] of Object.entries(bySender)) {
                const s = getSocketByUserId(senderId, io);
                if (s) {
                    s.emit('messages seen', { receiverId: payload.receiverId, messageIds: payload.ids });
                    s.emit('messages delivered', { messageIds: payload.ids });
                }
            }
        } catch (err) {
            console.error('mark messages seen by ids failed:', err);
        }
    });

}