import express from 'express';
import fs from 'fs';
import path from 'path';
import Message from '../models/Message.js';
const router = express.Router();

const TEMP_DIR = './temp_uploads';

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

export const videochanks = async (req, res) => {
    const { uploadId, chunkIndex, totalChunks, fileName, fileType, receiverId, receiverName, senderId, senderName } = req.body;
    const chunk = req.body.chunk;

    const chunkBuffer = Buffer.from(chunk, 'base64');
    const chunkPath = path.join(TEMP_DIR, `${uploadId}_${chunkIndex}`);

    fs.writeFileSync(chunkPath, chunkBuffer);

    const uploadedChunks = fs.readdirSync(TEMP_DIR).filter(file => file.startsWith(uploadId));

    // All chunks received
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
                fileName,
                fileType,
                fileData: base64Video,
                createdAt: new Date()
            });

            // Cleanup temp files
            uploadedChunks.forEach(f => fs.unlinkSync(path.join(TEMP_DIR, f)));
            fs.unlinkSync(fullVideoPath);

            res.json({ success: true, message: newMsg });
        });

    } else {
        res.json({ success: true, message: 'Chunk received' });
    }
};
