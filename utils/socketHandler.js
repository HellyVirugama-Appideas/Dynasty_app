const jwt = require('jsonwebtoken');

const Driver = require('../models/driverModel');
const ChatMessage = require('../models/chatMessageModel');

module.exports = io => {
    io.on('connection', socket => {
        // Join
        socket.on('join', data => {
            try {
                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
                socket.join(decoded._id);
            } catch (error) {
                console.log('Invalid token.');
            }
        });

        // Set status
        socket.on('setStatus', async data => {
            try {
                const status = data.status;
                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

                await Driver.findByIdAndUpdate(
                    decoded._id,
                    { status },
                    { new: true }
                );

                // Emit status
                socket.emit('getStatus', { status });
            } catch (error) {
                console.log('Error:', error.message);
            }
        });

        // Get status
        socket.on('getStatus', async data => {
            try {
                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

                const driver = await Driver.findById(decoded._id);

                // Emit status
                socket.emit('getStatus', { status: driver.status });
            } catch (error) {
                console.log('Error:', error.message);
            }
        });

        // Set location
        socket.on('setLocation', async data => {
            try {
                const { lat, lng } = data;
                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

                await Driver.findByIdAndUpdate(
                    decoded._id,
                    { 'location.coordinates': [lng, lat] },
                    { new: true }
                );
            } catch (error) {
                console.log('Error:', error.message);
            }
        });

        // Live navigation

        // Listen for get chat messages
        socket.on('getChatMessages', async data => {
            try {
                const bookingId = data.bookingId;

                const messages = await ChatMessage.find({ bookingId });

                // Emit old messages to the client
                socket.emit('chatMessages', messages);
            } catch (error) {
                console.log('Error retrieving old messages:', error.message);
            }
        });

        // Listen for new chat messages
        socket.on('sendMessage', async data => {
            try {
                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

                const chatMessage = await ChatMessage.create({
                    bookingId: data.bookingId,
                    sender: decoded._id,
                    receiver: data.receiver,
                    message: data.message,
                });

                io.to(data.receiver).emit('receiveMessage', chatMessage);
            } catch (error) {
                console.log('Error saving message:', error.message);
            }
        });
    });
};
