// controllers/VideoController.js
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { getSocketByUserId } from '../socketState.js';

const TEMP_DIR = './temp_uploads';
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

export const videochanks = async (req, res) => {
    try {
        const {
            uploadId,           // client temp id
            chunkIndex, totalChunks,
            fileName, fileType,
            receiverId, receiverName,
            senderId, senderName
        } = req.body;

        const io = req.io;
        const chunk = req.body.chunk; // base64
        const chunkBuf = Buffer.from(chunk, 'base64');

        // 1) write this chunk
        const chunkPath = path.join(TEMP_DIR, `${uploadId}_${chunkIndex}`);
        fs.writeFileSync(chunkPath, chunkBuf);

        // 2) if not all chunks yet, just ack
        const uploadedChunks = fs.readdirSync(TEMP_DIR).filter(f => f.startsWith(`${uploadId}_`));
        if (uploadedChunks.length < Number(totalChunks)) {
            return res.json({ success: true, message: 'Chunk received' });
        }

        // 3) assemble
        const assembledPath = path.join(TEMP_DIR, `${uploadId}_assembled`);
        const ws = fs.createWriteStream(assembledPath);
        for (let i = 0; i < Number(totalChunks); i++) {
            const p = path.join(TEMP_DIR, `${uploadId}_${i}`);
            ws.write(fs.readFileSync(p));
        }
        ws.end();

        ws.on('finish', async () => {
            try {
                const fullBuf = fs.readFileSync(assembledPath);
                const base64Video = fullBuf.toString('base64');

                // 4) compute delivered by checking if both are in their private room
                //    Build room name: room_admin_<adminId>_user_<userId>
                const [sender, receiver] = await Promise.all([
                    User.findById(senderId),
                    User.findById(receiverId),
                ]);
                if (!sender || !receiver) {
                    throw new Error('Sender or receiver not found');
                }

                const adminId = sender.role === 'admin' ? sender._id : receiver._id;
                const userId = sender.role === 'admin' ? receiver._id : sender._id;
                const room = `room_admin_${adminId}_user_${userId}`;
                const inRoom = io.sockets.adapter.rooms.get(room)?.size || 0;
                const delivered = inRoom > 1;

                // 5) save Message like other files
                const newMsg = await Message.create({
                    senderId: new mongoose.Types.ObjectId(senderId),
                    senderName,
                    receiverId: new mongoose.Types.ObjectId(receiverId),
                    receiverName,
                    isFile: true,
                    fileName,
                    fileType,               // e.g. 'video/webm' / 'video/mp4'
                    fileData: base64Video,  // base64
                    delivered,              // ✅ for ticks
                });

                // 6) cleanup temp files
                uploadedChunks.forEach(f => fs.unlinkSync(path.join(TEMP_DIR, f)));
                fs.unlinkSync(assembledPath);

                // 7) unified payload (matches your formatFileMessage shape)
                const payload = {
                    id: newMsg._id.toString(),
                    fileName: newMsg.fileName,
                    fileType: newMsg.fileType,
                    fileData: newMsg.fileData,
                    fileSize: newMsg.fileData.length,
                    senderId: newMsg.senderId,
                    receiverId: newMsg.receiverId,
                    senderName: newMsg.senderName,
                    receiverName: newMsg.receiverName,
                    timestamp: newMsg.createdAt,
                    isVideo: true,
                    delivered: !!newMsg.delivered,
                    seen: !!newMsg.seen,
                    seenAt: newMsg.seenAt || null,
                    tempId: uploadId,       // ✅ so the sender can replace the temp bubble
                };

                // 8) emit to the private room so BOTH see it live,
                //    but include tempId so sender replaces temp instead of duplicating
                io.to(room).emit('video received', payload);

                // 9) also return the saved message to the uploader (your existing flow)
                return res.json({ success: true, message: payload });
            } catch (err) {
                console.error('assemble/emit error:', err);
                return res.status(500).json({ success: false, error: 'Assembly failed' });
            }
        });
    } catch (err) {
        console.error('videochanks error:', err);
        res.status(500).json({ success: false, error: 'Chunk save failed' });
    }
};