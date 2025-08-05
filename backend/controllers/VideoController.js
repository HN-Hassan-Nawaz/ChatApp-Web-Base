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

    console.log(`🟡 Received chunk ${chunkIndex + 1}/${totalChunks} for uploadId: ${uploadId}`);

    fs.writeFileSync(chunkPath, chunkBuffer);

    const uploadedChunks = fs.readdirSync(TEMP_DIR).filter(file => file.startsWith(uploadId));

    console.log(`📦 Uploaded Chunks Count for ${uploadId}: ${uploadedChunks.length}/${totalChunks}`);

    // All chunks received
    if (uploadedChunks.length === parseInt(totalChunks)) {
         console.log(`✅ All chunks received for ${uploadId}. Assembling video...`);
        const fullVideoPath = path.join(TEMP_DIR, `${uploadId}_assembled.webm`);
        const writeStream = fs.createWriteStream(fullVideoPath);

        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(TEMP_DIR, `${uploadId}_${i}`);
            const chunkBuffer = fs.readFileSync(chunkPath);
            writeStream.write(chunkBuffer);
        }
        writeStream.end();

        writeStream.on('finish', async () => {
            console.log(`🎬 Video assembled for ${uploadId}. Reading and converting to base64...`);
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

            console.log(`🗑️ Cleaned up temporary chunks for ${uploadId}`);
            console.log(`✅ Final video message saved to DB. Message ID: ${newMsg._id}`);

            res.json({ success: true, message: newMsg });
        });

    } else {
        res.json({ success: true, message: 'Chunk received' });
    }
};
