// sockets/chatSocket.js
const ChatMessage = require('../models/chatMessageModel');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // 1. User/Driver joins their own personal room (using their userId / driverId)
    socket.on('join', ({ userId }) => {
      if (!userId) return;

      socket.join(userId);
      console.log(`${userId} joined room ${userId}`);
      socket.emit('joined', { room: userId });
    });

    // 2. Join chat room between two people (based on bookingId or rideId)
    socket.on('joinChat', ({ bookingId, rideId, userId, driverId }) => {
      let room;

      if (bookingId) {
        room = `booking_${bookingId}`;
      } else if (rideId) {
        room = `ride_${rideId}`;
      } else {
        // fallback — direct user-driver chat (less recommended)
        const ids = [userId, driverId].sort();
        room = `chat_${ids[0]}_${ids[1]}`;
      }

      socket.join(room);
      console.log(`${userId || driverId} joined chat room: ${room}`);

      socket.emit('chatJoined', { room });
    });

    // 3. Send message (main event)
    socket.on('sendMessage', async (data) => {
      try {
        const {
          bookingId,
          rideId,
          sender,     // userId or driverId (string)
          receiver,   // the other person's id (string)
          message,
        } = data;

        if (!sender || !receiver || !message?.trim()) {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }

        const newMessage = new ChatMessage({
          bookingId: bookingId || undefined,
          rideId: rideId || undefined,
          sender,
          receiver,
          message: message.trim(),
          createdAt: new Date(),
        });

        await newMessage.save();

        // Decide room name (same logic as joinChat)
        let room;
        if (bookingId) {
          room = `booking_${bookingId}`;
        } else if (rideId) {
          room = `ride_${rideId}`;
        } else {
          const ids = [sender, receiver].sort();
          room = `chat_${ids[0]}_${ids[1]}`;
        }

        // Send to both participants (in the room)
        io.to(room).emit('newMessage', {
          _id: newMessage._id,
          bookingId: newMessage.bookingId,
          rideId: newMessage.rideId,
          sender: newMessage.sender,
          receiver: newMessage.receiver,
          message: newMessage.message,
          createdAt: newMessage.createdAt,
        });

      } catch (err) {
        console.error('Error saving message:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Optional: Typing indicator
    socket.on('typing', ({ room, userId }) => {
      socket.to(room).emit('typing', { userId });
    });

    socket.on('stopTyping', ({ room }) => {
      socket.to(room).emit('stopTyping');
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};