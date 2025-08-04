import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './db/connectDB.js';
import userRoutes from './routes/userRoutes.js';
import {
  setupMessageHandlers,
  loadInitialMessages
} from './controllers/socketController.js';

dotenv.config();

// Express App and HTTP Server
const app = express();
const server = createServer(app);

// Middleware
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  },
  maxHttpBufferSize: 25 * 1024 * 1024 ,

  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Handle Socket.IO Connections
io.on('connection', async (socket) => {
  console.log("🟢 New user connected:", socket.id);

  const { userId, role, name } = socket.handshake.auth || {};

  if (!userId || !role) {
    console.log('⚠️ Unauthenticated connection attempt');
    socket.disconnect(true);
    return;
  }

  try {
    await loadInitialMessages(socket, userId, role);
    setupMessageHandlers(socket, userId, role, name, io);

    socket.on('disconnect', (reason) => {
      console.log(`🔴 User disconnected: ${socket.id} (Reason: ${reason})`);
    });

  } catch (error) {
    console.error('❌ Connection setup error:', error);
    socket.emit('error', { message: 'Connection setup failed' });
  }
});





// API Routes
app.use('/api/users', userRoutes);

// Connect to MongoDB
connectDB();




// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});




// Global Error Handlers
process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});