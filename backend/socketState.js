// server/socketState.js
export const onlineUsers = new Map(); // key: userId (string) -> socket.id (string)

export function getSocketByUserId(userId, io) {
  const sid = onlineUsers.get(String(userId));
  return sid ? io.sockets.sockets.get(sid) : null;
}