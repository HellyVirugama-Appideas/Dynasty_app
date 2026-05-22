// const jwt = require('jsonwebtoken');
// const Driver = require('../models/driverModel');
// const RideReq = require('../models/rideReqModel');
// const Ride = require('../models/rideModel');
// const User = require('../models/userModel');
// const { sendRideNotification } = require('../utils/sendNotification'); // your FCM helper
// const generateCode = require('../utils/generateCode');

// module.exports = (io) => {
//     const activeDrivers = new Map(); // driverId => { lat, lng, status, useFor/typeFor, socketId, driverInfo }

//     global.io = io; // for access in controllers if needed
//     global.io.activeDrivers = activeDrivers;

//     io.on('connection', (socket) => {
//         console.log('New client connected:', socket.id);

//         // ==================== AUTH & JOIN ====================
//         socket.on('join', async (data) => {
//             try {
//                 const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
//                 socket.userId = decoded._id;
//                 socket.role = data.role || 'user'; // 'user' or 'driver'

//                 socket.join(decoded._id);

//                 if (socket.role === 'driver') {
//                     activeDrivers.set(decoded._id.toString(), {
//                         socketId: socket.id,
//                         status: 'online',
//                         lat: null,
//                         lng: null,
//                         useFor: data.useFor || 'taxi',
//                         typeFor: data.typeFor,
//                         driverInfo: data.driverInfo
//                     });
//                 }
//             } catch (err) {
//                 console.log('Invalid token on join');
//                 socket.disconnect();
//             }
//         });

//         // ==================== DRIVER LOCATION & STATUS ====================
//         socket.on('setLocation', async (data) => {
//             const { lat, lng } = data;
//             if (!socket.userId || !lat || !lng) return;

//             const driverId = socket.userId.toString();

//             if (activeDrivers.has(driverId)) {
//                 const driverData = activeDrivers.get(driverId);
//                 driverData.lat = Number(lat);
//                 driverData.lng = Number(lng);
//             }

//             // Update DB (optional - for persistence)
//             await Driver.findByIdAndUpdate(driverId, {
//                 'location.coordinates': [Number(lng), Number(lat)],
//                 status: 'online'
//             });
//         });

//         socket.on('setStatus', async (data) => {
//             const { status } = data;
//             if (!socket.userId) return;

//             const driverId = socket.userId.toString();
//             await Driver.findByIdAndUpdate(driverId, { status });

//             if (activeDrivers.has(driverId)) {
//                 activeDrivers.get(driverId).status = status;
//             }

//             socket.emit('getStatus', { status });
//         });

//         // ==================== RIDE REQUEST (User Side) ====================
//         socket.on('requestRide', async (rideData) => {
//             try {
//                 const userId = socket.userId;

//                 // Create Ride Request in DB
//                 const rideReq = await RideReq.create({
//                     user: userId,
//                     pickupAddress: rideData.pickupAddress,
//                     pickupLat: rideData.pickupLat,
//                     pickupLng: rideData.pickupLng,
//                     endAddress: rideData.endAddress,
//                     endLat: rideData.endLat,
//                     endLng: rideData.endLng,
//                     type: rideData.type,
//                     price: rideData.price,
//                     isSchedule: rideData.isSchedule || false,
//                     scheduleTime: rideData.scheduleTime
//                 });

//                 await rideReq.populate('user', 'name phone');

//                 const rideObject = rideReq.toObject();
//                 delete rideObject.__v;
//                 delete rideObject.acceptedBy;

//                 // Find nearby drivers from activeDrivers Map (real-time)
//                 const nearbyDrivers = [];
//                 const pickupPoint = { latitude: Number(rideData.pickupLat), longitude: Number(rideData.pickupLng) };
//                 const radius = Number(process.env.RADIUS_IN_METERS) || 5000;

//                 activeDrivers.forEach((driverData, driverId) => {
//                     if (driverData.status !== 'online') return;

//                     const typeMatches = driverData.useFor === rideData.typeFor ||
//                         (driverData.driverInfo && driverData.driverInfo.typeFor === rideData.typeFor);

//                     if (!typeMatches || !driverData.lat || !driverData.lng) return;

//                     const distance = require('geolib').getDistance(pickupPoint, {
//                         latitude: driverData.lat,
//                         longitude: driverData.lng
//                     });

//                     if (distance <= radius) {
//                         nearbyDrivers.push({
//                             driverId,
//                             socketId: driverData.socketId,
//                             distance,
//                             lat: driverData.lat,
//                             lng: driverData.lng
//                         });
//                     }
//                 });

//                 if (nearbyDrivers.length === 0) {
//                     socket.emit('noDriversNearby', { message: 'No drivers available nearby' });
//                     return;
//                 }

//                 // Notify all nearby drivers via Socket
//                 nearbyDrivers.forEach(driver => {
//                     io.to(driver.socketId).emit('newRideRequest', {
//                         rideId: rideReq._id,
//                         user: rideObject.user,
//                         pickup: {
//                             address: rideData.pickupAddress,
//                             lat: rideData.pickupLat,
//                             lng: rideData.pickupLng
//                         },
//                         dropoff: {
//                             address: rideData.endAddress,
//                             lat: rideData.endLat,
//                             lng: rideData.endLng
//                         },
//                         price: rideData.price,
//                         distance: (driver.distance / 1000).toFixed(1) + ' km',
//                         estimatedTime: Math.round((driver.distance / 1000 / 30) * 60) + ' min'
//                     });
//                 });

//                 // Tell user we are waiting
//                 socket.emit('rideRequested', {
//                     rideId: rideReq._id,
//                     message: 'Searching for nearby drivers...'
//                 });

//             } catch (err) {
//                 console.error('requestRide error:', err);
//                 socket.emit('rideError', { message: 'Failed to request ride' });
//             }
//         });

//         // ==================== DRIVER ACCEPTS RIDE ====================
//         socket.on('acceptRide', async (data) => {
//             const { rideId, driverId } = data;
//             if (!driverId || !rideId) return;

//             try {
//                 const rideReq = await RideReq.findById(rideId);
//                 if (!rideReq || rideReq.acceptedBy) {
//                     socket.emit('rideAlreadyAccepted', { message: 'Ride already accepted by another driver' });
//                     return;
//                 }

//                 // Mark as accepted
//                 rideReq.acceptedBy = driverId;
//                 await rideReq.save();

//                 // Create actual Ride document
//                 const newRide = await Ride.create({
//                     ...rideReq.toObject(),
//                     driver: driverId,
//                     otp: generateCode(6),
//                     status: rideReq.isSchedule ? 'Upcoming' : 'Ongoing',
//                     rideStatus: 'start'
//                 });

//                 await newRide.populate([
//                     { path: 'user', select: 'name phone fcmToken' },
//                     {
//                         path: 'driver',
//                         populate: { path: 'type', select: '-__v -distanceRate -typeFor -capacity' },
//                         select: 'name profile phone'
//                     }
//                 ]);

//                 const rideResponse = newRide.toObject();
//                 rideResponse.type = require('../../utils/multilingual')(rideResponse.driver.type, {}); // adjust req if needed
//                 delete rideResponse.driver.type;
//                 delete rideResponse.__v;

//                 // Update driver status
//                 await Driver.findByIdAndUpdate(driverId, { status: 'busy' });

//                 // Notify USER via Socket + FCM
//                 const userSocketRoom = rideReq.user.toString();
//                 io.to(userSocketRoom).emit('rideAccepted', {
//                     ride: rideResponse,
//                     driver: {
//                         id: driverId,
//                         name: rideResponse.driver.name,
//                         phone: rideResponse.driver.phone,
//                         profile: rideResponse.driver.profile,
//                         lat: activeDrivers.get(driverId.toString())?.lat,
//                         lng: activeDrivers.get(driverId.toString())?.lng
//                     },
//                     message: 'Driver has accepted your ride!'
//                 });

//                 // FCM fallback
//                 const user = await User.findById(rideReq.user);
//                 if (user?.fcmToken) {
//                     await sendRideNotification(user.fcmToken, {
//                         title: 'Ride Accepted',
//                         body: `Driver ${rideResponse.driver.name} is on the way.`,
//                         ride: rideResponse
//                     });
//                 }

//                 // Confirm to Driver
//                 socket.emit('rideAcceptedSuccess', { rideId: newRide._id, ride: rideResponse });

//             } catch (err) {
//                 console.error('acceptRide error:', err);
//                 socket.emit('rideError', { message: 'Failed to accept ride' });
//             }
//         });

//         // ==================== LIVE TRACKING (Driver sends location) ====================
//         socket.on('sendLiveTracking', (data) => {
//             const { rideId, latitude, longitude, time } = data;
//             // Emit to the user of this ride (you can store rideId → userId mapping if needed)
//             // For simplicity, assuming you join ride room or use user room
//             io.to(data.userId || 'user-room').emit('receiveLiveTracking', {
//                 rideId,
//                 latitude,
//                 longitude,
//                 time
//             });
//         });

//         // ==================== RIDE STATUS UPDATES ====================
//         socket.on('updateRideStatus', async (data) => {
//             const { rideId, rideStatus } = data;
//             await Ride.findByIdAndUpdate(rideId, { rideStatus });
//             // Broadcast to both user and driver rooms
//             io.to(rideId).emit('rideStatusUpdated', { rideId, rideStatus });
//         });

//         ////////////////////////////////////////////////
//         // ==================== NEARBY VEHICLES (Real-time) ====================
//        socket.on('getNearbyVehicles', (data) => {
//     try {
//         const { type, pickupLat, pickupLng } = data;
//         if (!type || !pickupLat || !pickupLng) {
//             return socket.emit('nearbyVehicles', { success: false, message: 'Missing parameters' });
//         }

//         const requestedType = type.toLowerCase();
//         let nearby = [];

//         console.log(`Searching for ${requestedType} | Pickup: ${pickupLat}, ${pickupLng}`);

//         global.io.activeDrivers.forEach((driverData, driverId) => {
//             if (driverData.status !== 'online' || !driverData.lat || !driverData.lng) return;

//             const driverType = (driverData.useFor || '').toLowerCase();

//             // Very flexible matching
//             const isMatch = 
//                 driverType === requestedType || 
//                 (requestedType === 'taxi' && ['taxi', 'car'].includes(driverType)) ||
//                 (requestedType === 'bike' && driverType === 'bike');

//             if (isMatch) {
//                 const distance = geolib.getDistance(
//                     { latitude: Number(pickupLat), longitude: Number(pickupLng) },
//                     { latitude: driverData.lat, longitude: driverData.lng }
//                 );

//                 if (distance <= 5000) {   // 5km
//                     nearby.push({
//                         driverId,
//                         lat: driverData.lat,
//                         lng: driverData.lng,
//                         distanceKm: (distance/1000).toFixed(1) + " km",
//                         type: driverType
//                     });
//                 }
//             }
//         });

//         console.log(`Found ${nearby.length} nearby ${requestedType} vehicles`);

//         socket.emit('nearbyVehicles', {
//             success: true,
//             type: requestedType,
//             count: nearby.length,
//             vehicles: nearby
//         });

//     } catch (err) {
//         console.error(err);
//         socket.emit('nearbyVehicles', { success: false, message: 'Server error' });
//     }
// });

//         // Disconnect
//         socket.on('disconnect', () => {
//             if (socket.userId && socket.role === 'driver') {
//                 activeDrivers.delete(socket.userId.toString());
//             }
//             console.log('Client disconnected:', socket.id);
//         });
//     });
// };


const jwt = require('jsonwebtoken');
const geolib = require('geolib');
const Driver = require('../models/driverModel');
const RideReq = require('../models/rideReqModel');
const Ride = require('../models/rideModel');
const User = require('../models/userModel');
const { sendRideNotification } = require('../utils/sendNotification');
const generateCode = require('../utils/generateCode');

module.exports = (io) => {
    const activeDrivers = new Map();

    global.io = io;
    global.io.activeDrivers = activeDrivers;

    io.on('connection', (socket) => {
        // console.log('New client connected:', socket.id);

        // ==================== JOIN ====================
        // ==================== JOIN EVENT (Updated - lat/lng support) ====================
        // socket.on('join', (data) => {
        //     try {
        //         console.log('🔑 [JOIN] Received:', data);

        //         if (!data?.token) {
        //             return socket.emit('joinError', { message: 'Token is required' });
        //         }

        //         const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

        //         socket.userId = decoded._id;
        //         socket.role = (data.role || 'user').toLowerCase();

        //         socket.join(decoded._id.toString());

        //         console.log(`✅ [JOIN SUCCESS] ID: ${decoded._id} | Role: ${socket.role}`);

        //         if (socket.role === 'driver') {
        //             const useFor = (data.useFor || 'taxi').toLowerCase();

        //             const driverEntry = {
        //                 socketId: socket.id,
        //                 status: 'online',
        //                 lat: data.lat ? Number(data.lat) : null,
        //                 lng: data.lng ? Number(data.lng) : null,
        //                 useFor: useFor,
        //                 typeFor: useFor === 'bike' ? 'Bike' : 'Taxi'
        //             };

        //             activeDrivers.set(decoded._id.toString(), driverEntry);

        //             socket.emit('joinSuccess', { message: 'Joined successfully' });

        //             console.log(`🚗 [DRIVER ADDED] ID: ${decoded._id} | useFor: ${useFor} | Lat: ${driverEntry.lat} | Lng: ${driverEntry.lng} | Total: ${activeDrivers.size}`);
        //         }


        //     } catch (err) {
        //         console.error('❌ [JOIN ERROR]:', err.message);
        //         socket.emit('joinError', { message: 'Invalid or expired token' });
        //     }
        // });

        // socket.on('join', async (data) => {   // ← add async here
        //     try {
        //         console.log('🔑 [JOIN] Received:', data);

        //         if (!data?.token) {
        //             return socket.emit('joinError', { message: 'Token is required' });
        //         }

        //         const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

        //         socket.userId = decoded._id;
        //         socket.role = (data.role || 'user').toLowerCase();

        //         socket.join(decoded._id.toString());

        //         if (socket.role === 'driver') {
        //             const useFor = (data.useFor || 'taxi').toLowerCase();

        //             // ✅ Fetch type from DB
        //             const dbDriver = await Driver.findById(decoded._id).select('type');

        //             const driverEntry = {
        //                 socketId: socket.id,
        //                 status: 'online',
        //                 lat: data.lat ? Number(data.lat) : null,
        //                 lng: data.lng ? Number(data.lng) : null,
        //                 useFor: useFor,
        //                 typeFor: useFor === 'bike' ? 'Bike' : 'Taxi',
        //                 type: dbDriver?.type?.toString() || null   // ✅ this was null before
        //             };

        //             activeDrivers.set(decoded._id.toString(), driverEntry);

        //             socket.emit('joinSuccess', { message: 'Joined successfully' });

        //             console.log(`🚗 [DRIVER ADDED] ID: ${decoded._id} | useFor: ${useFor} | type: ${driverEntry.type} | Total: ${activeDrivers.size}`);
        //         }

        //     } catch (err) {
        //         console.error('❌ [JOIN ERROR]:', err.message);
        //         socket.emit('joinError', { message: 'Invalid or expired token' });
        //     }
        // });

        socket.on('join', async (data) => {
            try {
                console.log('🔑 [JOIN] Received:', data);

                if (!data?.token) {
                    return socket.emit('joinError', { message: 'Token is required' });
                }

                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

                socket.userId = decoded._id;
                socket.role = (data.role || 'user').toLowerCase();

                socket.join(decoded._id.toString());

                if (socket.role === 'driver') {

                    // ✅ DB से driver fetch करो — useFor और type दोनों
                    const dbDriver = await Driver.findById(decoded._id).select('type useFor');

                    if (!dbDriver) {
                        return socket.emit('joinError', { message: 'Driver not found in DB' });
                    }

                    // ✅ useFor DB से लो — data पर depend मत करो
                    const useFor = (dbDriver.useFor || data.useFor || 'taxi').toLowerCase().trim();

                    const driverEntry = {
                        socketId: socket.id,
                        status: 'online',
                        lat: data.lat ? Number(data.lat) : null,
                        lng: data.lng ? Number(data.lng) : null,
                        useFor: useFor,                              // ✅ DB से आया
                        typeFor: useFor === 'bike' ? 'Bike' : 'Taxi',
                        type: dbDriver?.type?.toString() || null,   // ✅ DB से आया
                    };

                    activeDrivers.set(decoded._id.toString(), driverEntry);

                    socket.emit('joinSuccess', { message: 'Joined successfully', useFor });

                    console.log(`🚗 [DRIVER ADDED] ID: ${decoded._id} | useFor: ${useFor} | type: ${driverEntry.type} | Total: ${activeDrivers.size}`);
                } else {
                    // User join
                    console.log(`✅ [USER JOINED] ID: ${decoded._id}`);
                    socket.emit('joinSuccess', { message: 'Joined successfully' });
                }

            } catch (err) {
                console.error('❌ [JOIN ERROR]:', err.message);
                socket.emit('joinError', { message: 'Invalid or expired token' });
            }
        });
        socket.on('setStatus', async (data) => {
            const { status } = data;
            if (!socket.userId) return;

            const driverId = socket.userId.toString();
            await Driver.findByIdAndUpdate(driverId, { status });

            if (activeDrivers.has(driverId)) {
                activeDrivers.get(driverId).status = status;
            }

            socket.emit('getStatus', { status });
        });

        // ==================== RIDE REQUEST (User Side) ====================
        socket.on('requestRide', async (rideData) => {
            try {
                const userId = socket.userId;

                // Create Ride Request in DB
                const rideReq = await RideReq.create({
                    user: userId,
                    pickupAddress: rideData.pickupAddress,
                    pickupLat: rideData.pickupLat,
                    pickupLng: rideData.pickupLng,
                    endAddress: rideData.endAddress,
                    endLat: rideData.endLat,
                    endLng: rideData.endLng,
                    type: rideData.type,
                    price: rideData.price,
                    isSchedule: rideData.isSchedule || false,
                    scheduleTime: rideData.scheduleTime
                });

                await rideReq.populate('user', 'name phone');

                const rideObject = rideReq.toObject();
                delete rideObject.__v;
                delete rideObject.acceptedBy;

                // Find nearby drivers from activeDrivers Map (real-time)
                const nearbyDrivers = [];
                const pickupPoint = { latitude: Number(rideData.pickupLat), longitude: Number(rideData.pickupLng) };
                const radius = Number(process.env.RADIUS_IN_METERS) || 5000;

                activeDrivers.forEach((driverData, driverId) => {
                    if (driverData.status !== 'online') return;

                    const typeMatches = driverData.useFor === rideData.typeFor ||
                        (driverData.driverInfo && driverData.driverInfo.typeFor === rideData.typeFor);

                    if (!typeMatches || !driverData.lat || !driverData.lng) return;

                    const distance = require('geolib').getDistance(pickupPoint, {
                        latitude: driverData.lat,
                        longitude: driverData.lng
                    });

                    if (distance <= radius) {
                        nearbyDrivers.push({
                            driverId,
                            socketId: driverData.socketId,
                            distance,
                            lat: driverData.lat,
                            lng: driverData.lng
                        });
                    }
                });

                if (nearbyDrivers.length === 0) {
                    socket.emit('noDriversNearby', { message: 'No drivers available nearby' });
                    return;
                }

                // Notify all nearby drivers via Socket
                nearbyDrivers.forEach(driver => {
                    io.to(driver.socketId).emit('newRideRequest', {
                        rideId: rideReq._id,
                        user: rideObject.user,
                        pickup: {
                            address: rideData.pickupAddress,
                            lat: rideData.pickupLat,
                            lng: rideData.pickupLng
                        },
                        dropoff: {
                            address: rideData.endAddress,
                            lat: rideData.endLat,
                            lng: rideData.endLng
                        },
                        price: rideData.price,
                        distance: (driver.distance / 1000).toFixed(1) + ' km',
                        estimatedTime: Math.round((driver.distance / 1000 / 30) * 60) + ' min'
                    });
                });

                // Tell user we are waiting
                socket.emit('rideRequested', {
                    rideId: rideReq._id,
                    message: 'Searching for nearby drivers...'
                });

            } catch (err) {
                console.error('requestRide error:', err);
                socket.emit('rideError', { message: 'Failed to request ride' });
            }
        });

        // ==================== DRIVER ACCEPTS RIDE ====================
        socket.on('acceptRide', async (data) => {
            const { rideId, driverId } = data;
            if (!driverId || !rideId) return;

            try {
                const rideReq = await RideReq.findById(rideId);
                if (!rideReq || rideReq.acceptedBy) {
                    socket.emit('rideAlreadyAccepted', { message: 'Ride already accepted by another driver' });
                    return;
                }

                // Mark as accepted
                rideReq.acceptedBy = driverId;
                await rideReq.save();

                // Create actual Ride document
                const newRide = await Ride.create({
                    ...rideReq.toObject(),
                    driver: driverId,
                    otp: generateCode(6),
                    status: rideReq.isSchedule ? 'Upcoming' : 'Ongoing',
                    rideStatus: 'start'
                });

                await newRide.populate([
                    { path: 'user', select: 'name phone fcmToken' },
                    {
                        path: 'driver',
                        populate: { path: 'type', select: '-__v -distanceRate -typeFor -capacity' },
                        select: 'name profile phone'
                    }
                ]);

                const rideResponse = newRide.toObject();
                rideResponse.type = require('../../utils/multilingual')(rideResponse.driver.type, {}); // adjust req if needed
                delete rideResponse.driver.type;
                delete rideResponse.__v;

                // Update driver status
                await Driver.findByIdAndUpdate(driverId, { status: 'busy' });

                // Notify USER via Socket + FCM
                const userSocketRoom = rideReq.user.toString();
                io.to(userSocketRoom).emit('rideAccepted', {
                    ride: rideResponse,
                    driver: {
                        id: driverId,
                        name: rideResponse.driver.name,
                        phone: rideResponse.driver.phone,
                        profile: rideResponse.driver.profile,
                        lat: activeDrivers.get(driverId.toString())?.lat,
                        lng: activeDrivers.get(driverId.toString())?.lng
                    },
                    message: 'Driver has accepted your ride!'
                });

                // FCM fallback
                const user = await User.findById(rideReq.user);
                if (user?.fcmToken) {
                    await sendRideNotification(user.fcmToken, {
                        title: 'Ride Accepted',
                        body: `Driver ${rideResponse.driver.name} is on the way.`,
                        ride: rideResponse
                    });
                }

                // Confirm to Driver
                socket.emit('rideAcceptedSuccess', { rideId: newRide._id, ride: rideResponse });

            } catch (err) {
                console.error('acceptRide error:', err);
                socket.emit('rideError', { message: 'Failed to accept ride' });
            }
        });

        // ==================== SET LOCATION ====================
        socket.on('setLocation', async (data) => {
            try {
                const { lat, lng } = data;
                if (!socket.userId || !lat || !lng) return;

                const driverId = socket.userId.toString();

                if (activeDrivers.has(driverId)) {
                    const d = activeDrivers.get(driverId);
                    d.lat = Number(lat);
                    d.lng = Number(lng);
                    d.status = 'online';

                    console.log(`📍 [LOCATION UPDATED] Driver ${driverId} → ${lat}, ${lng}`);
                }

                await Driver.findByIdAndUpdate(driverId, {
                    'location.coordinates': [Number(lng), Number(lat)],
                    status: 'online'
                });
            } catch (err) {
                console.error('setLocation error:', err);
            }
        });
        // ==================== LIVE TRACKING (Driver sends location) ====================
        // socket.on('sendLiveTracking', async (data) => {
        //     try {
        //         const { rideId, latitude, longitude, bearing, speed } = data;

        //         // ==================== VALIDATION ====================
        //         if (!rideId) {
        //             console.log('❌ sendLiveTracking: rideId missing');
        //             return socket.emit('trackingError', { message: 'rideId is required' });
        //         }

        //         if (latitude == null || longitude == null) {
        //             console.log('❌ sendLiveTracking: latitude or longitude missing');
        //             return socket.emit('trackingError', { message: 'latitude and longitude are required' });
        //         }

        //         console.log(`📍 [LIVE TRACKING RECEIVED] Ride: ${rideId} | Lat: ${latitude}, Lng: ${longitude}`);

        //         // ==================== FIND RIDE & USER ====================
        //         const ride = await Ride.findById(rideId).select('user status driver');

        //         if (!ride) {
        //             console.log(`❌ sendLiveTracking: Ride not found - ${rideId}`);
        //             return socket.emit('trackingError', { message: 'Ride not found' });
        //         }

        //         if (!['Ongoing', 'start', 'accepted'].includes(ride.status)) {
        //             console.log(`⚠️  sendLiveTracking: Ride is not active. Current status: ${ride.status}`);
        //             return socket.emit('trackingError', { message: 'Ride is not active anymore' });
        //         }

        //         const userId = ride.user.toString();

        //         console.log(`✅ [LIVE TRACKING] Sending to User: ${userId} | Ride: ${rideId}`);

        //         // ==================== SEND TO USER ====================
        //         io.to(userId).emit('receiveLiveTracking', {
        //             rideId: rideId.toString(),
        //             latitude: Number(latitude),
        //             longitude: Number(longitude),
        //             bearing: bearing ? Number(bearing) : null,
        //             speed: speed ? Number(speed) : null,
        //             timestamp: new Date().toISOString()
        //         });

        //         // Optional: Driver ko bhi confirmation bhej sakte ho
        //         socket.emit('trackingSent', {
        //             success: true,
        //             rideId,
        //             message: 'Location sent to user successfully'
        //         });

        //         console.log(`🚀 Live location successfully sent to user ${userId}`);

        //     } catch (err) {
        //         console.error('❌ sendLiveTracking Error:', err);
        //         socket.emit('trackingError', {
        //             message: 'Failed to send live tracking',
        //             error: err.message
        //         });
        //     }
        // });


        // ==================== LIVE TRACKING (DRIVER → USER) ====================
        // FIXED + SUPER CLEAR LOGS (Send aur Receive dono alag-alag dikhega)
        socket.on('sendLiveTracking', async (data) => {
            try {
                const { rideId, latitude, longitude, bearing, speed } = data;

                // ====================== 1. SEND LIVE TRACKING RECEIVED FROM DRIVER ======================
                console.log('🔴 [SEND LIVE TRACKING] === RECEIVED FROM DRIVER ===');
                console.log(`   Ride ID     : ${rideId}`);
                console.log(`   Latitude    : ${latitude}`);
                console.log(`   Longitude   : ${longitude}`);
                console.log(`   Bearing     : ${bearing || 'N/A'}`);
                console.log(`   Speed       : ${speed || 'N/A'}`);
                console.log('   Timestamp   :', new Date().toISOString());

                // Validation
                if (!rideId) {
                    console.log('❌ [SEND LIVE TRACKING] ERROR: rideId missing');
                    return socket.emit('trackingError', { message: 'rideId is required' });
                }
                if (latitude == null || longitude == null) {
                    console.log('❌ [SEND LIVE TRACKING] ERROR: latitude or longitude missing');
                    return socket.emit('trackingError', { message: 'latitude and longitude are required' });
                }

                // Find ride & user
                const ride = await Ride.findById(rideId).select('user status driver');

                if (!ride) {
                    console.log(`❌ [SEND LIVE TRACKING] ERROR: Ride not found - ${rideId}`);
                    return socket.emit('trackingError', { message: 'Ride not found' });
                }

                if (!['Ongoing', 'start', 'accepted'].includes(ride.status)) {
                    console.log(`⚠️  [SEND LIVE TRACKING] WARNING: Ride is not active. Status: ${ride.status}`);
                    return socket.emit('trackingError', { message: 'Ride is not active anymore' });
                }

                const userId = ride.user.toString();

                console.log(`✅ [SEND LIVE TRACKING] SUCCESS - Ride validated | User ID: ${userId}`);

                // ====================== 2. RECEIVE LIVE TRACKING (Emitting to User) ======================
                const trackingPayload = {
                    rideId: rideId.toString(),
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                    bearing: bearing ? Number(bearing) : null,
                    speed: speed ? Number(speed) : null,
                    timestamp: new Date().toISOString()
                };

                console.log('📤 [RECEIVE LIVE TRACKING] === EMITTING TO USER ===');
                console.log(`   To User ID  : ${userId}`);
                console.log(`   Payload     :`, JSON.stringify(trackingPayload, null, 2));

                // Actual emit (jo user side pe 'receiveLiveTracking' event trigger karega)
                io.to(userId).emit('receiveLiveTracking', trackingPayload);

                console.log(`✅ [RECEIVE LIVE TRACKING] SUCCESSFULLY SENT TO USER ${userId} for Ride ${rideId}`);

                // Driver ko confirmation
                socket.emit('trackingSent', {
                    success: true,
                    rideId,
                    message: 'Location sent to user successfully'
                });

            } catch (err) {
                console.error('❌ [SEND LIVE TRACKING] CRITICAL ERROR:', err);
                socket.emit('trackingError', {
                    message: 'Failed to send live tracking',
                    error: err.message
                });
            }
        });

        // ==================== PICKUP USER ====================
        // socket.on('pickupUser', async (data) => {
        //     try {
        //         const { rideId } = data;

        //         console.log('🚖 [PICKUP USER] Event Received');
        //         console.log('   Ride ID:', rideId);

        //         if (!rideId) {
        //             console.log('❌ [PICKUP USER] Error: rideId missing');
        //             return socket.emit('rideError', { message: 'rideId is required' });
        //         }

        //         // Fetch ride with full driver details
        //         const ride = await Ride.findById(rideId)
        //             .populate('driver', 'name profile rating carType vehicleNumber')
        //             .select('user driver rideStatus status otp');

        //         if (!ride) {
        //             console.log('❌ [PICKUP USER] Error: Ride not found');
        //             return socket.emit('rideError', { message: 'Ride not found' });
        //         }

        //         console.log('✅ [PICKUP USER] Ride Found');
        //         console.log('   Current rideStatus:', ride.rideStatus);
        //         console.log('   Driver ID      :', ride.driver?._id);
        //         console.log('   Driver Name    :', ride.driver?.name);
        //         console.log('   Driver Rating  :', ride.driver?.rating);
        //         console.log('   OTP            :', ride.otp);

        //         // Update ride status
        //         ride.rideStatus = 'tripStarted';
        //         ride.status = 'Ongoing';
        //         await ride.save();

        //         console.log('✅ [PICKUP USER] Status Updated to tripStarted');

        //         // ==================== RESPONSE WITH DRIVER INFO ====================
        //         const responsePayload = {
        //             rideStatus: "wayToPickup",        // Aapne jo maanga tha
        //             driver: {
        //                 _id: ride.driver?._id?.toString() || "",
        //                 name: ride.driver?.name || "",
        //                 profile: ride.driver?.profile || "",     // image
        //                 rating: ride.driver?.rating || 0,
        //                 carType: ride.driver?.carType || "",
        //                 vehicleNumber: ride.driver?.vehicleNumber || "",
        //                 otp: ride.otp || ""
        //             }
        //         };

        //         // Detailed Log - Jo actual response user ko ja raha hai
        //         console.log('📤 [PICKUP USER] Sending rideStatusNotify to USER:');
        //         console.log(JSON.stringify(responsePayload, null, 2));

        //         // Emit to User
        //         io.to(ride.user.toString()).emit('rideStatusNotify', responsePayload);

        //         // Emit to Driver (confirmation)
        //         console.log('📤 [PICKUP USER] Sending confirmation to DRIVER');
        //         socket.emit('rideStatusNotify', {
        //             rideStatus: "tripStarted",
        //             message: "You have picked up the user successfully",
        //             rideId: rideId.toString(),
        //             otp: ride.otp || ""
        //         });

        //         console.log(`🎉 [PICKUP USER] Process Completed Successfully for Ride: ${rideId}`);

        //     } catch (err) {
        //         console.error('❌ [PICKUP USER] Critical Error:', err.message);
        //         console.error(err.stack);

        //         socket.emit('rideError', {
        //             message: 'Failed to process pickup user',
        //             error: err.message
        //         });
        //     }
        // });

        // ==================== PICKUP USER ====================
        socket.on('pickupUser', async (data) => {
            try {
                const { rideId } = data;

                console.log('🚖 [PICKUP USER] Event Received');
                console.log('   Ride ID:', rideId);

                if (!rideId) {
                    console.log('❌ [PICKUP USER] Error: rideId missing');
                    return socket.emit('rideError', { message: 'rideId is required' });
                }

                // Fetch ride with driver details
                const ride = await Ride.findById(rideId)
                    .populate('driver', 'name profile rating carType vehicleNumber')
                    .select('user driver rideStatus status otp');

                if (!ride) {
                    console.log('❌ [PICKUP USER] Error: Ride not found');
                    return socket.emit('rideError', { message: 'Ride not found' });
                }

                if (!ride.driver) {
                    console.log('❌ [PICKUP USER] Error: Driver not found in ride');
                    return socket.emit('rideError', { message: 'Driver information not found' });
                }

                console.log('✅ [PICKUP USER] Ride Found');

                // Update ride status
                ride.rideStatus = 'tripStarted';
                ride.status = 'Ongoing';
                await ride.save();

                console.log('✅ [PICKUP USER] Status Updated to tripStarted');

                // ==================== RESPONSE FOR USER ====================
                const responsePayload = {
                    rideStatus: "wayToPickup",           // As you wanted
                    driverId: ride.driver._id.toString(),
                    driverName: ride.driver.name || "",
                    imageUrl: ride.driver.profile || "",        // profile photo
                    carType: ride.driver.carType || "",
                    rating: ride.driver.rating || 0,
                    time: new Date().toISOString(),             // Current timestamp
                    otp: ride.otp || "",                        // Optional: if needed
                    rideId: rideId.toString(),
                    message: "Driver has picked you up"
                };

                // Detailed Log
                console.log('📤 [PICKUP USER] Sending rideStatusNotify to USER:');
                console.log(JSON.stringify(responsePayload, null, 2));

                // Emit to User
                io.to(ride.user.toString()).emit('rideStatusNotify', responsePayload);

                // ==================== RESPONSE FOR DRIVER ====================
                console.log('📤 [PICKUP USER] Sending confirmation to DRIVER');
                socket.emit('rideStatusNotify', {
                    rideStatus: "tripStarted",
                    message: "You have picked up the user successfully",
                    rideId: rideId.toString(),
                    otp: ride.otp || ""
                });

                console.log(`🎉 [PICKUP USER] Process Completed Successfully for Ride: ${rideId}`);

            } catch (err) {
                console.error('❌ [PICKUP USER] Critical Error:', err.message);
                console.error(err.stack);

                socket.emit('rideError', {
                    message: 'Failed to process pickup user',
                    error: err.message
                });
            }
        });

        // ==================== RIDE STATUS UPDATES ====================
        socket.on('updateRideStatus', async (data) => {
            const { rideId, rideStatus } = data;
            await Ride.findByIdAndUpdate(rideId, { rideStatus });
            // Broadcast to both user and driver rooms
            io.to(rideId).emit('rideStatusUpdated', { rideId, rideStatus });
        });
        // ==================== GET NEARBY VEHICLES (FINAL WORKING) ====================
        // ==================== GET NEARBY VEHICLES - FINAL WORKING (Uber Style) ====================
        socket.on('getNearbyVehicles', (data) => {
            try {
                const { type, pickupLat, pickupLng } = data;

                if (!type || !pickupLat || !pickupLng) {
                    return socket.emit('nearbyVehicles', {
                        success: false,
                        message: 'type, pickupLat, pickupLng required'
                    });
                }

                const requestedType = type.toLowerCase();
                let nearby = [];

                console.log(`🔍 [NEARBY] Searching for "${requestedType}" | Pickup: ${pickupLat}, ${pickupLng}`);
                console.log(`Total active drivers in map: ${activeDrivers.size}`);

                activeDrivers.forEach((driverData, driverId) => {
                    if (driverData.status !== 'online') return;

                    const driverUseFor = (driverData.useFor || '').toLowerCase();

                    console.log(`Checking Driver ${driverId}: useFor="${driverUseFor}", lat=${driverData.lat}, lng=${driverData.lng}`);

                    // Matching
                    let isMatch = false;
                    if (requestedType === 'taxi') {
                        isMatch = (driverUseFor === 'taxi' || driverUseFor === 'car');
                    } else if (requestedType === 'bike') {
                        isMatch = (driverUseFor === 'bike');
                    }

                    if (isMatch) {
                        // Agar location null bhi hai to bhi dikhaye (temporary)
                        const distance = driverData.lat && driverData.lng
                            ? geolib.getDistance(
                                { latitude: Number(pickupLat), longitude: Number(pickupLng) },
                                { latitude: driverData.lat, longitude: driverData.lng }
                            )
                            : 1000; // dummy distance

                        console.log(`   MATCH FOUND! Distance: ${(distance / 1000).toFixed(1)} km`);

                        if (distance <= 5000) {
                            nearby.push({
                                driverId: driverId.toString(),
                                lat: driverData.lat || null,
                                lng: driverData.lng || null,
                                distanceKm: driverData.lat && driverData.lng ? (distance / 1000).toFixed(1) + " km" : "Location not updated",
                                type: driverUseFor
                            });
                        }
                    }
                });

                console.log(`✅ [NEARBY] Final Result: ${nearby.length} nearby "${requestedType}" vehicles found\n`);

                socket.emit('nearbyVehicles', {
                    success: true,
                    type: requestedType,
                    count: nearby.length,
                    vehicles: nearby
                });

            } catch (err) {
                console.error('getNearbyVehicles error:', err);
                socket.emit('nearbyVehicles', { success: false, message: 'Server error' });
            }
        });

        // Disconnect
        socket.on('disconnect', () => {
            if (socket.userId && socket.role === 'driver') {
                activeDrivers.delete(socket.userId.toString());
                console.log(`Driver removed from map: ${socket.userId}`);
            }
            console.log('Client disconnected:', socket.id);
        });
    });
};