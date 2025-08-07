// ✅ Updated `videoChunks` controller to fix duplicate video rendering
// File: controllers/VideoController.js

import express from 'express';
import fs from 'fs';
import path from 'path';
import Message from '../models/Message.js';

const router = express.Router();
const TEMP_DIR = './temp_uploads';
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

export const videochanks = async (req, res) => {
    const {
        uploadId, chunkIndex, totalChunks,
        fileName, fileType,
        receiverId, receiverName,
        senderId, senderName
    } = req.body;
    const chunk = req.body.chunk;
    const io = req.io;

    const chunkBuffer = Buffer.from(chunk, 'base64');
    const chunkPath = path.join(TEMP_DIR, `${uploadId}_${chunkIndex}`);
    fs.writeFileSync(chunkPath, chunkBuffer);

    const uploadedChunks = fs.readdirSync(TEMP_DIR).filter(file => file.startsWith(uploadId));

    if (uploadedChunks.length === parseInt(totalChunks)) {
        const fullVideoPath = path.join(TEMP_DIR, `${uploadId}_assembled.webm`);
        const writeStream = fs.createWriteStream(fullVideoPath);

        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(TEMP_DIR, `${uploadId}_${i}`);
            const chunkBuffer = fs.readFileSync(chunkPath);
            writeStream.write(chunkBuffer);
        }
        writeStream.end();

        writeStream.on('finish', async () => {
            const finalVideo = fs.readFileSync(fullVideoPath);
            const base64Video = finalVideo.toString('base64');

            const newMsg = await Message.create({
                senderId,
                senderName,
                receiverId,
                receiverName,
                isFile: true,
                isVideo: true,
                fileName,
                fileType,
                fileData: base64Video,
                createdAt: new Date().toISOString()
            });

            // Clean temp
            uploadedChunks.forEach(f => fs.unlinkSync(path.join(TEMP_DIR, f)));
            fs.unlinkSync(fullVideoPath);

            // Emit to sender and receiver both
            io.to(senderId).emit("video received", {
                ...newMsg._doc,
                isVideo: true,
                timestamp: newMsg.createdAt.toISOString(), // 🕒 Fix for invalid date
            });

            io.to(receiverId).emit("video received", {
                ...newMsg._doc,
                isVideo: true,
                timestamp: newMsg.createdAt.toISOString(),
            });


            res.json({ success: true, message: newMsg });
        });
    } else {
        res.json({ success: true, message: 'Chunk received' });
    }
};