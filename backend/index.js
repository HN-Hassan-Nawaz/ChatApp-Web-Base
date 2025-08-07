import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './db/connectDB.js';
import {
  setupMessageHandlers,
  loadInitialMessages
} from './controllers/socketController.js';
import User from './models/User.js';

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
  maxHttpBufferSize: 25 * 1024 * 1024,

  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});


io.on('connection', async (socket) => {
  const { userId, role, name } = socket.handshake.auth || {};
  if (!userId || !role) {
    console.log('⚠️ Unauthenticated connection attempt');
    socket.disconnect(true);
    return;
  }

  // ✅ 1. Mark user as online (add here)
  await User.findByIdAndUpdate(userId, { isOnline: true });
  io.emit('user status updated', { userId, isOnline: true });

  // ✅ 2. Handle "viewing user" event (add this below the above)
  socket.on("viewing user", ({ targetUserId }) => {
    socket.join(`viewing-${targetUserId}`);
  });

  // ✅ 3. Continue your existing logic
  try {
    await loadInitialMessages(socket, userId, role);
    setupMessageHandlers(socket, userId, role, name, io);

    // ✅ 4. On disconnect: update lastSeen and broadcast to viewers
    socket.on('disconnect', async (reason) => {
      console.log(`🔴 User disconnected: ${socket.id} (Reason: ${reason})`);

      const user = await User.findByIdAndUpdate(
        userId,
        { isOnline: false, lastSeen: new Date() },
        { new: true }
      );

      // Only emit to people who are currently viewing this user
      io.to(`viewing-${userId}`).emit('user status updated', {
        userId,
        isOnline: false,
        lastSeen: user?.lastSeen || new Date(),
      });
    });

  } catch (error) {
    console.error('❌ Connection setup error:', error);
    socket.emit('error', { message: 'Connection setup failed' });
  }
});




import userRoutes from './routes/userRoutes.js';
import videoRoutes from './routes/videoRoutes.js';


// API Routes
app.use('/api/users', userRoutes);
app.use('/api/video', (req, res, next) => {
  req.io = io;
  next();
}, videoRoutes);




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