// routes/debugRoutes.js

import express from 'express';
import User from '../models/User.js'; // import your user model

const router = express.Router();

export default function createDebugRoutes(io) {
  router.get('/rooms', async (req, res) => {
    const rooms = io.sockets.adapter.rooms;
    const socketsMap = io.sockets.sockets;
    const result = {};

    for (const [roomName, socketSet] of rooms.entries()) {
      // Filter only admin-user rooms
      if (!roomName.startsWith('room_admin_')) continue;

      const memberNames = [];

      for (const socketId of socketSet) {
        const socket = socketsMap.get(socketId);
        const { userId, name, role } = socket.handshake.auth || {};
        if (name) {
          memberNames.push(`${role === 'admin' ? 'Admin' : 'User'} ${name}`);
        }
      }

      result[roomName] = {
        members: memberNames,
        count: memberNames.length
      };
    }

    res.json(result);
  });

  return router;
}