// socketState.js

const onlineUsers = new Map();

function getSocketByUserId(userId, io) {
    const socketId = onlineUsers.get(userId);
    if (!socketId) {
        console.log(`⚠️ No socket found for user: ${userId}`);
        return null;
    }
    return io.sockets.sockets.get(socketId);
}

export { onlineUsers, getSocketByUserId };