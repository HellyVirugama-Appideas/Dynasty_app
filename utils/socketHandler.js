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
        console.log('New client connected:', socket.id);

        // ==================== JOIN ====================
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

        //             activeDrivers.set(decoded._id.toString(), {
        //                 socketId: socket.id,
        //                 status: 'online',
        //                 lat: null,
        //                 lng: null,
        //                 useFor: useFor,
        //                 typeFor: useFor === 'bike' ? 'Bike' : 'Taxi'
        //             });

        //             console.log(`🚗 [DRIVER ADDED] ID: ${decoded._id} | useFor: ${useFor} | Total: ${activeDrivers.size}`);
        //         }

        //         socket.emit('joinSuccess', { message: 'Joined successfully' });

        //     } catch (err) {
        //         console.error('❌ [JOIN ERROR]:', err.message);
        //         socket.emit('joinError', { message: 'Invalid or expired token' });
        //     }
        // });
        // ==================== JOIN EVENT (Updated - lat/lng support) ====================
        socket.on('join', (data) => {
            try {
                console.log('🔑 [JOIN] Received:', data);

                if (!data?.token) {
                    return socket.emit('joinError', { message: 'Token is required' });
                }

                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

                socket.userId = decoded._id;
                socket.role = (data.role || 'user').toLowerCase();

                socket.join(decoded._id.toString());

                console.log(`✅ [JOIN SUCCESS] ID: ${decoded._id} | Role: ${socket.role}`);

                if (socket.role === 'driver') {
                    const useFor = (data.useFor || 'taxi').toLowerCase();

                    const driverEntry = {
                        socketId: socket.id,
                        status: 'online',
                        lat: data.lat ? Number(data.lat) : null,
                        lng: data.lng ? Number(data.lng) : null,
                        useFor: useFor,
                        typeFor: useFor === 'bike' ? 'Bike' : 'Taxi'
                    };

                    activeDrivers.set(decoded._id.toString(), driverEntry);

                    console.log(`🚗 [DRIVER ADDED] ID: ${decoded._id} | useFor: ${useFor} | Lat: ${driverEntry.lat} | Lng: ${driverEntry.lng} | Total: ${activeDrivers.size}`);
                }

                socket.emit('joinSuccess', { message: 'Joined successfully' });

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
        socket.on('sendLiveTracking', (data) => {
            const { rideId, latitude, longitude, time } = data;
            // Emit to the user of this ride (you can store rideId → userId mapping if needed)
            // For simplicity, assuming you join ride room or use user room
            io.to(data.userId || 'user-room').emit('receiveLiveTracking', {
                rideId,
                latitude,
                longitude,
                time
            });
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