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
import Message from './models/Message.js';
import { onlineUsers } from './socketState.js';


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
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  }
});


// ✅ Helper function to get socket by userId
function getSocketByUserId(userId) {
  const socketId = onlineUsers.get(userId);
  if (!socketId) {
    console.log(`⚠️ No socket found for user ${userId}`);
    return null;
  }
  return io.sockets.sockets.get(socketId);
}

// ✅ Socket.IO connection
io.on('connection', async (socket) => {
  const { userId, role, name } = socket.handshake.auth || {};

  if (!userId || !role) {
    console.log(`❌ Connection rejected: Missing userId or role`);
    return socket.disconnect(true);
  }

  console.log(`🔌 ${role.toUpperCase()} CONNECTED: ${name} (${userId})`);
  onlineUsers.set(userId, socket.id);
  console.log("🧩 Current online users:", [...onlineUsers.keys()]);

  await User.findByIdAndUpdate(userId, { isOnline: true });
  io.emit('user status updated', { userId, isOnline: true });

  if (role === 'admin') {
    const allUsers = await User.find({ role: 'user' });
    allUsers.forEach(user => {
      const room = `room_admin_${userId}_user_${user._id}`;
      socket.join(room);
      console.log(`🏠 Admin ${name} joined room with User ${user.name}: ${room}`);
    });
  } else {
    const admin = await User.findOne({ role: 'admin' });
    if (admin) {
      const room = `room_admin_${admin._id}_user_${userId}`;
      socket.join(room);
      console.log(`🏠 User ${name} joined room with Admin ${admin.name}: ${room}`);
    }
  }

  // ✅ Load previous messages and setup handlers
  await loadInitialMessages(socket, userId, role);
  setupMessageHandlers(socket, userId, role, name, io);

  // ✅ Handle seen logic
  socket.on("mark messages seen", async ({ senderId, receiverId }) => {
    try {
      console.log(`👁️ [${name}] marking messages as seen from sender ${senderId} to receiver ${receiverId}`);

      const result = await Message.updateMany(
        { senderId, receiverId, seen: false },
        { $set: { seen: true, seenAt: new Date() } }
      );

      console.log(`✅ Seen status updated for ${result.modifiedCount} message(s)`);

      const senderSocket = getSocketByUserId(senderId);
      if (senderSocket) {
        console.log(`📩 Notifying sender ${senderId} that messages were seen`);
        senderSocket.emit("messages seen", { receiverId });
      } else {
        console.log(`⚠️ Sender ${senderId} not currently online`);
      }
    } catch (err) {
      console.error("❌ Error updating seen messages:", err);
    }
  });

  // ✅ On disconnect
  socket.on('disconnect', async () => {
    onlineUsers.delete(userId);
    console.log(`🔌 DISCONNECTED: ${name} (${userId})`);
    console.log("🧩 Remaining online users:", [...onlineUsers.keys()]);

    const user = await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen: new Date(),
    }, { new: true });

    io.to(`viewing-${userId}`).emit('user status updated', {
      userId,
      isOnline: false,
      lastSeen: user?.lastSeen || new Date(),
    });
  });
});

// ✅ Routes
import userRoutes from './routes/userRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import createDebugRoutes from './routes/debugRoutes.js';

app.use('/api/users', userRoutes);
app.use('/api/video', (req, res, next) => {
  req.io = io;
  next();
}, videoRoutes);
app.use('/api/debug', createDebugRoutes(io));

// ✅ Connect to MongoDB
connectDB();

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// ✅ Global error handlers
process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});