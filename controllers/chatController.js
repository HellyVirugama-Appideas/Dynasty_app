// const ChatMessage = require('../models/chatMessageModel');
// const mongoose = require('mongoose');

// const jwt = require('jsonwebtoken');
// const createError = require('http-errors');
// const User = require('../models/userModel');
// const Driver = require('../models/driverModel');


// // controllers/chatController.js
// exports.sendMessage = async (req, res) => {
//     console.log('┌───────────────────────────────');
//     console.log('│ SEND MESSAGE API CALLED');
//     console.log('└───────────────────────────────');

//     try {
//         // 1. Log incoming request body & headers
//         console.log('Request Body:', JSON.stringify(req.body, null, 2));
//         console.log('Request Headers (token):', req.headers.token || 'NO TOKEN IN HEADERS');

//         // 2. Check authentication (user or driver)
//         const current = req.user || req.driver;
//         console.log('Authenticated person:', current ? 'FOUND' : 'NOT FOUND');

//         if (!current) {
//             console.log('ERROR: No user or driver found in req');
//             return res.status(401).json({
//                 success: false,
//                 message: 'Not authenticated - no user or driver found'
//             });
//         }

//         const sender = current._id ? current._id.toString() : current.id;
//         console.log('Sender ID extracted:', sender);

//         // 3. Destructure body
//         const { bookingId, rideId, receiver, message } = req.body;
//         console.log('bookingId:', bookingId);
//         console.log('rideId:', rideId);
//         console.log('receiver:', receiver);
//         console.log('message:', message);

//         // 4. Validation
//         if (!receiver || !message?.trim()) {
//             console.log('VALIDATION FAILED: receiver or message missing/empty');
//             return res.status(400).json({
//                 success: false,
//                 message: 'receiver and message are required'
//             });
//         }

//         // 5. Create message document
//         console.log('Creating new ChatMessage...');
//         const msg = new ChatMessage({
//             bookingId: bookingId || undefined,
//             rideId: rideId || undefined,
//             sender,
//             receiver,
//             message: message.trim(),
//         });

//         // 6. Save to database
//         console.log('Saving message to DB...');
//         await msg.save();
//         console.log('Message saved successfully. _id:', msg._id.toString());

//         // 7. Socket.IO part
//         const io = req.app.get('io');
//         console.log('Socket.IO instance exists?', !!io);

//         let room = null;
//         if (bookingId) {
//             room = `booking_${bookingId}`;
//         } else if (rideId) {
//             room = `ride_${rideId}`;
//         } else {
//             const participants = [sender, receiver].sort();
//             room = `direct_${participants[0]}_${participants[1]}`;
//         }
//         console.log('Calculated room name:', room);

//         if (room && io) {
//             console.log(`Emitting newMessage to room: ${room}`);
//             io.to(room).emit('newMessage', msg.toObject());
//         } else {
//             console.log('WARNING: No room or io instance → no real-time emit');
//         }

//         // 8. Success response
//         console.log('Sending 201 response');
//         res.status(201).json({ success: true, data: msg });

//     } catch (err) {
//         // ── Detailed error logging ──
//         console.error('┌───────────────────────────────');
//         console.error('│ SEND MESSAGE ERROR');
//         console.error('├───────────────────────────────');
//         console.error('│ Message:', err.message);
//         console.error('│ Stack:', err.stack);
//         console.error('└───────────────────────────────');

//         res.status(500).json({
//             success: false,
//             message: err.message || 'Internal server error while sending message'
//         });
//     }
// };

// // 2. Mark message(s) as read
// // controllers/chatController.js
// exports.markAsRead = async (req, res) => {
//     try {
//         console.log('MARK AS READ API CALLED');
//         console.log('req.body:', JSON.stringify(req.body, null, 2));

//         // ── Get the current authenticated person (user OR driver) ──
//         const current = req.user || req.driver;

//         if (!current) {
//             console.log('Authentication failed: no req.user or req.driver');
//             return res.status(401).json({
//                 success: false,
//                 message: 'Not authenticated (no user or driver found)'
//             });
//         }

//         // Use _id (most common in Mongoose models) or fallback to .id
//         const currentId = current._id
//             ? current._id.toString()
//             : (current.id || null);

//         if (!currentId) {
//             console.log('No valid ID found in authenticated object');
//             return res.status(500).json({
//                 success: false,
//                 message: 'Internal error: authenticated user/driver has no ID'
//             });
//         }

//         console.log('Current authenticated ID (receiver):', currentId);

//         const { messageIds, bookingId, rideId } = req.body;

//         let filter = {
//             receiver: currentId,          // ← fixed here
//             isRead: false,
//         };

//         if (Array.isArray(messageIds) && messageIds.length > 0) {
//             console.log('Filtering by specific message IDs');
//             filter._id = {
//                 $in: messageIds.map(id => {
//                     try {
//                         return new mongoose.Types.ObjectId(id);
//                     } catch (e) {
//                         console.log('Invalid ObjectId skipped:', id);
//                         return null;
//                     }
//                 }).filter(Boolean)
//             };

//             // Remove empty $in if all were invalid
//             if (filter._id.$in.length === 0) {
//                 delete filter._id;
//             }
//         } else if (bookingId) {
//             console.log('Filtering by bookingId:', bookingId);
//             filter.bookingId = bookingId;
//         } else if (rideId) {
//             console.log('Filtering by rideId:', rideId);
//             filter.rideId = rideId;
//         } else {
//             console.log('No filter provided (messageIds/bookingId/rideId missing)');
//             return res.status(400).json({
//                 success: false,
//                 message: 'Provide messageIds (array) or bookingId or rideId'
//             });
//         }

//         console.log('Update filter:', JSON.stringify(filter, null, 2));

//         const result = await ChatMessage.updateMany(filter, { isRead: true });

//         console.log('Messages marked as read. Modified count:', result.modifiedCount);

//         // Notify sender(s) – use currentId as the one who read
//         const io = req.app.get('io');
//         if (io) {
//             console.log('Emitting messagesRead to:', currentId);
//             io.to(currentId).emit('messagesRead', {
//                 by: currentId,
//                 messageIds: messageIds || []
//             });
//         } else {
//             console.log('Warning: Socket.IO not available');
//         }

//         res.json({
//             success: true,
//             modifiedCount: result.modifiedCount,
//         });

//     } catch (err) {
//         console.error('MARK AS READ ERROR:');
//         console.error(err.message);
//         console.error(err.stack);

//         res.status(500).json({
//             success: false,
//             message: err.message || 'Server error while marking messages as read'
//         });
//     }
// };

// // 3. Delete message
// exports.deleteMessage = async (req, res) => {
//     try {
//         const { messageId } = req.params;

//         // ── Get current authenticated person (user OR driver) ──
//         const current = req.user || req.driver;
//         if (!current) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Not authenticated (no user or driver found)'
//             });
//         }

//         const currentId = current._id
//             ? current._id.toString()
//             : (current.id || null);

//         if (!currentId) {
//             return res.status(500).json({
//                 success: false,
//                 message: 'Internal error: no valid ID found'
//             });
//         }

//         const msg = await ChatMessage.findById(messageId);

//         if (!msg) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Message not found'
//             });
//         }

//         // Only sender can delete (you can change this rule later if needed)
//         if (msg.sender !== currentId) {
//             return res.status(403).json({
//                 success: false,
//                 message: 'Not authorized - only sender can delete this message'
//             });
//         }

//         await ChatMessage.findByIdAndDelete(messageId);

//         // Notify in room (both participants)
//         const io = req.app.get('io');
//         let room = null;

//         if (msg.bookingId) {
//             room = `booking_${msg.bookingId}`;
//         } else if (msg.rideId) {
//             room = `ride_${msg.rideId}`;
//         } else {
//             // fallback for direct messages
//             const ids = [msg.sender, msg.receiver].sort();
//             room = `direct_${ids[0]}_${ids[1]}`;
//         }

//         if (room && io) {
//             io.to(room).emit('messageDeleted', {
//                 messageId,
//                 deletedBy: currentId
//             });
//         }

//         res.json({
//             success: true,
//             message: 'Message deleted successfully'
//         });

//     } catch (err) {
//         console.error('deleteMessage error:', err);
//         res.status(500).json({
//             success: false,
//             message: err.message || 'Server error while deleting message'
//         });
//     }
// };

// // 4. Edit message
// // 4. Edit message
// exports.editMessage = async (req, res) => {
//     try {
//         const { messageId } = req.params;
//         const { newMessage } = req.body;

//         if (!newMessage?.trim()) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'New message content is required'
//             });
//         }

//         // ── Get current authenticated person ──
//         const current = req.user || req.driver;
//         if (!current) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Not authenticated (no user or driver found)'
//             });
//         }

//         const currentId = current._id
//             ? current._id.toString()
//             : (current.id || null);

//         if (!currentId) {
//             return res.status(500).json({
//                 success: false,
//                 message: 'Internal error: no valid ID found'
//             });
//         }

//         const msg = await ChatMessage.findById(messageId);

//         if (!msg) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Message not found'
//             });
//         }

//         if (msg.sender !== currentId) {
//             return res.status(403).json({
//                 success: false,
//                 message: 'Not authorized - only sender can edit this message'
//             });
//         }

//         // Optional: edit time limit (15 minutes example)
//         const timeDiffMinutes = (Date.now() - new Date(msg.createdAt).getTime()) / 60000;
//         if (timeDiffMinutes > 15) {
//             return res.status(403).json({
//                 success: false,
//                 message: 'Edit time expired (15 minutes limit)'
//             });
//         }

//         // Keep original for history (optional feature)
//         msg.originalMessage = msg.originalMessage || msg.message;
//         msg.message = newMessage.trim();
//         msg.edited = true;
//         msg.updatedAt = new Date();

//         await msg.save();

//         // Notify in room
//         const io = req.app.get('io');
//         let room = null;

//         if (msg.bookingId) {
//             room = `booking_${msg.bookingId}`;
//         } else if (msg.rideId) {
//             room = `ride_${msg.rideId}`;
//         } else {
//             const ids = [msg.sender, msg.receiver].sort();
//             room = `direct_${ids[0]}_${ids[1]}`;
//         }

//         if (room && io) {
//             io.to(room).emit('messageEdited', msg.toObject());
//         }

//         res.json({
//             success: true,
//             data: msg
//         });

//     } catch (err) {
//         console.error('editMessage error:', err);
//         res.status(500).json({
//             success: false,
//             message: err.message || 'Server error while editing message'
//         });
//     }
// };

// exports.getChatHistory = async (req, res) => {
//     try {
//         // ── Fix: Get ID from whoever is authenticated ──
//         const current = req.user || req.driver;

//         if (!current) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Not authenticated (no user or driver found)'
//             });
//         }

//         // Use _id (most common in Mongoose) or .id if your model uses it
//         const currentUserId = current._id ? current._id.toString() : current.id;

//         console.log('Current authenticated ID:', currentUserId); // ← helpful log

//         const { bookingId, rideId, otherUserId } = req.query;

//         if (!otherUserId) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'otherUserId query parameter is required'
//             });
//         }

//         const filter = {
//             $or: [
//                 { sender: currentUserId, receiver: otherUserId },
//                 { sender: otherUserId, receiver: currentUserId },
//             ],
//         };

//         if (bookingId && mongoose.isValidObjectId(bookingId)) {
//             filter.bookingId = bookingId;
//         }
//         if (rideId && mongoose.isValidObjectId(rideId)) {
//             filter.rideId = rideId;
//         }

//         const messages = await ChatMessage.find(filter)
//             .sort({ createdAt: 1 })
//             .limit(100)
//             .lean();

//         res.status(200).json({
//             success: true,
//             count: messages.length,
//             data: messages,
//         });
//     } catch (err) {
//         console.error('getChatHistory error:', err);
//         res.status(500).json({ success: false, message: 'Server error' });
//     }
// };

// // ====================== CLEAR CHAT (Soft Delete) ======================
// exports.clearChat = async (req, res) => {
//     try {
//         console.log('🧹 CLEAR CHAT API CALLED');

//         const current = req.user || req.driver;
//         if (!current) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Not authenticated'
//             });
//         }

//         const currentId = current._id ? current._id.toString() : current.id;
//         const { bookingId, rideId } = req.body;

//         console.log('Clear chat by:', currentId, '| bookingId:', bookingId, '| rideId:', rideId);

//         if (!bookingId && !rideId) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'bookingId or rideId is required'
//             });
//         }

//         // Determine if current user is User or Driver
//         const isUser = !!req.user;        // true if user authenticated
//         const isDriver = !!req.driver;    // true if driver authenticated

//         let filter = {};

//         if (bookingId) {
//             filter.bookingId = bookingId;
//         } else if (rideId) {
//             filter.rideId = rideId;
//         }

//         // Update logic
//         const update = {
//             $set: {}
//         };

//         if (isUser) {
//             update.$set.isDeletedByUser = true;
//             update.$set.deletedByUserAt = new Date();
//             console.log(`User ${currentId} is clearing chat for booking: ${bookingId}`);
//         } 
//         else if (isDriver) {
//             update.$set.isDeletedByDriver = true;
//             update.$set.deletedByDriverAt = new Date();
//             console.log(`Driver ${currentId} is clearing chat for booking: ${bookingId}`);
//         }

//         const result = await ChatMessage.updateMany(filter, update);

//         console.log(`✅ Clear chat successful. Modified ${result.modifiedCount} messages`);

//         // Socket notification to the person who cleared
//         const io = req.app.get('io');
//         if (io) {
//             const room = currentId;   // personal room
//             io.to(room).emit('chatCleared', {
//                 by: currentId,
//                 isUser: isUser,
//                 isDriver: isDriver,
//                 bookingId,
//                 rideId,
//                 clearedAt: new Date()
//             });
//         }

//         return res.json({
//             success: true,
//             message: 'Chat cleared successfully from your side (soft delete)',
//             modifiedCount: result.modifiedCount,
//             clearedBy: isUser ? 'user' : 'driver'
//         });

//     } catch (err) {
//         console.error('Clear Chat Error:', err);
//         return res.status(500).json({
//             success: false,
//             message: 'Failed to clear chat'
//         });
//     }
// };


// controllers/chatController.js
const ChatMessage = require('../models/chatMessageModel');
const mongoose = require('mongoose');

const getRoom = (bookingId, rideId) => {
    if (bookingId) return `booking_${bookingId}`;
    if (rideId) return `ride_${rideId}`;
    return null;
};

// ====================== SEND MESSAGE ======================
exports.sendMessage = async (req, res) => {
    try {
        const current = req.user || req.driver;
        if (!current) return res.status(401).json({ success: false, message: 'Not authenticated' });

        const sender = current._id ? current._id.toString() : current.id;
        const { bookingId, rideId, receiver, message } = req.body;

        if (!receiver || !message?.trim()) {
            return res.status(400).json({ success: false, message: 'receiver and message are required' });
        }

        const msg = new ChatMessage({
            bookingId: bookingId || undefined,
            rideId: rideId || undefined,
            sender,
            receiver,
            message: message.trim(),
            isRead: false,
        });

        await msg.save();

        const room = getRoom(bookingId, rideId);
        const io = req.app.get('io');

        if (room && io) {
            io.to(room).emit('newMessage', {
                ...msg.toObject(),
                isNew: true
            });
            console.log(`📨 newMessage emitted to room: ${room}`);
        }

        res.status(201).json({ success: true, data: msg });

    } catch (err) {
        console.error('Send Message Error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ====================== GET CHAT HISTORY (with soft delete filter) ======================
exports.getChatHistory = async (req, res) => {
    try {
        const current = req.user || req.driver;
        if (!current) return res.status(401).json({ success: false, message: 'Not authenticated' });

        const currentId = current._id ? current._id.toString() : current.id;
        const { bookingId, rideId, otherUserId } = req.query;

        if (!otherUserId) {
            return res.status(400).json({ success: false, message: 'otherUserId is required' });
        }

        let filter = {
            $or: [
                { sender: currentId, receiver: otherUserId },
                { sender: otherUserId, receiver: currentId }
            ]
        };

        // Soft delete filter - sirf woh messages jo is user/driver ne clear nahi kiye
        if (req.user) {
            filter.isDeletedByUser = false;
        } else if (req.driver) {
            filter.isDeletedByDriver = false;
        }

        if (bookingId) filter.bookingId = bookingId;
        if (rideId) filter.rideId = rideId;

        const messages = await ChatMessage.find(filter)
            .sort({ createdAt: 1 })
            .limit(100)
            .lean();

        res.status(200).json({
            success: true,
            count: messages.length,
            data: messages
        });

    } catch (err) {
        console.error('getChatHistory error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ====================== CLEAR CHAT ======================
exports.clearChat = async (req, res) => {
    try {
        const current = req.user || req.driver;
        if (!current) return res.status(401).json({ success: false, message: 'Not authenticated' });

        const currentId = current._id ? current._id.toString() : current.id;
        const { bookingId, rideId } = req.body;

        if (!bookingId && !rideId) {
            return res.status(400).json({ success: false, message: 'bookingId or rideId is required' });
        }

        const isUser = !!req.user;
        const isDriver = !!req.driver;

        let filter = bookingId ? { bookingId } : { rideId };

        const update = { $set: {} };
        if (isUser) {
            update.$set.isDeletedByUser = true;
            update.$set.deletedByUserAt = new Date();
        } else if (isDriver) {
            update.$set.isDeletedByDriver = true;
            update.$set.deletedByDriverAt = new Date();
        }

        const result = await ChatMessage.updateMany(filter, update);

        const io = req.app.get('io');
        const room = currentId; // personal room

        if (io) {
            io.to(room).emit('chatCleared', {
                by: currentId,
                isUser,
                isDriver,
                bookingId,
                rideId,
                clearedAt: new Date()
            });
        }

        res.json({
            success: true,
            message: 'Chat cleared from your side',
            modifiedCount: result.modifiedCount
        });

    } catch (err) {
        console.error('Clear Chat Error:', err);
        res.status(500).json({ success: false, message: 'Failed to clear chat' });
    }
};

// ====================== EDIT MESSAGE ======================
exports.editMessage = async (req, res) => {
    try {
        const current = req.user || req.driver;
        if (!current) return res.status(401).json({ success: false, message: 'Not authenticated' });

        const currentId = current._id ? current._id.toString() : current.id;
        const { messageId } = req.params;
        const { newMessage } = req.body;

        if (!newMessage?.trim()) return res.status(400).json({ success: false, message: 'New message required' });

        const msg = await ChatMessage.findById(messageId);
        if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

        if (msg.sender !== currentId) return res.status(403).json({ success: false, message: 'Only sender can edit' });

        msg.message = newMessage.trim();
        msg.edited = true;
        msg.originalMessage = msg.originalMessage || msg.message;
        await msg.save();

        const room = getRoom(msg.bookingId, msg.rideId);
        const io = req.app.get('io');

        if (room && io) {
            io.to(room).emit('messageEdited', msg.toObject());
        }

        res.json({ success: true, data: msg });

    } catch (err) {
        console.error('editMessage error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ====================== DELETE MESSAGE (Hard delete for now) ======================
exports.deleteMessage = async (req, res) => {
    try {
        const current = req.user || req.driver;
        if (!current) return res.status(401).json({ success: false, message: 'Not authenticated' });

        const currentId = current._id ? current._id.toString() : current.id;
        const { messageId } = req.params;

        const msg = await ChatMessage.findById(messageId);
        if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

        if (msg.sender !== currentId) return res.status(403).json({ success: false, message: 'Only sender can delete' });

        await ChatMessage.findByIdAndDelete(messageId);

        const room = getRoom(msg.bookingId, msg.rideId);
        const io = req.app.get('io');

        if (room && io) {
            io.to(room).emit('messageDeleted', { messageId, deletedBy: currentId });
        }

        res.json({ success: true, message: 'Message deleted' });

    } catch (err) {
        console.error('deleteMessage error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ====================== MARK AS READ ======================
exports.markAsRead = async (req, res) => {
    try {
        const current = req.user || req.driver;
        if (!current) return res.status(401).json({ success: false, message: 'Not authenticated' });

        const currentId = current._id ? current._id.toString() : current.id;
        const { messageIds, bookingId, rideId } = req.body;

        let filter = { receiver: currentId, isRead: false };

        if (Array.isArray(messageIds) && messageIds.length > 0) {
            filter._id = { $in: messageIds.map(id => new mongoose.Types.ObjectId(id)) };
        } else if (bookingId) {
            filter.bookingId = bookingId;
        } else if (rideId) {
            filter.rideId = rideId;
        }

        const result = await ChatMessage.updateMany(filter, { isRead: true });

        const io = req.app.get('io');
        if (io) {
            io.to(currentId).emit('messagesRead', { 
                by: currentId, 
                messageIds: messageIds || [], 
                bookingId, 
                rideId 
            });
        }

        res.json({ success: true, modifiedCount: result.modifiedCount });

    } catch (err) {
        console.error('markAsRead error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};