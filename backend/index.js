// server/index.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './db/connectDB.js';
import { setupMessageHandlers, loadInitialMessages } from './controllers/socketController.js';
import User from './models/User.js';
import { onlineUsers } from './socketState.js';

dotenv.config();

const app = express();
const server = createServer(app);

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const io = new Server(server, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'], credentials: true },
  maxHttpBufferSize: 25 * 1024 * 1024,
  connectionStateRecovery: { maxDisconnectionDuration: 120000, skipMiddlewares: true }
});

io.on('connection', async (socket) => {
  const { userId, role, name } = socket.handshake.auth || {};
  if (!userId || !role) return socket.disconnect(true);

  onlineUsers.set(String(userId), socket.id);
  await User.findByIdAndUpdate(userId, { isOnline: true });
  io.emit('user status updated', { userId, isOnline: true });

  if (role === 'admin') {
    const users = await User.find({ role: 'user' });
    users.forEach(u => socket.join(`room_admin_${userId}_user_${u._id}`));
  } else {
    const admin = await User.findOne({ role: 'admin' });
    if (admin) socket.join(`room_admin_${admin._id}_user_${userId}`);
  }

  await loadInitialMessages(socket, userId, role, io);
  setupMessageHandlers(socket, userId, role, name, io);

  socket.on('disconnect', async () => {
    onlineUsers.delete(String(userId));
    const u = await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() }, { new: true });
    io.emit('user status updated', { userId, isOnline: false, lastSeen: u?.lastSeen || new Date() });
  });
});

// routes… (unchanged)
import userRoutes from './routes/userRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import createDebugRoutes from './routes/debugRoutes.js';
app.use('/api/users', userRoutes);
app.use('/api/video', (req, res, next) => { req.io = io; next(); }, videoRoutes);
app.use('/api/debug', createDebugRoutes(io));

connectDB();
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
