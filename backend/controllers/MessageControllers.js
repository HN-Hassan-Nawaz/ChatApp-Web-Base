import Message from '../models/Message.js';

export const sendMessage = async (req, res) => {
  const { senderId, receiverId, content } = req.body;
  try {
    const message = await Message.create({ sender: senderId, receiver: receiverId, content });
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
};


// controllers/messageController.js
export const getMessages = async (req, res) => {
  const { userId, adminId } = req.query;

  try {
    // For admin: get all messages where admin is either sender or receiver
    if (req.user.role === 'admin') {
      const messages = await Message.find({
        $or: [
          { senderId: adminId },
          { receiverId: adminId }
        ]
      }).sort({ createdAt: 1 }).populate('senderId receiverId');

      return res.status(200).json(messages);
    }

    // For regular users: get messages between user and admin
    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: adminId },
        { senderId: adminId, receiverId: userId }
      ]
    }).sort({ createdAt: 1 }).populate('senderId receiverId');

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};