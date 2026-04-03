// socket.js
const jwt = require('jsonwebtoken');
const geolib = require('geolib');

const Driver = require('../models/driverModel');
const ChatMessage = require('../models/chatMessageModel');
const Ride = require('../models/rideModel');

const activeDrivers = new Map();

module.exports = (io) => {
    global.io = io;
    io.activeDrivers = activeDrivers;

    io.on('connection', (socket) => {
        console.log('🔌 Client connected:', socket.id);

        // ====================== AUTH ======================
        socket.on('join', (data) => {
            try {
                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
                socket.join(decoded._id);
                socket.userId = decoded._id;
            } catch (err) {}
        });

        // ====================== DRIVER ======================
        socket.on('registerDriver', async (data) => { /* your existing code */ });
        socket.on('setStatus', async (data) => { /* your existing code */ });
        socket.on('updateLocation', async (data) => { /* your existing code */ });

        // ====================== PRE-BOOKING TRACKING ======================
        socket.on('trackNearbyDriversBeforeBooking', async (data) => {
            try {
                const { lat, lng, type, token } = data;
                if (!lat || !lng || !type) return socket.emit('error', { message: 'lat, lng, type required' });

                const typeFor = type.toLowerCase() === 'bike' ? 'Bike' : 'Taxi';
                const radius = Number(process.env.RADIUS_IN_METERS) || 5000;

                socket.userTracking = { lat: Number(lat), lng: Number(lng), typeFor, radius };

                const sendNearby = () => {
                    const nearby = [];
                    activeDrivers.forEach((d) => {
                        if (d.status !== 'online') return;
                        if ((d.useFor || d.typeFor || '').toLowerCase() !== type.toLowerCase()) return;

                        const dist = geolib.getDistance(
                            { latitude: lat, longitude: lng },
                            { latitude: d.lat, longitude: d.lng }
                        );

                        if (dist <= radius) {
                            nearby.push({
                                driverId: d.driverInfo?._id,
                                name: d.driverInfo?.name,
                                distanceKm: (dist / 1000).toFixed(1),
                                lat: d.lat,
                                lng: d.lng
                            });
                        }
                    });

                    socket.emit('nearbyDriversUpdate', {
                        drivers: nearby,
                        count: nearby.length,
                        userLocation: { lat, lng }
                    });
                };

                sendNearby();
                socket.nearbyInterval = setInterval(sendNearby, 4000);

            } catch (err) {}
        });

        socket.on('stopTrackingNearbyDrivers', () => {
            if (socket.nearbyInterval) clearInterval(socket.nearbyInterval);
            socket.userTracking = null;
        });

        // ====================== RIDE LIVE TRACKING (Uber/Ola Style) ======================
        socket.on('joinRideRoom', ({ rideId, role }) => {
            if (!rideId) return;
            const room = `ride:${rideId}`;
            socket.join(room);
            console.log(`${role} joined ride room: ${room}`);

            // Passenger ko turant current location bhej do
            if (role === 'passenger') {
                Ride.findById(rideId).select('driver').then(ride => {
                    if (ride?.driver && activeDrivers.has(ride.driver.toString())) {
                        const d = activeDrivers.get(ride.driver.toString());
                        socket.emit('driverLocationUpdate', {
                            rideId,
                            lat: d.lat,
                            lng: d.lng,
                            timestamp: Date.now()
                        });
                    }
                });
            }
        });

        // Driver real-time location during ride
        socket.on('updateRideLocation', ({ rideId, lat, lng, token }) => {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const driverId = decoded._id;

                if (!rideId || isNaN(lat) || isNaN(lng)) return;

                // Update memory
                if (activeDrivers.has(driverId)) {
                    const d = activeDrivers.get(driverId);
                    d.lat = Number(lat);
                    d.lng = Number(lng);
                    d.lastUpdate = Date.now();
                }

                // Broadcast to ride room only
                io.to(`ride:${rideId}`).emit('driverLocationUpdate', {
                    rideId,
                    lat: Number(lat),
                    lng: Number(lng),
                    timestamp: Date.now()
                });

            } catch (err) {}
        });

        socket.on('leaveRideRoom', ({ rideId }) => {
            if (rideId) socket.leave(`ride:${rideId}`);
        });

        // ====================== CLEANUP ======================
        socket.on('disconnect', () => {
            if (socket.nearbyInterval) clearInterval(socket.nearbyInterval);
            if (socket.driverId) activeDrivers.delete(socket.driverId);
            console.log('Client disconnected:', socket.id);
        });
    });

    // Stale cleanup
    setInterval(() => {
        const now = Date.now();
        activeDrivers.forEach((d, id) => {
            if (now - d.lastUpdate > 300000) activeDrivers.delete(id);
        });
    }, 300000);
};