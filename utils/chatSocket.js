const ChatMessage = require('../models/chatMessageModel');
const mongoose = require('mongoose');

// ✅ Apna existing sendNotification import karo — path apne project ke hisaab se change karo
const { sendNotification } = require('../utils/sendNotification'); // ← path check karo

module.exports = (io) => {
  io.on('connection', (socket) => {
    // console.log(`\n✅ [SOCKET CONNECTED]`);
    // console.log(`   Socket ID : ${socket.id}`);
    // console.log(`   Time      : ${new Date().toISOString()}`);

    // ====================== 1. JOIN PERSONAL ROOM ======================
    socket.on('join', ({ userId, token }) => {
      console.log(`\n👤 [JOIN] Event received`);
      console.log(`   userId    : ${userId}`);
      console.log(`   Socket ID : ${socket.id}`);

      if (!userId) {
        console.log(`   ❌ ERROR: userId missing`);
        socket.emit('error', { message: 'userId is required' });
        return;
      }

      socket.join(userId);
      console.log(`   ✅ Joined personal room: ${userId}`);

      socket.emit('joined', {
        success: true,
        room: userId,
        message: 'Joined personal room successfully'
      });
    });

    // ====================== 2. JOIN CHAT ROOM ======================
    socket.on('joinChat', ({ bookingId, rideId, userId, driverId }) => {
      console.log(`\n🗣️ [JOIN CHAT] Event received`);
      console.log(`   bookingId : ${bookingId || 'N/A'}`);
      console.log(`   rideId    : ${rideId || 'N/A'}`);
      console.log(`   userId    : ${userId || 'N/A'}`);
      console.log(`   driverId  : ${driverId || 'N/A'}`);
      console.log(`   Socket ID : ${socket.id}`);

      let room;

      if (bookingId) {
        room = `booking_${bookingId}`;
      } else if (rideId) {
        room = `ride_${rideId}`;
      } else if (userId && driverId) {
        const ids = [userId, driverId].sort();
        room = `chat_${ids[0]}_${ids[1]}`;
      } else {
        console.log(`   ❌ ERROR: bookingId or rideId missing`);
        socket.emit('error', { message: 'bookingId or rideId is required' });
        return;
      }

      socket.join(room);
      console.log(`   ✅ Joined chat room: ${room}`);

      socket.emit('chatJoined', { success: true, room });
    });

    // ====================== 3. SEND MESSAGE ======================
    socket.on('sendMessage', async (data) => {
      console.log(`\n📨 [SEND MESSAGE] Event received`);
      console.log(`   bookingId : ${data.bookingId || 'N/A'}`);
      console.log(`   rideId    : ${data.rideId || 'N/A'}`);
      console.log(`   sender    : ${data.sender}`);
      console.log(`   receiver  : ${data.receiver}`);
      console.log(`   message   : "${data.message}"`);
      console.log(`   Socket ID : ${socket.id}`);

      try {
        const { bookingId, rideId, sender, receiver, message } = data;

        if (!sender || !receiver || !message?.trim()) {
          console.log(`   ❌ ERROR: sender, receiver or message missing`);
          socket.emit('error', { message: 'sender, receiver and message are required' });
          return;
        }

        // ====================== DB SAVE ======================
        const newMessage = new ChatMessage({
          bookingId: bookingId || undefined,
          rideId: rideId || undefined,
          sender,
          receiver,
          message: message.trim(),
          isRead: false,
        });

        await newMessage.save();
        console.log(`   ✅ Message saved to DB | ID: ${newMessage._id}`);

        // ====================== ROOM DETERMINE ======================
        let room;
        if (bookingId) room = `booking_${bookingId}`;
        else if (rideId) room = `ride_${rideId}`;
        else {
          const ids = [sender, receiver].sort();
          room = `chat_${ids[0]}_${ids[1]}`;
        }

        console.log(`   📤 Broadcasting to room: ${room}`);

        const messagePayload = {
          _id: newMessage._id,
          bookingId: newMessage.bookingId,
          rideId: newMessage.rideId,
          sender: newMessage.sender,
          receiver: newMessage.receiver,
          message: newMessage.message,
          createdAt: newMessage.createdAt,
          isRead: false,
        };

        io.to(room).emit('newMessage', messagePayload);
        console.log(`   ✅ newMessage emitted to room: ${room}`);

        // ====================== NOTIFICATION ======================
        // Receiver ka FCM token fetch karo — User ya Driver dono models check karo
        console.log(`\n   🔔 [NOTIFICATION] Starting notification process...`);
        console.log(`   🔔 Receiver ID : ${receiver}`);

        try {
          // Pehle User model mein dhundo
          let receiverUser = null;
          let receiverFcmToken = null;
          let senderName = 'Someone';

          // ── Receiver fetch karo ──
          const User = require('../models/userModel');     // ← path check karo
          const Driver = require('../models/driverModel'); // ← path check karo

          // User model mein dhundo
          receiverUser = await User.findById(receiver).select('fcmToken name').lean();
          if (receiverUser) {
            console.log(`   🔔 Receiver found in User model | Name: ${receiverUser.name}`);
            receiverFcmToken = receiverUser.fcmToken;
          }

          // Agar User mein nahi mila toh Driver model mein dhundo
          if (!receiverUser) {
            receiverUser = await Driver.findById(receiver).select('fcmToken name').lean();
            if (receiverUser) {
              console.log(`   🔔 Receiver found in Driver model | Name: ${receiverUser.name}`);
              receiverFcmToken = receiverUser.fcmToken;
            }
          }

          // Sender ka naam fetch karo notification ke liye
          const senderUser = await User.findById(sender).select('name').lean()
            || await Driver.findById(sender).select('name').lean();

          if (senderUser) {
            senderName = senderUser.name || 'Someone';
            console.log(`   🔔 Sender Name : ${senderName}`);
          }

          console.log(`   🔔 Receiver FCM Token : ${receiverFcmToken ? '✅ Present' : '❌ Missing or not found'}`);

          // FCM token hai to notification bhejo
          if (receiverFcmToken) {
            console.log(`   🔔 Sending push notification to receiver...`);

            const notificationPayload = {
              title: `New message from ${senderName}`,
              body: message.trim().length > 50
                ? message.trim().substring(0, 50) + '...'
                : message.trim(),
              type: 'chat_message',
              senderId: sender,
              bookingId: bookingId || null,
              rideId: rideId || null,
              messageId: newMessage._id.toString(),
            };

            console.log(`   🔔 Notification payload:`);
            console.log(`      title     : ${notificationPayload.title}`);
            console.log(`      body      : ${notificationPayload.body}`);
            console.log(`      type      : ${notificationPayload.type}`);
            console.log(`      senderId  : ${notificationPayload.senderId}`);
            console.log(`      bookingId : ${notificationPayload.bookingId || 'N/A'}`);
            console.log(`      rideId    : ${notificationPayload.rideId || 'N/A'}`);

            await sendNotification(receiverFcmToken, notificationPayload);

            console.log(`   ✅ [NOTIFICATION] Push notification sent successfully to receiver: ${receiver}`);
          } else {
            console.log(`   ⚠️  [NOTIFICATION] FCM token missing — notification NOT sent`);
            console.log(`   ⚠️  Receiver ID: ${receiver} | Check if fcmToken is saved in DB`);
          }

        } catch (notifErr) {
          // Notification fail hone pe message send fail nahi hoga
          console.error(`   ❌ [NOTIFICATION] Error sending notification`);
          console.error(`   ❌ Error   : ${notifErr.message}`);
          console.error(`   ❌ Stack   : ${notifErr.stack}`);
        }

      } catch (err) {
        console.error(`   ❌ Send Message Error:`, err.message);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ====================== 3.5. RECEIVE MESSAGE ======================
    socket.on('receiveMessage', async (data) => {
      console.log(`\n📩 [RECEIVE MESSAGE] Event received`);
      console.log(`   bookingId  : ${data.bookingId || 'N/A'}`);
      console.log(`   rideId     : ${data.rideId || 'N/A'}`);
      console.log(`   receiverId : ${data.receiverId || 'N/A'}`);
      console.log(`   Socket ID  : ${socket.id}`);

      try {
        const { bookingId, rideId, receiverId } = data;

        if (!receiverId) {
          console.log(`   ❌ ERROR: receiverId missing`);
          socket.emit('error', { message: 'receiverId is required' });
          return;
        }

        const filter = {
          receiver: receiverId,
          isRead: false,
        };

        if (bookingId) {
          filter.bookingId = bookingId;
          console.log(`   🔍 Filter includes bookingId: ${bookingId}`);
        }

        if (rideId) {
          filter.rideId = rideId;
          console.log(`   🔍 Filter includes rideId: ${rideId}`);
        }

        console.log(`   ⏳ Fetching unread messages for receiver: ${receiverId}`);

        const messages = await ChatMessage.find(filter)
          .select('_id sender receiver message createdAt isRead bookingId rideId')
          .sort({ createdAt: 1 })
          .lean();

        console.log(`   📦 Unread messages found: ${messages.length}`);

        if (messages.length === 0) {
          console.log(`   ℹ️  No unread messages for receiverId: ${receiverId}`);
          socket.emit('receiveMessage', {
            success: true,
            count: 0,
            messages: [],
            message: 'No new messages'
          });
          return;
        }

        console.log(`   📤 Delivering ${messages.length} messages to personal room: ${receiverId}`);

        io.to(receiverId).emit('receiveMessage', {
          success: true,
          count: messages.length,
          bookingId: bookingId || null,
          rideId: rideId || null,
          messages: messages
        });

        console.log(`   ✅ receiveMessage emitted to personal room: ${receiverId}`);

      } catch (err) {
        console.error(`   ❌ Receive Message Error:`, err.message);
        console.error(`   ❌ Stack:`, err.stack);
        socket.emit('error', { message: 'Failed to receive messages' });
      }
    });

    // ====================== 4. GET CHAT HISTORY ======================
    socket.on('getChatMessages', async (data) => {
      console.log(`\n📋 [GET CHAT MESSAGES] Event received`);
      console.log(`   userId      : ${data.userId}`);
      console.log(`   otherUserId : ${data.otherUserId}`);
      console.log(`   bookingId   : ${data.bookingId || 'N/A'}`);
      console.log(`   rideId      : ${data.rideId || 'N/A'}`);
      console.log(`   role        : ${data.role || 'N/A (defaulting to user)'}`);
      console.log(`   Socket ID   : ${socket.id}`);

      try {
        const { bookingId, rideId, otherUserId, userId, role } = data;

        if (!userId) {
          console.log(`   ❌ VALIDATION ERROR: userId is missing`);
          return socket.emit('error', { message: 'userId is required' });
        }

        if (!otherUserId) {
          console.log(`   ❌ VALIDATION ERROR: otherUserId is missing`);
          return socket.emit('error', { message: 'otherUserId is required' });
        }

        if (!role || (role !== 'user' && role !== 'driver')) {
          console.log(`   ⚠️  WARNING: role is missing or invalid ("${role}"), defaulting to 'user'`);
        }

        const deleteField = role === 'driver' ? 'isDeletedByDriver' : 'isDeletedByUser';
        console.log(`   🔑 Role           : ${role === 'driver' ? 'Driver' : 'User'}`);
        console.log(`   🔑 deleteField    : "${deleteField}"`);

        const filter = {
          $or: [
            { sender: userId, receiver: otherUserId },
            { sender: otherUserId, receiver: userId }
          ],
          [deleteField]: { $ne: true }
        };

        if (bookingId) {
          filter.bookingId = bookingId;
          console.log(`   🔍 Filter includes bookingId: ${bookingId}`);
        }

        if (rideId) {
          filter.rideId = rideId;
          console.log(`   🔍 Filter includes rideId: ${rideId}`);
        }

        console.log(`   🔍 Final filter: ${JSON.stringify(filter, null, 2)}`);
        console.log(`   ⏳ Querying database...`);

        const messages = await ChatMessage.find(filter)
          .select('_id sender receiver message createdAt edited isRead isDeletedByUser isDeletedByDriver')
          .sort({ createdAt: 1 })
          .limit(100)
          .lean();

        console.log(`   ✅ DB query successful`);
        console.log(`   📦 Total messages found : ${messages.length}`);

        if (messages.length > 0) {
          console.log(`   📅 First message at    : ${messages[0].createdAt}`);
          console.log(`   📅 Last message at     : ${messages[messages.length - 1].createdAt}`);
          console.log(`   🔎 Sample message IDs  : ${messages.slice(0, 3).map(m => m._id).join(', ')}`);
        } else {
          console.log(`   ℹ️  No messages found — chat may be empty or cleared`);
        }

        socket.emit('chatMessages', {
          success: true,
          count: messages.length,
          bookingId: bookingId || null,
          rideId: rideId || null,
          messages: messages
        });

        console.log(`   📤 chatMessages emitted to socket: ${socket.id}`);

      } catch (err) {
        console.error(`   ❌ [GET CHAT MESSAGES] Error occurred`);
        console.error(`   ❌ Error Message : ${err.message}`);
        console.error(`   ❌ Stack Trace   :`, err.stack);

        socket.emit('error', {
          message: 'Failed to fetch messages',
          error: err.message
        });
      }
    });

    // ====================== NEW: GET SINGLE MESSAGE BY ID ======================
    socket.on('getMessageById', async (data) => {
      console.log(`\n🔍 [GET MESSAGE BY ID] Event received`);
      console.log(`   messageId     : ${data.messageId}`);
      console.log(`   participantId : ${data.participantId || 'N/A'}`);
      console.log(`   Socket ID     : ${socket.id}`);

      try {
        const { messageId, participantId } = data;

        if (!messageId) {
          console.log(`   ❌ ERROR: messageId is required`);
          return socket.emit('error', { message: 'messageId is required' });
        }

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          console.log(`   ❌ ERROR: Invalid messageId format`);
          return socket.emit('error', { message: 'Invalid message ID format' });
        }

        const message = await ChatMessage.findById(messageId)
          .select('-__v')
          .lean();

        if (!message) {
          console.log(`   ❌ ERROR: Message not found | ID: ${messageId}`);
          return socket.emit('messageNotFound', {
            success: false,
            message: 'Message not found',
            messageId
          });
        }

        if (participantId) {
          if (message.sender.toString() !== participantId &&
            message.receiver.toString() !== participantId) {
            console.log(`   ❌ SECURITY: Unauthorized access attempt by ${participantId}`);
            console.log(`   Message belongs to sender:${message.sender} | receiver:${message.receiver}`);
            return socket.emit('error', {
              message: 'You are not authorized to view this message'
            });
          }
        }

        console.log(`   ✅ Message retrieved successfully | ID: ${message._id}`);

        socket.emit('messageById', {
          success: true,
          message: message
        });

      } catch (err) {
        console.error(`   ❌ Get Message By ID Error:`, err.message);
        socket.emit('error', {
          message: 'Failed to fetch message',
          error: err.message
        });
      }
    });

    // ====================== 5. EDIT MESSAGE ======================
    socket.on('editMessage', async (data) => {
      console.log(`\n✏️ [EDIT MESSAGE] Event received`);
      console.log(`   messageId  : ${data.messageId}`);
      console.log(`   userId     : ${data.userId}`);
      console.log(`   newMessage : "${data.newMessage}"`);
      console.log(`   Socket ID  : ${socket.id}`);

      try {
        const { messageId, newMessage, userId } = data;

        if (!messageId || !newMessage?.trim()) {
          console.log(`   ❌ ERROR: messageId or newMessage missing`);
          socket.emit('error', { message: 'messageId and newMessage required' });
          return;
        }

        const msg = await ChatMessage.findById(messageId);
        if (!msg) {
          console.log(`   ❌ ERROR: Message not found | ID: ${messageId}`);
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        if (msg.sender !== userId) {
          console.log(`   ❌ ERROR: Unauthorized edit attempt by ${userId}`);
          socket.emit('error', { message: 'Only sender can edit message' });
          return;
        }

        const oldMessage = msg.message;
        msg.message = newMessage.trim();
        msg.edited = true;
        msg.originalMessage = msg.originalMessage || oldMessage;
        await msg.save();

        console.log(`   ✅ Message edited | Old: "${oldMessage}" → New: "${msg.message}"`);

        const room = msg.bookingId
          ? `booking_${msg.bookingId}`
          : msg.rideId
            ? `ride_${msg.rideId}`
            : null;

        if (room) {
          io.to(room).emit('messageEdited', {
            _id: msg._id,
            message: msg.message,
            edited: true,
            updatedAt: msg.updatedAt
          });
          console.log(`   📤 messageEdited emitted to room: ${room}`);
        }

        socket.emit('messageEdited', { success: true, messageId });

      } catch (err) {
        console.error(`   ❌ Edit Message Error:`, err.message);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    // ====================== 6. DELETE MESSAGE ======================
    socket.on('deleteMessage', async (data) => {
      console.log(`\n🗑️ [DELETE MESSAGE] Event received`);
      console.log(`   messageId : ${data.messageId}`);
      console.log(`   userId    : ${data.userId}`);
      console.log(`   Socket ID : ${socket.id}`);

      try {
        const { messageId, userId } = data;

        const msg = await ChatMessage.findById(messageId);
        if (!msg) {
          console.log(`   ❌ ERROR: Message not found | ID: ${messageId}`);
          return socket.emit('error', { message: 'Message not found' });
        }

        if (msg.sender !== userId) {
          console.log(`   ❌ ERROR: Unauthorized delete attempt by ${userId}`);
          return socket.emit('error', { message: 'Only sender can delete' });
        }

        await ChatMessage.findByIdAndDelete(messageId);
        console.log(`   ✅ Message deleted | ID: ${messageId}`);

        const room = msg.bookingId
          ? `booking_${msg.bookingId}`
          : msg.rideId
            ? `ride_${msg.rideId}`
            : null;

        if (room) {
          io.to(room).emit('messageDeleted', { messageId, deletedBy: userId });
          console.log(`   📤 messageDeleted emitted to room: ${room}`);
        }

      } catch (err) {
        console.error(`   ❌ Delete Message Error:`, err.message);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // ====================== 7. CLEAR CHAT ======================
    socket.on('clearChat', async (data) => {
      console.log(`\n🧹 [CLEAR CHAT] Event received`);

      const { bookingId, rideId, userId, driverId, isUser, isDriver } = data;

      console.log(`   bookingId : ${bookingId || 'N/A'}`);
      console.log(`   rideId    : ${rideId || 'N/A'}`);
      console.log(`   isUser    : ${isUser}`);
      console.log(`   isDriver  : ${isDriver}`);

      try {
        if (!bookingId && !rideId) {
          return socket.emit('error', { message: 'bookingId or rideId is required' });
        }

        if ((!isUser && !isDriver) || (isUser && isDriver)) {
          return socket.emit('error', { message: 'Provide either isUser:true or isDriver:true' });
        }

        const clearingId = isUser ? userId : driverId;
        const deleteField = isUser ? 'isDeletedByUser' : 'isDeletedByDriver';
        const deleteTimeField = isUser ? 'deletedByUserAt' : 'deletedByDriverAt';

        if (!clearingId) {
          return socket.emit('error', { message: 'userId or driverId is missing' });
        }

        const filter = {
          $or: [
            { sender: clearingId },
            { receiver: clearingId }
          ]
        };

        if (bookingId) filter.bookingId = bookingId;
        if (rideId) filter.rideId = rideId;

        const update = {
          $set: {
            [deleteField]: true,
            [deleteTimeField]: new Date()
          }
        };

        const result = await ChatMessage.updateMany(filter, update);

        console.log(`   ✅ Cleared ${result.modifiedCount} messages for ${isUser ? 'User' : 'Driver'}`);

        socket.emit('chatCleared', {
          success: true,
          modifiedCount: result.modifiedCount,
          bookingId,
          rideId,
          clearedBy: isUser ? 'user' : 'driver'
        });

      } catch (err) {
        console.error(`   ❌ Clear Chat Error:`, err.message);
        socket.emit('error', { message: 'Failed to clear chat' });
      }
    });

    // ====================== 8. MARK AS READ ======================
    socket.on('markAsRead', async (data) => {
      console.log(`\n👁️ [MARK AS READ] Event received`);
      console.log(`   userId    : ${data.userId}`);
      console.log(`   bookingId : ${data.bookingId || 'N/A'}`);
      console.log(`   rideId    : ${data.rideId || 'N/A'}`);
      console.log(`   Socket ID : ${socket.id}`);

      try {
        const { bookingId, rideId, userId } = data;

        let filter = { receiver: userId, isRead: false };
        if (bookingId) filter.bookingId = bookingId;
        if (rideId) filter.rideId = rideId;

        const result = await ChatMessage.updateMany(filter, { isRead: true });
        console.log(`   ✅ Marked ${result.modifiedCount} messages as read`);

        socket.emit('messagesRead', {
          success: true,
          modifiedCount: result.modifiedCount,
          bookingId,
          rideId
        });

      } catch (err) {
        console.error(`   ❌ Mark As Read Error:`, err.message);
      }
    });

    // ====================== TYPING INDICATORS ======================
    socket.on('typing', ({ room, userId }) => {
      console.log(`\n⌨️ [TYPING] userId: ${userId} | room: ${room}`);
      if (room) socket.to(room).emit('typing', { userId });
    });

    socket.on('stopTyping', ({ room }) => {
      console.log(`\n⌨️ [STOP TYPING] room: ${room}`);
      if (room) socket.to(room).emit('stopTyping');
    });

    // ====================== DISCONNECT ======================
    socket.on('disconnect', () => {
      // console.log(`\n❌ [SOCKET DISCONNECTED]`);
      // console.log(`   Socket ID : ${socket.id}`);
      // console.log(`   Time      : ${new Date().toISOString()}`);
    });
  });
};