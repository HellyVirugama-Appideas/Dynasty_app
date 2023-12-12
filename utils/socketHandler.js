const jwt = require('jsonwebtoken');

const Driver = require('../models/driverModel');
const ChatMessage = require('../models/chatMessageModel');
const Ride = require('../models/rideModel');

module.exports = io => {
    io.on('connection', socket => {
        // Join
        socket.on('join', data => {
            try {
                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
                socket.join(decoded._id);
            } catch (error) {
                console.log('Invalid token in join.', data.token);
            }
        });

        // Set status
        socket.on('setStatus', async data => {
            try {
                const status = data.status;
                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

                await Driver.findByIdAndUpdate(decoded._id, { status });

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

                await Driver.findByIdAndUpdate(decoded._id, {
                    'location.coordinates': [lng, lat],
                });
            } catch (error) {
                console.log('Error:', error.message);
            }
        });

        // Live tracking
        socket.on('sendLiveTracking', data => {
            const { user, latitude, longitude } = data;
            io.to(user).emit('receiveLiveTracking', { latitude, longitude });
        });

        // Listen for get chat messages
        socket.on('getChatMessages', async data => {
            try {
                const query = {
                    bookingId: data.bookingId,
                    rideId: data.rideId,
                };

                const messages = await ChatMessage.find(query);

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
                    rideId: data.rideId,
                    sender: decoded._id,
                    receiver: data.receiver,
                    message: data.message,
                });

                io.to(data.receiver).emit('receiveMessage', chatMessage);
            } catch (error) {
                console.log('Error saving message:', error.message);
            }
        });

        // Set ride status
        socket.on('setRideStatus', async data => {
            try {
                const { rideId, rideStatus } = data;

                const update = { rideStatus };
                if (rideStatus === 'wayToPickup') update.status = 'Ongoing';

                await Ride.findByIdAndUpdate(rideId, update);

                // Emit status
                socket.emit('getRideStatus', { rideStatus });
            } catch (error) {
                console.log('Error:', error.message);
            }
        });
    });
};
