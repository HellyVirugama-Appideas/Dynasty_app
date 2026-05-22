// const geolib = require('geolib');
// const createError = require('http-errors');
// const { sendOnlyNotification } = require('../../utils/sendNotification');
// const multilingual = require('../../utils/multilingual');
// const notifyDriversFirebase = require('../../utils/notifyDriversFirebase');
// const notifyDrivers = require('../../utils/notifyDrivers');
// const generateCode = require('../../utils/generateCode');

// const Type = require('../../models/typeModel');``
// const Charges = require('../../models/chargesModel');
// const RideReq = require('../../models/rideReqModel');
// const Ride = require('../../models/rideModel');
// const Driver = require('../../models/driverModel');
// const Rating = require('../../models/driverRatingModel');


// exports.getVehicleTypes = async (req, res, next) => {
//     try {
//         const { type, pickupLat, pickupLng, endLat, endLng } = req.body;

//         // 1. Validation
//         if (!['taxi', 'bike'].includes(type?.toLowerCase())) {
//             return next(createError.BadRequest('Invalid type. Must be "taxi" or "bike".'));
//         }

//         if (!pickupLat || !pickupLng || !endLat || !endLng) {
//             return next(createError.BadRequest('All four coordinates are required (pickupLat, pickupLng, endLat, endLng).'));
//         }

//         const latValid = (v) => !isNaN(v) && Number(v) >= -90 && Number(v) <= 90;
//         const lngValid = (v) => !isNaN(v) && Number(v) >= -180 && Number(v) <= 180;

//         if (!latValid(pickupLat) || !lngValid(pickupLng) || !latValid(endLat) || !lngValid(endLng)) {
//             return next(createError.BadRequest('Invalid coordinate values (latitude -90 to 90, longitude -180 to 180).'));
//         }

//         const requestedTypeLower = type.toLowerCase(); // "taxi" or "bike"
//         const typeFor = requestedTypeLower === 'bike' ? 'Bike' : 'Taxi'; // "Bike" or "Taxi"
//         const radiusInMeters = Number(process.env.RADIUS_IN_METERS) || 5000;

//         // 2. Try real-time drivers from Socket.IO first
//         let nearbyDrivers = [];

//         if (global.io?.activeDrivers instanceof Map) {
//             console.log('✅ [SOCKET] activeDrivers total count:', global.io.activeDrivers.size);

//             global.io.activeDrivers.forEach((driverData, driverId) => {
//                 const driverUseFor = (driverData.useFor || '').toLowerCase();
//                 const driverTypeFor = (driverData.typeFor || '').toLowerCase();

//                 // Detailed logging (remove in production if too noisy)
//                 // console.log(`Checking driver ${driverId}: status=${driverData.status}, useFor=${driverUseFor}, typeFor=${driverTypeFor}, lat=${driverData.lat}, lng=${driverData.lng}`);

//                 const typeMatches = (
//                     driverUseFor === requestedTypeLower ||
//                     driverTypeFor === requestedTypeLower ||
//                     driverTypeFor === typeFor.toLowerCase()
//                 );

//                 if (
//                     driverData.status === 'online' &&
//                     typeMatches &&
//                     !isNaN(driverData.lat) &&
//                     !isNaN(driverData.lng)
//                 ) {
//                     const distance = geolib.getDistance(
//                         { latitude: Number(pickupLat), longitude: Number(pickupLng) },
//                         { latitude: driverData.lat, longitude: driverData.lng }
//                     );

//                     if (distance <= radiusInMeters) {
//                         nearbyDrivers.push({
//                             _id: driverId,
//                             type: driverData.driverInfo?.type || driverData.type || null, // type ID
//                             lat: driverData.lat,
//                             lng: driverData.lng,
//                             distanceFromPickup: distance,
//                         });
//                     }
//                 }
//             });

//             console.log(`✅ [SOCKET] Found ${nearbyDrivers.length} nearby ${typeFor} drivers within ${radiusInMeters}m`);
//         } else {
//             console.warn('⚠️ [SOCKET] global.io.activeDrivers not available or not a Map');
//         }

//         // 3. Fallback to MongoDB if no real-time drivers found
//         if (nearbyDrivers.length === 0) {
//             console.log('[DB FALLBACK] Querying MongoDB for nearby online drivers');

//             const dbDrivers = await Driver.find({
//                 location: {
//                     $near: {
//                         $geometry: {
//                             type: 'Point',
//                             coordinates: [Number(pickupLng), Number(pickupLat)],
//                         },
//                         $maxDistance: radiusInMeters,
//                     },
//                 },
//                 status: 'online',
//                 isDeleted: false,
//                 $or: [
//                     { useFor: requestedTypeLower },
//                     { useFor: typeFor },
//                     // Optional: if type is populated and has typeFor
//                     { 'type.typeFor': typeFor }
//                 ]
//             })
//                 .select('_id type location useFor')
//                 .populate('type', 'name typeFor _id');

//             nearbyDrivers = dbDrivers.map(d => {
//                 const lat = d.location?.coordinates?.[1];
//                 const lng = d.location?.coordinates?.[0];
//                 let distance = 0;

//                 if (!isNaN(lat) && !isNaN(lng)) {
//                     distance = geolib.getDistance(
//                         { latitude: Number(pickupLat), longitude: Number(pickupLng) },
//                         { latitude: lat, longitude: lng }
//                     );
//                 }

//                 return {
//                     _id: d._id.toString(),
//                     type: d.type?._id?.toString() || null,
//                     typeFor: d.type?.typeFor || d.useFor || '',
//                     lat,
//                     lng,
//                     distanceFromPickup: distance,
//                 };
//             });

//             console.log(`[DB] Found ${nearbyDrivers.length} nearby drivers after type filter`);
//         }

//         // 4. Load vehicle types and pricing rules
//         let [types, charges] = await Promise.all([
//             Type.find({ typeFor }).select('-__v -typeFor'),
//             Charges.findOne(),
//         ]);

//         if (!charges) {
//             charges = { baseFare: 40, minimumFare: 80, bookingFee: 10 };
//             console.warn('No charges document found → using fallback defaults');
//         }

//         // 5. Filter only types that have at least one nearby driver
//         let availableTypes = types.filter(t =>
//             nearbyDrivers.some(d => d.type?.toString() === t._id.toString())
//         );

//         // Apply multilingual if you have it
//         availableTypes = availableTypes.map(t => multilingual(t, req));

//         // 6. Calculate total ride distance (for pricing)
//         const rideDistanceMeters = geolib.getDistance(
//             { latitude: Number(pickupLat), longitude: Number(pickupLng) },
//             { latitude: Number(endLat), longitude: Number(endLng) }
//         );
//         const rideDistanceKm = rideDistanceMeters / 1000;

//         // 7. Enrich each type with price, time, available count + old field names
//         availableTypes.forEach(type => {
//             const driversOfThisType = nearbyDrivers.filter(
//                 d => d.type?.toString() === type._id.toString()
//             );

//             type.availableDrivers = driversOfThisType.length;

//             // Price calculation
//             const distanceCharge = rideDistanceKm * (Number(type.distanceRate) || 0);
//             const calculatedFare = charges.baseFare + distanceCharge + charges.bookingFee;
//             const finalPrice = Number(Math.max(calculatedFare, charges.minimumFare).toFixed(2));

//             type.estimatedPrice = finalPrice;
//             type.price = finalPrice; // ← old field name for compatibility

//             type.distanceRate = undefined;

//             // ETA / arrival time
//             if (driversOfThisType.length > 0) {
//                 let totalMinutes = 0;
//                 driversOfThisType.forEach(driver => {
//                     if (!isNaN(driver.lat) && !isNaN(driver.lng)) {
//                         const driverDistMeters = geolib.getDistance(
//                             { latitude: driver.lat, longitude: driver.lng },
//                             { latitude: Number(pickupLat), longitude: Number(pickupLng) }
//                         );
//                         const driverDistKm = driverDistMeters / 1000;
//                         totalMinutes += (driverDistKm / 30) * 60; // assuming 30 km/h average speed
//                     }
//                 });
//                 const avgMinutes = Math.max(1, Math.ceil(totalMinutes / driversOfThisType.length));

//                 type.estimatedArrivalMinutes = avgMinutes;
//                 type.time = avgMinutes; // ← old field name for compatibility
//             } else {
//                 type.estimatedArrivalMinutes = 0;
//                 type.time = 0;
//             }
//         });

//         // Sort: fastest arrival first, prefer types with drivers
//         availableTypes.sort((a, b) => {
//             if (a.estimatedArrivalMinutes === 0) return 1;
//             if (b.estimatedArrivalMinutes === 0) return -1;
//             return a.estimatedArrivalMinutes - b.estimatedArrivalMinutes;
//         });

//         // 8. Final response (backward compatible + enhanced info)
//         res.json({
//             code: '1',
//             message: req.t('success') || 'Vehicle types fetched successfully',
//             data: {
//                 types: availableTypes,

//                 ride: {
//                     distanceKm: Number(rideDistanceKm.toFixed(2)),
//                     pickup: { lat: Number(pickupLat), lng: Number(pickupLng) },
//                     dropoff: { lat: Number(endLat), lng: Number(endLng) },
//                 },

//                 search: {
//                     radiusKm: Number((radiusInMeters / 1000).toFixed(1)),
//                     totalNearbyDrivers: nearbyDrivers.length,
//                 },

//                 chargesSnapshot: {
//                     baseFare: charges.baseFare,
//                     minimumFare: charges.minimumFare,
//                     bookingFee: charges.bookingFee,
//                 },

//                 debug: {
//                     socketDriversFound: global.io?.activeDrivers?.size || 0,
//                     dbDriversQueried: nearbyDrivers.length,
//                     source: nearbyDrivers.length > 0 && global.io?.activeDrivers?.size > 0 ? 'socket' : 'database'
//                 }
//             }
//         });

//     } catch (err) {
//         console.error('getVehicleTypes error:', err);
//         next(err);
//     }
// };


// exports.getVehicleTypes = async (req, res, next) => {
//     try {
//         const { type, pickupLat, pickupLng, endLat, endLng } = req.body;

//         console.log('========== GET VEHICLE TYPES API CALLED ==========');
//         console.log('Request Body:', { type, pickupLat, pickupLng, endLat, endLng });

//         // 1. Validation
//         if (!['taxi', 'bike'].includes(type?.toLowerCase())) {
//             return next(createError.BadRequest('Invalid type. Must be "taxi" or "bike".'));
//         }

//         if (!pickupLat || !pickupLng || !endLat || !endLng) {
//             return next(createError.BadRequest('All four coordinates are required.'));
//         }

//         const requestedTypeLower = type.toLowerCase();
//         const typeFor = requestedTypeLower === 'bike' ? 'Bike' : 'Taxi';
//         const radiusInMeters = Number(process.env.RADIUS_IN_METERS) || 5000;

//         console.log(`🔍 Searching nearby ${typeFor} vehicles within ${radiusInMeters}m radius`);

//         let nearbyDrivers = [];

//         // ==================== 1. SOCKET BASED NEARBY VEHICLES ====================
//         if (global.io?.activeDrivers instanceof Map) {
//             console.log(`✅ [SOCKET] activeDrivers Map found | Total online drivers: ${global.io.activeDrivers.size}`);

//             global.io.activeDrivers.forEach((driverData, driverId) => {
//                 const driverUseFor = (driverData.useFor || '').toLowerCase();
//                 const driverTypeFor = (driverData.typeFor || '').toLowerCase();

//                 // Matching logic
//                 const typeMatches = 
//                     driverUseFor === requestedTypeLower || 
//                     driverTypeFor === requestedTypeLower ||
//                     driverTypeFor === typeFor.toLowerCase();

//                 console.log(`Checking Driver ${driverId}: status=${driverData.status}, useFor=${driverUseFor}, typeFor=${driverTypeFor}, matches=${typeMatches}`);

//                 if (
//                     driverData.status === 'online' &&
//                     typeMatches &&
//                     !isNaN(driverData.lat) &&
//                     !isNaN(driverData.lng)
//                 ) {
//                     const distance = geolib.getDistance(
//                         { latitude: Number(pickupLat), longitude: Number(pickupLng) },
//                         { latitude: driverData.lat, longitude: driverData.lng }
//                     );

//                     if (distance <= radiusInMeters) {
//                         nearbyDrivers.push({
//                             driverId: driverId,
//                             type: driverData.driverInfo?.type || driverData.type || null,
//                             lat: driverData.lat,
//                             lng: driverData.lng,
//                             distanceFromPickup: distance,
//                             distanceKm: (distance / 1000).toFixed(1) + " km"
//                         });
//                     }
//                 }
//             });

//             console.log(`✅ [SOCKET] Final nearby ${typeFor} drivers found: ${nearbyDrivers.length}`);
//         } else {
//             console.warn('⚠️ [SOCKET] activeDrivers Map is not available or not a Map');
//         }

//         // ==================== 2. DATABASE FALLBACK ====================
//         if (nearbyDrivers.length === 0) {
//             console.log('[DB FALLBACK] No drivers from socket, querying MongoDB...');

//             const dbDrivers = await Driver.find({
//                 location: {
//                     $near: {
//                         $geometry: { type: 'Point', coordinates: [Number(pickupLng), Number(pickupLat)] },
//                         $maxDistance: radiusInMeters,
//                     },
//                 },
//                 status: 'online',
//                 isDeleted: false,
//                 $or: [
//                     { useFor: requestedTypeLower },
//                     { useFor: typeFor },
//                     { 'type.typeFor': typeFor }
//                 ]
//             })
//             .select('_id type location useFor')
//             .populate('type', 'name typeFor _id');

//             nearbyDrivers = dbDrivers.map(d => {
//                 const lat = d.location?.coordinates?.[1];
//                 const lng = d.location?.coordinates?.[0];
//                 let distance = 0;

//                 if (lat && lng) {
//                     distance = geolib.getDistance(
//                         { latitude: Number(pickupLat), longitude: Number(pickupLng) },
//                         { latitude: lat, longitude: lng }
//                     );
//                 }

//                 return {
//                     driverId: d._id.toString(),
//                     type: d.type?._id?.toString() || null,
//                     lat: lat,
//                     lng: lng,
//                     distanceFromPickup: distance,
//                     distanceKm: (distance / 1000).toFixed(1) + " km"
//                 };
//             });

//             console.log(`[DB] Found ${nearbyDrivers.length} nearby drivers from database`);
//         }

//         // ==================== 3. Vehicle Types & Pricing Logic ====================
//         let [types, charges] = await Promise.all([
//             Type.find({ typeFor }).select('-__v -typeFor'),
//             Charges.findOne(),
//         ]);

//         if (!charges) charges = { baseFare: 40, minimumFare: 80, bookingFee: 10 };

//         // Filter only types that have nearby drivers
//         let availableTypes = types.filter(t => 
//             nearbyDrivers.some(d => d.type?.toString() === t._id.toString())
//         );

//         availableTypes = availableTypes.map(t => multilingual(t, req));

//         // Enrich with price and ETA
//         const rideDistanceMeters = geolib.getDistance(
//             { latitude: Number(pickupLat), longitude: Number(pickupLng) },
//             { latitude: Number(endLat), longitude: Number(endLng) }
//         );
//         const rideDistanceKm = rideDistanceMeters / 1000;

//         availableTypes.forEach(type => {
//             const driversOfThisType = nearbyDrivers.filter(d => d.type?.toString() === type._id.toString());

//             type.availableDrivers = driversOfThisType.length;
//             type.nearbyDrivers = driversOfThisType;   // Important for frontend

//             // Price
//             const distanceCharge = rideDistanceKm * (Number(type.distanceRate) || 0);
//             const finalPrice = Number(Math.max(charges.baseFare + distanceCharge + charges.bookingFee, charges.minimumFare).toFixed(2));

//             type.estimatedPrice = finalPrice;
//             type.price = finalPrice;

//             // ETA
//             if (driversOfThisType.length > 0) {
//                 let totalMinutes = 0;
//                 driversOfThisType.forEach(d => {
//                     const dist = geolib.getDistance(
//                         { latitude: d.lat, longitude: d.lng },
//                         { latitude: Number(pickupLat), longitude: Number(pickupLng) }
//                     );
//                     totalMinutes += (dist / 1000 / 30) * 60;
//                 });
//                 const avgMinutes = Math.max(1, Math.ceil(totalMinutes / driversOfThisType.length));
//                 type.estimatedArrivalMinutes = avgMinutes;
//                 type.time = avgMinutes;
//             }
//         });

//         availableTypes.sort((a, b) => a.estimatedArrivalMinutes - b.estimatedArrivalMinutes);

//         console.log(`✅ Final Response: ${availableTypes.length} vehicle types | ${nearbyDrivers.length} nearby drivers`);

//         // Final Response
//         res.json({
//             code: '1',
//             message: 'Vehicle types fetched successfully',
//             data: {
//                 types: availableTypes,
//                 nearbyVehicles: nearbyDrivers,           // ← Yeh important hai
//                 ride: {
//                     distanceKm: Number(rideDistanceKm.toFixed(2)),
//                     pickup: { lat: Number(pickupLat), lng: Number(pickupLng) },
//                     dropoff: { lat: Number(endLat), lng: Number(endLng) }
//                 },
//                 search: {
//                     radiusKm: (radiusInMeters / 1000).toFixed(1),
//                     totalNearbyDrivers: nearbyDrivers.length,
//                     source: nearbyDrivers.length > 0 && global.io?.activeDrivers?.size > 0 ? 'socket' : 'database'
//                 }
//             }
//         });

//     } catch (err) {
//         console.error('❌ getVehicleTypes Error:', err);
//         next(err);
//     }
// };
// exports.bookRide = async (req, res, next) => {
//     try {
//         const user = req.user;
//         const isSchedule = req.body.isSchedule === 'true';

//         const nearbyDrivers = await Driver.find({
//             location: {
//                 $near: {    
//                     $geometry: {
//                         type: 'Point',
//                         coordinates: [req.body.pickupLng, req.body.pickupLat],
//                     },
//                     $maxDistance: process.env.radiusInMeters,
//                 },
//             },
//             type: req.body.type,
//             status: 'online',
//             isDeleted: false,
//         }).limit(5); // Limit to 5 closest drivers

//         if (nearbyDrivers.length === 0)
//             return next(createError.BadRequest('ride.fail'));

//         const ride = await RideReq.create({
//             user: req.user.id,
//             pickupAddress: req.body.pickupAddress,
//             pickupLat: req.body.pickupLat,
//             pickupLng: req.body.pickupLng,
//             endAddress: req.body.endAddress,
//             endLat: req.body.endLat,
//             endLng: req.body.endLng,
//             type: req.body.type,
//             price: req.body.price,
//             isSchedule,
//             scheduleTime: isSchedule ? req.body.scheduleTime : undefined,
//         });
//         await ride.populate('user', 'name phone');
//         console.log('==============================');
//         console.log('ride: ', ride);
//         console.log("==============================");

//         const rideObject = ride.toObject();

//         delete rideObject.__v;
//         delete rideObject.type;
//         delete rideObject.acceptedBy;

//         // Calculate distance for each driver
//         const drivers = nearbyDrivers.map(driver => {
//             const driverLocation = {
//                 latitude: driver.location.coordinates[1],
//                 longitude: driver.location.coordinates[0],
//             };
//             const pickupLocation = {
//                 latitude: ride.pickupLat,
//                 longitude: ride.pickupLng,
//             };

//             // Calculate distance
//             const distanceInMeters = geolib.getDistance(
//                 driverLocation,
//                 pickupLocation
//             );
//             const distanceInKm = (distanceInMeters / 1000).toFixed(1);

//             const timeInMinutes = (distanceInKm / 30) * 60; // Est. speed 30 km/h
//             const time =
//                 timeInMinutes < 1
//                     ? 'less than a minute away'
//                     : `${Math.round(timeInMinutes)} minutes away`;

//             const distance =
//                 distanceInMeters < 100
//                     ? `${distanceInMeters} meter away`
//                     : `${distanceInKm} km away`;

//             return { id: driver.id, distance, time };
//         });

//         // Notify drivers
//         const response = await notifyDriversFirebase(drivers, rideObject, user);
//         console.log('drivers: ', drivers);
//         console.log('response', response);
//         // if (!response) return next(createError.BadRequest('ride.fail'));

//         if (global.io) {
//             global.io.emit('newRideRequest', { 
//                 rideId: ride._id,
//                 ride: rideObject 
//             });
//         }

//         global.io.to(user.id).emit('rideRequested', {
//             rideId: ride._id,
//             message: 'Waiting for driver to accept...'
//         });

//         return res.json({
//             code: '1',
//             message: req.t('success'),
//         });
//     } catch (error) {
//         if (error.name == 'CastError')
//             return next(createError.BadRequest('Invalid type id.'));
//         next(error);
//     }
// };

// exports.bookRide = async (req, res, next) => {
//     try {
//         console.log('========== BOOK RIDE API CALLED ==========');
//         console.log('Request Body:', {
//             pickupAddress: req.body.pickupAddress,
//             pickupLat: req.body.pickupLat,
//             pickupLng: req.body.pickupLng,
//             endAddress: req.body.endAddress,
//             endLat: req.body.endLat,
//             endLng: req.body.endLng,
//             type: req.body.type,
//             price: req.body.price,
//             isSchedule: req.body.isSchedule
//         });

//         const user = req.user;
//         const isSchedule = req.body.isSchedule === 'true';

//         // 1. Find nearby drivers
//         console.log('🔍 Finding nearby drivers...');
//         const nearbyDrivers = await Driver.find({
//             location: {
//                 $near: {    
//                     $geometry: {
//                         type: 'Point',
//                         coordinates: [req.body.pickupLng, req.body.pickupLat],
//                     },
//                     $maxDistance: process.env.radiusInMeters || 5000,
//                 },
//             },
//             type: req.body.type,
//             status: 'online',
//             isDeleted: false,
//         }).limit(5);

//         console.log(`✅ Found ${nearbyDrivers.length} nearby drivers`);

//         if (nearbyDrivers.length === 0) {
//             console.log('❌ No nearby drivers found');
//             return next(createError.BadRequest('ride.fail'));
//         }

//         // 2. Create Ride Request
//         console.log('📝 Creating Ride Request in DB...');
//         const ride = await RideReq.create({
//             user: req.user.id,
//             pickupAddress: req.body.pickupAddress,
//             pickupLat: req.body.pickupLat,
//             pickupLng: req.body.pickupLng,
//             endAddress: req.body.endAddress,
//             endLat: req.body.endLat,
//             endLng: req.body.endLng,
//             type: req.body.type,
//             price: req.body.price,
//             isSchedule,
//             scheduleTime: isSchedule ? req.body.scheduleTime : undefined,
//         });

//         await ride.populate('user', 'name phone');

//         console.log('✅ Ride Request Created Successfully');
//         console.log('Ride ID:', ride._id.toString());
//         console.log('User Name:', ride.user?.name);
//         console.log('Pickup Address:', ride.pickupAddress);

//         // 3. Calculate real distance & time for drivers
//         console.log('📏 Calculating distance and time for drivers...');
//         const drivers = nearbyDrivers.map((driver, index) => {
//             const driverLocation = {
//                 latitude: driver.location.coordinates[1],
//                 longitude: driver.location.coordinates[0],
//             };
//             const pickupLocation = {
//                 latitude: Number(ride.pickupLat),
//                 longitude: Number(ride.pickupLng),
//             };

//             const distanceInMeters = geolib.getDistance(driverLocation, pickupLocation);
//             const distanceInKm = (distanceInMeters / 1000).toFixed(1);
//             const timeInMinutes = Math.round((distanceInKm / 30) * 60);

//             const distanceText = distanceInMeters < 100 
//                 ? `${distanceInMeters} meter away` 
//                 : `${distanceInKm} km away`;

//             const timeText = timeInMinutes < 1 
//                 ? 'less than a minute away' 
//                 : `${timeInMinutes} minutes away`;

//             console.log(`Driver ${index + 1}: ${distanceText} | ${timeText}`);

//             return { 
//                 id: driver.id, 
//                 distance: distanceText, 
//                 time: timeText,
//                 distanceInKm: parseFloat(distanceInKm)
//             };
//         });

//         // 4. Notify drivers via Firebase
//         console.log('📤 Sending Firebase notifications to drivers...');
//         const response = await notifyDriversFirebase(drivers, ride.toObject(), user);
//         console.log('Firebase Notification Response:', response);

//         // 5. Prepare data for Socket (newRideRequest)
//         const rideDataForSocket = {
//             rideId: ride._id.toString(),
//             user: {
//                 name: ride.user?.name || "Customer",
//                 phone: ride.user?.phone || ""
//             },
//             pickup: {
//                 address: ride.pickupAddress,
//                 lat: ride.pickupLat,
//                 lng: ride.pickupLng
//             },
//             dropoff: {
//                 address: ride.endAddress,
//                 lat: ride.endLat,
//                 lng: ride.endLng
//             },
//             price: ride.price || 0,
//             distance: drivers[0]?.distance || "N/A",           // Closest driver ka distance
//             estimatedTime: drivers[0]?.time || "N/A"           // Closest driver ka time
//         };

//         console.log('🚀 Final newRideRequest Data being sent:');
//         console.log(JSON.stringify(rideDataForSocket, null, 2));

//         // 6. Emit Socket Events
//         if (global.io) {
//             global.io.emit('newRideRequest', rideDataForSocket);
//             console.log('✅ newRideRequest event emitted to all drivers');

//             global.io.to(user.id.toString()).emit('rideRequested', {
//                 rideId: ride._id.toString(),
//                 message: 'Waiting for driver to accept...'
//             });
//             console.log('✅ rideRequested event sent to user');
//         } else {
//             console.warn('⚠️ global.io is not available');
//         }

//         console.log('========== BOOK RIDE API COMPLETED SUCCESSFULLY ==========\n');

//         return res.json({
//             code: '1',
//             message: req.t('success'),
//         });

//     } catch (error) {
//         console.error('❌ bookRide Error:', error);
//         if (error.name === 'CastError')
//             return next(createError.BadRequest('Invalid type id.'));
//         next(error);
//     }
// };

// exports.tempPayment = async (req, res, next) => {
//     try {
//         let request = await Ride.findById(req.body.requestId)
//             .populate({
//                 path: 'driver',
//                 populate: {
//                     path: 'type',
//                     select: '-__v -typeFor -distanceRate -capacity',
//                 },
//                 select: 'name profile phone',
//             })
//             .lean();

//         if (!request) return next(createError.BadRequest('Invalid requestId.'));

//         if (request.driver?.type)
//             request.type = multilingual(request.driver?.type, req);

//         request.driver.type = undefined;
//         request.otp = undefined;
//         request.__v = undefined;
//         request.status = undefined;
//         request.rideStatus = undefined;
//         request.isSchedule = undefined;
//         request.time = undefined;
//         request.distance = undefined;

//         await Ride.findByIdAndUpdate(request._id, {
//             status: 'Completed',
//             rideStatus: 'complete',
//         }).catch(error => console.log('Error updating ride: ', error));

//         // Notify user
//         const data = {
//             title: 'Ride has been completed.',
//             body: 'Your ride has been successfully completed. Thank you for using our service!',
//         };
//         sendOnlyNotification(req.user.fcmToken, data);

//         res.json({ code: '1', message: req.t('success'), data: request });
//     } catch (error) {
//         console.log('error: ', error);
//         next(error);
//     }
// };

// exports.cancelRide = async (req, res, next) => {
//     try {
//         const ride = await Ride.findById(req.body.rideId).populate(
//             'user driver',
//             'name fcmToken'
//         );
//         if (
//             !ride ||
//             ['Completed', 'Cancelled', 'Expired'].includes(ride.status) ||
//             ride.rideStatus === 'wayToDone'
//         )
//             return next(createError.NotFound('Ride not found with given id.'));

//         ride.status = 'Cancelled';
//         ride.cancellationReason =
//             req.body.cancellationReason || 'No reason provided';

//         // Save ride and Update driver status to online
//         await Promise.all([
//             ride.save(),
//             Driver.findByIdAndUpdate(ride.driver, { status: 'online' }),
//         ]);

//         // Notify driver
//         const data = {
//             title: 'Ride has been cancelled.',
//             body: `Your ride has been cancelled by ${ride.user.name}. Reason - ${ride.cancellationReason}.`,
//         };

//         sendOnlyNotification(ride.driver.fcmToken, data);

//         io.to(ride.driver.toString()).emit('cancelRide', { ride });

//         res.json({ code: '1', message: req.t('ride.cancel') });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.getRides = async (req, res, next) => {
//     try {
//         let rides = await Ride.find({ user: req.user.id })
//             .populate('user', 'name phone')
//             .populate({
//                 path: 'driver',
//                 match: { isDeleted: false },
//                 populate: {
//                     path: 'type',
//                     select: '-__v -distanceRate -typeFor -capacity',
//                 },
//                 select: 'name profile phone rating',
//             })
//             .select('-__v')
//             .sort('-_id')
//             .lean();
//             console.log('rides: ', rides);

//         rides = rides.map(ride => {
//             if (ride.driver?.type)
//                 ride.type = multilingual(ride.driver?.type, req);
//             return ride;
//         });

//         // rides = rides.map(ride => {
//         //     ride.driver.type = undefined;
//         //     return ride;
//         // });

//         res.json({ code: '1', message: req.t('success'), rides });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.addRating = async (req, res, next) => {
//     try {
//         const { driverId, rating: newRating, comment } = req.body;

//         let updatedRating = await Rating.findOne({
//             driver: driverId,
//             user: req.user.id,
//         });

//         if (updatedRating) {
//             updatedRating.rating = newRating;
//             updatedRating.comment = comment;
//         } else {
//             updatedRating = new Rating({
//                 driver: driverId,
//                 user: req.user.id,
//                 rating: newRating,
//                 comment,
//             });
//         }
//         await updatedRating.save();

//         Rating.aggregate([
//             { $match: { driver: updatedRating.driver } },
//             { $group: { _id: '$driver', averageRating: { $avg: '$rating' } } },
//         ]).then(averageRatings => {
//             const averageRating = averageRatings[0].averageRating.toFixed(1);
//             Driver.findByIdAndUpdate(driverId, {
//                 rating: averageRating,
//             }).exec();
//         });

//         res.json({
//             code: '1',
//             message: req.t('rating.added'),
//             rating: updatedRating,
//         });
//     } catch (error) {
//         if (error.name == 'CastError')
//             return next(createError.BadRequest('Invalid driverId.'));
//         next(error);
//     }
// };

const geolib = require('geolib');
const createError = require('http-errors');
const { sendOnlyNotification } = require('../../utils/sendNotification');
const multilingual = require('../../utils/multilingual');
const notifyDriversFirebase = require('../../utils/notifyDriversFirebase');
const notifyDrivers = require('../../utils/notifyDrivers');
const generateCode = require('../../utils/generateCode');

const Type = require('../../models/typeModel');
const Charges = require('../../models/chargesModel');
const RideReq = require('../../models/rideReqModel');
const Ride = require('../../models/rideModel');
const Driver = require('../../models/driverModel');
const Rating = require('../../models/driverRatingModel');
const Transaction = require("../../models/transaction")


// ✅ Single getVehicleTypes — useFor based matching
exports.getVehicleTypes = async (req, res, next) => {
    try {
        const { type, pickupLat, pickupLng, endLat, endLng } = req.body;

        console.log('\n========== GET VEHICLE TYPES ==========');
        console.log('type:', type, '| pickup:', pickupLat, pickupLng, '| end:', endLat, endLng);

        // 1. Validation
        if (!['taxi', 'bike'].includes(type?.toLowerCase())) {
            return next(createError.BadRequest('Invalid type. Must be "taxi" or "bike".'));
        }
        if (!pickupLat || !pickupLng || !endLat || !endLng) {
            return next(createError.BadRequest('All four coordinates are required.'));
        }

        // 'taxi' or 'bike' — exactly as stored in DB useFor field
        const requestedUseFor = type.toLowerCase();

        // 'Taxi' or 'Bike' — for Type model typeFor field
        const typeFor = requestedUseFor === 'bike' ? 'Bike' : 'Taxi';

        const radiusInMeters = Number(process.env.RADIUS_IN_METERS) || 5000;

        let nearbyDrivers = [];

        // ==================== 1. SOCKET MAP ====================
        if (global.io?.activeDrivers instanceof Map && global.io.activeDrivers.size > 0) {
            console.log(`✅ [SOCKET] Map size: ${global.io.activeDrivers.size}`);

            global.io.activeDrivers.forEach((driverData, driverId) => {
                console.log(`  Driver ${driverId}: status=${driverData.status} useFor=${driverData.useFor} type=${driverData.type} lat=${driverData.lat} lng=${driverData.lng}`);

                // ✅ useFor se match — DB se store hai, exact match karega
                if (driverData.status !== 'online') return;
                if (driverData.useFor !== requestedUseFor) return;
                if (driverData.lat == null || driverData.lng == null) return;
                if (isNaN(driverData.lat) || isNaN(driverData.lng)) return;

                const distance = geolib.getDistance(
                    { latitude: Number(pickupLat), longitude: Number(pickupLng) },
                    { latitude: driverData.lat, longitude: driverData.lng }
                );

                console.log(`  ✅ useFor matched | distance: ${distance}m`);

                if (distance <= radiusInMeters) {
                    nearbyDrivers.push({
                        driverId,
                        type: driverData.type || null,   // ObjectId string
                        lat: driverData.lat,
                        lng: driverData.lng,
                        distanceFromPickup: distance,
                        distanceKm: (distance / 1000).toFixed(1) + ' km'
                    });
                }
            });

            console.log(`✅ [SOCKET] Nearby ${requestedUseFor} drivers: ${nearbyDrivers.length}`);
        } else {
            console.warn('⚠️ [SOCKET] activeDrivers not available or empty');
        }

        // ==================== 2. DB FALLBACK ====================
        if (nearbyDrivers.length === 0) {
            console.log('[DB FALLBACK] Querying MongoDB...');

            const dbDrivers = await Driver.find({
                location: {
                    $near: {
                        $geometry: { type: 'Point', coordinates: [Number(pickupLng), Number(pickupLat)] },
                        $maxDistance: radiusInMeters,
                    },
                },
                useFor: requestedUseFor,   // ✅ useFor se match
                status: 'online',
                isDeleted: false,
            })
                .select('_id type location useFor')
                .populate('type', 'name typeFor _id');

            nearbyDrivers = dbDrivers.map(d => {
                const lat = d.location?.coordinates?.[1];
                const lng = d.location?.coordinates?.[0];
                let distance = 0;
                if (lat && lng) {
                    distance = geolib.getDistance(
                        { latitude: Number(pickupLat), longitude: Number(pickupLng) },
                        { latitude: lat, longitude: lng }
                    );
                }
                return {
                    driverId: d._id.toString(),
                    type: d.type?._id?.toString() || null,
                    lat, lng,
                    distanceFromPickup: distance,
                    distanceKm: (distance / 1000).toFixed(1) + ' km'
                };
            });

            console.log(`[DB] Found ${nearbyDrivers.length} nearby drivers`);
        }

        // ==================== 3. Types + Pricing ====================
        let [types, charges] = await Promise.all([
            Type.find({ typeFor }).select('-__v -typeFor'),
            Charges.findOne(),
        ]);

        if (!charges) charges = { baseFare: 40, minimumFare: 80, bookingFee: 10 };

        console.log(`Types in DB for ${typeFor}:`, types.map(t => t._id.toString()));
        console.log(`Nearby driver types:`, nearbyDrivers.map(d => d.type));

        // Filter types jinke liye nearby driver hai
        let availableTypes = types.filter(t =>
            nearbyDrivers.some(d => d.type?.toString() === t._id.toString())
        );

        // ✅ Agar type match nahi hua but nearby drivers hain — sab types dikhao
        // (ye tab hota hai jab driver ka type DB se fetch nahi hua)
        if (availableTypes.length === 0 && nearbyDrivers.length > 0) {
            console.warn('⚠️ Type filter returned 0 — showing all types for this category');
            availableTypes = types;
        }

        availableTypes = availableTypes.map(t => multilingual(t, req));

        // Ride distance for pricing
        const rideDistanceMeters = geolib.getDistance(
            { latitude: Number(pickupLat), longitude: Number(pickupLng) },
            { latitude: Number(endLat), longitude: Number(endLng) }
        );
        const rideDistanceKm = rideDistanceMeters / 1000;

        // Enrich each type with price + ETA
        availableTypes.forEach(vehicleType => {
            const driversOfThisType = nearbyDrivers.filter(
                d => d.type?.toString() === vehicleType._id.toString()
            );

            // Agar type match nahi — sab drivers use karo ETA ke liye
            const relevantDrivers = driversOfThisType.length > 0 ? driversOfThisType : nearbyDrivers;

            vehicleType.availableDrivers = relevantDrivers.length;
            vehicleType.nearbyDrivers = relevantDrivers;

            // Price
            const distanceCharge = rideDistanceKm * (Number(vehicleType.distanceRate) || 0);
            const finalPrice = Number(
                Math.max(
                    charges.baseFare + distanceCharge + charges.bookingFee,
                    charges.minimumFare
                ).toFixed(2)
            );
            vehicleType.estimatedPrice = finalPrice;
            vehicleType.price = finalPrice;
            vehicleType.distanceRate = undefined;

            // ETA
            if (relevantDrivers.length > 0) {
                let totalMinutes = 0;
                relevantDrivers.forEach(d => {
                    if (d.lat != null && d.lng != null && !isNaN(d.lat) && !isNaN(d.lng)) {
                        const dist = geolib.getDistance(
                            { latitude: d.lat, longitude: d.lng },
                            { latitude: Number(pickupLat), longitude: Number(pickupLng) }
                        );
                        totalMinutes += (dist / 1000 / 30) * 60;
                    }
                });
                const avgMinutes = Math.max(1, Math.ceil(totalMinutes / relevantDrivers.length));
                vehicleType.estimatedArrivalMinutes = avgMinutes;
                vehicleType.time = avgMinutes;
            } else {
                vehicleType.estimatedArrivalMinutes = 0;
                vehicleType.time = 0;
            }
        });

        availableTypes.sort((a, b) => {
            if (a.estimatedArrivalMinutes === 0) return 1;
            if (b.estimatedArrivalMinutes === 0) return -1;
            return a.estimatedArrivalMinutes - b.estimatedArrivalMinutes;
        });

        console.log(`✅ Final: ${availableTypes.length} types | ${nearbyDrivers.length} drivers`);
        console.log('========== DONE ==========\n');

        return res.json({
            code: '1',
            message: 'Vehicle types fetched successfully',
            data: {
                types: availableTypes,
                nearbyVehicles: nearbyDrivers,
                ride: {
                    distanceKm: Number(rideDistanceKm.toFixed(2)),
                    pickup: { lat: Number(pickupLat), lng: Number(pickupLng) },
                    dropoff: { lat: Number(endLat), lng: Number(endLng) }
                },
                search: {
                    radiusKm: (radiusInMeters / 1000).toFixed(1),
                    totalNearbyDrivers: nearbyDrivers.length,
                    source: (global.io?.activeDrivers?.size > 0) ? 'socket' : 'database'
                }
            }
        });

    } catch (err) {
        console.error('❌ getVehicleTypes Error:', err);
        next(err);
    }
};


// exports.bookRide = async (req, res, next) => {
//     try {
//         console.log('========== BOOK RIDE API CALLED ==========');
//         console.log('Request Body:', {
//             pickupAddress: req.body.pickupAddress,
//             pickupLat: req.body.pickupLat,
//             pickupLng: req.body.pickupLng,
//             endAddress: req.body.endAddress,
//             endLat: req.body.endLat,
//             endLng: req.body.endLng,
//             type: req.body.type,
//             price: req.body.price,
//             isSchedule: req.body.isSchedule
//         });

//         const user = req.user;
//         const isSchedule = req.body.isSchedule === 'true';

//         const nearbyDrivers = await Driver.find({
//             location: {
//                 $near: {
//                     $geometry: {
//                         type: 'Point',
//                         coordinates: [req.body.pickupLng, req.body.pickupLat],
//                     },
//                     $maxDistance: process.env.radiusInMeters || 5000,
//                 },
//             },
//             type: req.body.type,
//             status: 'online',
//             isDeleted: false,
//         }).limit(5);

//         console.log(`✅ Found ${nearbyDrivers.length} nearby drivers`);

//         if (nearbyDrivers.length === 0) {
//             return next(createError.BadRequest('ride.fail'));
//         }

//         const ride = await RideReq.create({
//             user: req.user.id,
//             pickupAddress: req.body.pickupAddress,
//             pickupLat: req.body.pickupLat,
//             pickupLng: req.body.pickupLng,
//             endAddress: req.body.endAddress,
//             endLat: req.body.endLat,
//             endLng: req.body.endLng,
//             type: req.body.type,
//             price: req.body.price,
//             isSchedule,
//             scheduleTime: isSchedule ? req.body.scheduleTime : undefined,
//         });

//         await ride.populate('user', 'name phone');
//         console.log('✅ Ride Request Created | ID:', ride._id.toString());

//         const drivers = nearbyDrivers.map((driver, index) => {
//             const driverLocation = {
//                 latitude: driver.location.coordinates[1],
//                 longitude: driver.location.coordinates[0],
//             };
//             const pickupLocation = {
//                 latitude: Number(ride.pickupLat),
//                 longitude: Number(ride.pickupLng),
//             };

//             const distanceInMeters = geolib.getDistance(driverLocation, pickupLocation);
//             const distanceInKm = (distanceInMeters / 1000).toFixed(1);
//             const timeInMinutes = Math.round((distanceInKm / 30) * 60);

//             const distanceText = distanceInMeters < 100
//                 ? `${distanceInMeters} meter away`
//                 : `${distanceInKm} km away`;

//             const timeText = timeInMinutes < 1
//                 ? 'less than a minute away'
//                 : `${timeInMinutes} minutes away`;

//             console.log(`Driver ${index + 1}: ${distanceText} | ${timeText}`);

//             return { id: driver.id, distance: distanceText, time: timeText, distanceInKm: parseFloat(distanceInKm) };
//         });

//         console.log('📤 Sending Firebase notifications...');
//         const response = await notifyDriversFirebase(drivers, ride.toObject(), user);
//         console.log('Firebase Response:', response);

//         const rideDataForSocket = {
//             rideId: ride._id.toString(),
//             user: { name: ride.user?.name || 'Customer', phone: ride.user?.phone || '' },
//             pickup: { address: ride.pickupAddress, lat: ride.pickupLat, lng: ride.pickupLng },
//             dropoff: { address: ride.endAddress, lat: ride.endLat, lng: ride.endLng },
//             price: ride.price || 0,
//             distance: drivers[0]?.distance || 'N/A',
//             estimatedTime: drivers[0]?.time || 'N/A'
//         };

//         if (global.io) {
//             global.io.emit('newRideRequest', rideDataForSocket);
//             global.io.to(user.id.toString()).emit('rideRequested', {
//                 rideId: ride._id.toString(),
//                 message: 'Waiting for driver to accept...'
//             });
//             console.log('✅ Socket events emitted');
//         }

//         console.log('========== BOOK RIDE COMPLETED ==========\n');
//         return res.json({ code: '1', message: req.t('success') });

//     } catch (error) {
//         console.error('❌ bookRide Error:', error);
//         if (error.name === 'CastError')
//             return next(createError.BadRequest('Invalid type id.'));
//         next(error);
//     }
// };

/////////////////////////////////////////////2
// exports.bookRide = async (req, res, next) => {
//     try {
//         console.log('========== BOOK RIDE API CALLED ==========');

//         const user = req.user;
//         const isSchedule = req.body.isSchedule === true || req.body.isSchedule === 'true';

//         let scheduleTime = null;

//         // ✅ Proper validation and date parsing for scheduled ride
//         if (isSchedule) {
//             if (!req.body.scheduleTime) {
//                 return next(createError.BadRequest('scheduleTime is required for scheduled ride'));
//             }

//             scheduleTime = new Date(req.body.scheduleTime);

//             // Check if date is valid
//             if (isNaN(scheduleTime.getTime())) {
//                 return next(createError.BadRequest('Invalid scheduleTime format. Please send valid date'));
//             }

//             // Check if schedule time is in future
//             if (scheduleTime <= new Date()) {
//                 return next(createError.BadRequest('Schedule time must be in the future'));
//             }
//         }

//         // Find nearby drivers
//         const nearbyDrivers = await Driver.find({
//             location: {
//                 $near: {
//                     $geometry: { type: 'Point', coordinates: [req.body.pickupLng, req.body.pickupLat] },
//                     $maxDistance: process.env.RADIUS_IN_METERS || 5000,
//                 },
//             },
//             type: req.body.type,
//             status: 'online',
//             isDeleted: false,
//         }).limit(5);

//         if (nearbyDrivers.length === 0) {
//             return next(createError.BadRequest('No drivers available nearby'));
//         }   

//         // Create Ride Request - Safe way
//         const rideData = {
//             user: req.user.id,
//             pickupAddress: req.body.pickupAddress,
//             pickupLat: req.body.pickupLat,
//             pickupLng: req.body.pickupLng,
//             endAddress: req.body.endAddress,
//             endLat: req.body.endLat,
//             endLng: req.body.endLng,
//             type: req.body.type,
//             price: req.body.price,
//             isSchedule,
//         };

//         // Only add scheduleTime if it's a scheduled ride and valid
//         if (isSchedule && scheduleTime) {
//             rideData.scheduleTime = scheduleTime;
//         }

//         const ride = await RideReq.create(rideData);

//         await ride.populate('user', 'name phone');

//         console.log(`✅ Ride Request Created | ID: ${ride._id} | Scheduled: ${isSchedule}`);

//         // ==================== SCHEDULED RIDE LOGIC ====================
//         if (isSchedule) {
//             const schedule = require('node-schedule');

//             schedule.scheduleJob(scheduleTime, async () => {
//                 try {
//                     console.log(`🔔 Scheduled Ride Time Reached! Sending notification for Ride: ${ride._id}`);

//                     const drivers = nearbyDrivers.map(driver => ({
//                         id: driver._id,
//                         distance: 'N/A',
//                         time: 'N/A'
//                     }));

//                     await notifyDriversFirebase(drivers, ride.toObject(), user);

//                     if (global.io) {
//                         global.io.emit('newScheduledRideRequest', {
//                             rideId: ride._id.toString(),
//                             message: `You have a scheduled ride at ${scheduleTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
//                             pickup: { address: ride.pickupAddress },
//                             dropoff: { address: ride.endAddress },
//                             price: ride.price,
//                             scheduleTime: scheduleTime.toISOString()
//                         });
//                     }
//                 } catch (err) {
//                     console.error('Scheduled notification error:', err);
//                 }
//             });

//             console.log(`⏰ Ride scheduled for ${scheduleTime.toLocaleString()}`);

//             return res.json({
//                 code: '1',
//                 message: 'Scheduled ride booked successfully! Drivers will be notified at the scheduled time.',
//                 data: {
//                     rideId: ride._id,
//                     scheduleTime: scheduleTime.toISOString(),
//                     isSchedule: true
//                 }
//             });
//         }

//         // ==================== NORMAL (Instant) RIDE ====================
//         const drivers = nearbyDrivers.map((driver, index) => {
//             const driverLocation = {
//                 latitude: driver.location.coordinates[1],
//                 longitude: driver.location.coordinates[0],
//             };
//             const pickupLocation = {
//                 latitude: Number(ride.pickupLat),
//                 longitude: Number(ride.pickupLng),
//             };

//             const distanceInMeters = geolib.getDistance(driverLocation, pickupLocation);
//             const distanceInKm = (distanceInMeters / 1000).toFixed(1);
//             const timeInMinutes = Math.round((distanceInKm / 30) * 60);

//             const distanceText = distanceInMeters < 100
//                 ? `${distanceInMeters} meter away`
//                 : `${distanceInKm} km away`;

//             const timeText = timeInMinutes < 1
//                 ? 'less than a minute away'
//                 : `${timeInMinutes} minutes away`;

//             return { 
//                 id: driver.id, 
//                 distance: distanceText, 
//                 time: timeText, 
//                 distanceInKm: parseFloat(distanceInKm) 
//             };
//         });

//         console.log('📤 Sending immediate notifications for instant ride...');
//         await notifyDriversFirebase(drivers, ride.toObject(), user);

//         // Socket emit for instant ride
//         if (global.io) {
//             const rideDataForSocket = {
//                 rideId: ride._id.toString(),
//                 user: { name: ride.user?.name || 'Customer', phone: ride.user?.phone || '' },
//                 pickup: { address: ride.pickupAddress, lat: ride.pickupLat, lng: ride.pickupLng },
//                 dropoff: { address: ride.endAddress, lat: ride.endLat, lng: ride.endLng },
//                 price: ride.price || 0,
//                 distance: drivers[0]?.distance || 'N/A',
//                 estimatedTime: drivers[0]?.time || 'N/A'
//             };

//             global.io.emit('newRideRequest', rideDataForSocket);
//         }

//         return res.json({ code: '1', message: req.t('success') });

//     } catch (error) {
//         console.error('❌ bookRide Error:', error);
//         next(error);
//     }
// };

exports.bookRide = async (req, res, next) => {
    try {
        console.log('========== BOOK RIDE API CALLED ==========');
        console.log('Request Body:', {
            pickupAddress: req.body.pickupAddress,
            pickupLat: req.body.pickupLat,
            pickupLng: req.body.pickupLng,
            endAddress: req.body.endAddress,
            endLat: req.body.endLat,
            endLng: req.body.endLng,
            type: req.body.type,
            useFor: req.body.useFor,
            price: req.body.price,
            isSchedule: req.body.isSchedule
        });
        const user = req.user;

        const useFor = (req.body.useFor || '').toLowerCase().trim();
        if (!['taxi', 'bike'].includes(useFor)) {
            return next(createError.BadRequest('useFor is required and must be "taxi" or "bike"'));
        }
        console.log(`✅ Ride type: ${useFor} | Only ${useFor} drivers will be notified`);


        // ✅ FIXED isSchedule (handle all cases)
        const isSchedule =
            req.body.isSchedule == true ||
            req.body.isSchedule == 'true' ||
            req.body.isSchedule == 1 ||
            req.body.isSchedule == '1';

        let scheduleTime = null;

        // ✅ Proper validation and date parsing for scheduled ride
        if (isSchedule) {
            if (!req.body.scheduleTime) {
                return next(createError.BadRequest('scheduleTime is required for scheduled ride'));
            }

            scheduleTime = new Date(req.body.scheduleTime);

            // Check if date is valid
            if (isNaN(scheduleTime.getTime())) {
                return next(createError.BadRequest('Invalid scheduleTime format. Please send valid date'));
            }

            // Check if schedule time is in future
            if (scheduleTime <= new Date()) {
                return next(createError.BadRequest('Schedule time must be in the future'));
            }
        }

        // Find nearby drivers
        const nearbyDrivers = await Driver.find({
            location: {
                $near: {
                    $geometry: { type: 'Point', coordinates: [req.body.pickupLng, req.body.pickupLat] },
                    $maxDistance: process.env.RADIUS_IN_METERS || 5000,
                },
            },
            useFor: useFor,
            // type: req.body.type,
            status: 'online',
            isDeleted: false,
        }).limit(5);

        if (nearbyDrivers.length === 0) {
            return next(createError.BadRequest('No drivers available nearby'));
        }

        // ✅ Create Ride Request (FIXED isSchedule force)
        const rideData = {
            user: req.user.id,
            pickupAddress: req.body.pickupAddress,
            pickupLat: req.body.pickupLat,
            pickupLng: req.body.pickupLng,
            endAddress: req.body.endAddress,
            endLat: req.body.endLat,
            endLng: req.body.endLng,
            type: req.body.type,
            price: req.body.price,
            isSchedule: isSchedule ? true : false
        };

        // ✅ Only add scheduleTime if scheduled
        if (isSchedule && scheduleTime) {
            rideData.scheduleTime = scheduleTime;
        }

        const ride = await RideReq.create(rideData);

        await ride.populate('user', 'name phone');

        console.log(`✅ Ride Request Created | ID: ${ride._id} | Scheduled: ${isSchedule}`);
        console.log("DEBUG -> isSchedule:", isSchedule, "scheduleTime:", scheduleTime);

        // ==================== SCHEDULED RIDE LOGIC ====================
        if (isSchedule) {
            const schedule = require('node-schedule');

            schedule.scheduleJob(scheduleTime, async () => {
                try {
                    console.log(`🔔 Scheduled Ride Time Reached! Sending notification for Ride: ${ride._id}`);

                    const drivers = nearbyDrivers.map(driver => ({
                        id: driver._id,
                        distance: 'N/A',
                        time: 'N/A'
                    }));

                    await notifyDriversFirebase(drivers, ride.toObject(), user);

                    if (global.io) {
                        global.io.emit('newScheduledRideRequest', {
                            rideId: ride._id.toString(),
                            message: `You have a scheduled ride at ${scheduleTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
                            pickup: { address: ride.pickupAddress },
                            dropoff: { address: ride.endAddress },
                            price: ride.price,
                            scheduleTime: scheduleTime.toISOString(),
                            useFor: useFor
                        });
                    }
                } catch (err) {
                    console.error('Scheduled notification error:', err);
                }
            });

            console.log(`⏰ Ride scheduled for ${scheduleTime.toLocaleString()}`);

            return res.json({
                code: '1',
                message: 'Scheduled ride booked successfully! Drivers will be notified at the scheduled time.',
                data: {
                    rideId: ride._id,
                    scheduleTime: scheduleTime.toISOString(),
                    isSchedule: true,
                    useFor
                }
            });
        }

        // ==================== NORMAL (Instant) RIDE ====================
        const drivers = nearbyDrivers.map((driver, index) => {
            const driverLocation = {
                latitude: driver.location.coordinates[1],
                longitude: driver.location.coordinates[0],
            };
            const pickupLocation = {
                latitude: Number(ride.pickupLat),
                longitude: Number(ride.pickupLng),
            };

            const distanceInMeters = geolib.getDistance(driverLocation, pickupLocation);
            const distanceInKm = (distanceInMeters / 1000).toFixed(1);
            const timeInMinutes = Math.round((distanceInKm / 30) * 60);

            const distanceText = distanceInMeters < 100
                ? `${distanceInMeters} meter away`
                : `${distanceInKm} km away`;

            const timeText = timeInMinutes < 1
                ? 'less than a minute away'
                : `${timeInMinutes} minutes away`;

            return {
                id: driver.id,
                distance: distanceText,
                time: timeText,
                distanceInKm: parseFloat(distanceInKm)
            };
        });

        console.log('📤 Sending immediate notifications for instant ride...');
        await notifyDriversFirebase(drivers, ride.toObject(), user);

        // Socket emit for instant ride
        // if (global.io) {
        //     const rideObject = ride.toObject();
        //     const rideDataForSocket = {
        //         // rideId: ride._id.toString(),
        //         // user: { name: ride.user?.name || 'Customer', phone: ride.user?.phone || '' },
        //         // pickup: { address: ride.pickupAddress, lat: ride.pickupLat, lng: ride.pickupLng },
        //         // dropoff: { address: ride.endAddress, lat: ride.endLat, lng: ride.endLng },
        //         // price: ride.price || 0,
        //         // distance: drivers[0]?.distance || 'N/A',
        //         // estimatedTime: drivers[0]?.time || 'N/A',
        //         // 
        //         driverId: drivers[0]?.id || null,
        //         userId: user.id,

        //         ride: rideObject,

        //         rideId: ride._id.toString(),

        //         distance: drivers[0]?.distance || 'N/A',
        //         time: drivers[0]?.time || 'N/A',
        //         useFor: useFor,


        //     };

        //     global.io.emit('newRideRequest', rideDataForSocket);
        // }

        if (global.io) {
            let socketNotified = 0;

            global.io.activeDrivers?.forEach((driverData, driverId) => {
                if (driverData.useFor !== useFor) {
                    console.log(`  ⛔ Skip driver ${driverId} (useFor: ${driverData.useFor})`);
                    return;
                }
                const isNearby = nearbyDrivers.some(d => d._id.toString() === driverId);
                if (!isNearby) {
                    console.log(`  ⛔ Skip driver ${driverId} — not in nearby list`);
                    return;
                }
                const matchedDriver = drivers.find(d => d.id.toString() === driverId);

                global.io.to(driverData.socketId).emit('newRideRequest', {
                    driverId: driverId,
                    userId: user.id,
                    ride: ride.toObject(),
                    rideId: ride._id.toString(),
                    distance: matchedDriver?.distance || 'N/A',
                    time: matchedDriver?.time || 'N/A',
                    useFor: useFor,
                });

                socketNotified++;
                console.log(`  ✅ Socket sent to ${useFor} driver: ${driverId}`);
            });

            console.log(`✅ activeDrivers map size: ${global.io.activeDrivers?.size || 0}`);
            console.log(`✅ Socket notifications sent to ${socketNotified} "${useFor}" drivers`);

            if (socketNotified === 0) {
                console.log(`⚠️ Socket map empty — FCM already sent to ${drivers.length} drivers`);
            }
        }

        // return res.json({ code: '1', message: req.t('success'), });
        return res.json({
            code: '1',
            message: req.t('success'),
            price: ride.price || 0,
            rideId: ride._id,
            useFor
        });

    } catch (error) {
        console.error('❌ bookRide Error:', error);
        next(error);
    }
};


exports.tempPayment = async (req, res, next) => {
    try {
        let request = await Ride.findById(req.body.requestId)
            .populate({
                path: 'driver',
                populate: { path: 'type', select: '-__v -typeFor -distanceRate -capacity' },
                select: 'name profile phone',
            })
            .lean();

        if (!request) return next(createError.BadRequest('Invalid requestId.'));

        if (request.driver?.type)
            request.type = multilingual(request.driver?.type, req);

        request.driver.type = undefined;
        request.otp = undefined;
        request.__v = undefined;
        request.status = undefined;
        request.rideStatus = undefined;
        request.isSchedule = undefined;
        request.time = undefined;
        request.distance = undefined;

        await Ride.findByIdAndUpdate(request._id, {
            status: 'Completed',
            rideStatus: 'complete',
        }).catch(error => console.log('Error updating ride:', error));

        sendOnlyNotification(req.user.fcmToken, {
            title: 'Ride has been completed.',
            body: 'Your ride has been successfully completed. Thank you for using our service!',
        });

        res.json({ code: '1', message: req.t('success'), data: request });
    } catch (error) {
        console.log('error:', error);
        next(error);
    }
};

exports.cancelRide = async (req, res, next) => {
    try {
        const ride = await Ride.findById(req.body.rideId).populate('user driver', 'name fcmToken');

        if (
            !ride ||
            ['Completed', 'Cancelled', 'Expired'].includes(ride.status) ||
            ride.rideStatus === 'wayToDone'
        )
            return next(createError.NotFound('Ride not found with given id.'));

        ride.status = 'Cancelled';
        ride.cancellationReason = req.body.cancellationReason || 'No reason provided';

        await Promise.all([
            ride.save(),
            Driver.findByIdAndUpdate(ride.driver, { status: 'online' }),
        ]);

        sendOnlyNotification(ride.driver.fcmToken, {
            title: 'Ride has been cancelled.',
            body: `Your ride has been cancelled by ${ride.user.name}. Reason - ${ride.cancellationReason}.`,
        });

        global.io.to(ride.driver.toString()).emit('cancelRide', { ride });

        res.json({ code: '1', message: req.t('ride.cancel') });
    } catch (error) {
        next(error);
    }
};

// exports.getRides = async (req, res, next) => {
//     try {
//         let rides = await Ride.find({ user: req.user.id })
//             .populate('user', 'name phone')
//             .populate({
//                 path: 'driver',
//                 match: { isDeleted: false },
//                 populate: { path: 'type', select: '-__v -distanceRate -typeFor -capacity' },
//                 select: 'name profile phone rating',
//             })
//             .select('-__v')
//             .sort('-_id')
//             .lean();

//         rides = rides.map(ride => {
//             if (ride.driver?.type)
//                 ride.type = multilingual(ride.driver?.type, req);
//             return ride;
//         });

//         res.json({ code: '1', message: req.t('success'), rides });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.getRides = async (req, res, next) => {
//     try {
//         let rides = await Ride.find({ user: req.user.id })
//             .populate('user', 'name phone')
//             .populate({
//                 path: 'driver',
//                 match: { isDeleted: false },
//                 select: 'name profile phone rating useFor', // 👈 IMPORTANT ADD
//             })
//             .select('-__v')
//             .sort('-_id')
//             .lean();

//         rides = await Promise.all(
//             rides.map(async (ride) => {

//                 const transaction = await Transaction.findOne({
//                     $or: [
//                         { rideId: ride._id },
//                         { rideId: ride._id.toString() },
//                         { referenceId: ride._id }
//                     ]
//                 })
//                     .sort({ createdAt: -1 })
//                     .lean();

//                 // ================= NEW LOGIC =================
//                 let rideMode = null;

//                 if (ride.driver?.useFor) {
//                     rideMode = ride.driver.useFor; // taxi / bike
//                 }

//                 // // Capitalize → Taxi / Bike
//                 // if (rideMode && typeof rideMode === 'string') {
//                 //     rideMode =
//                 //         rideMode.charAt(0).toUpperCase() +
//                 //         rideMode.slice(1).toLowerCase();
//                 // }
//                 // ================= END =================

//                 return {
//                     ...ride,

//                     // ✅ FINAL OUTPUT
//                     rideMode, // Taxi / Bike

//                     paymentMethod: transaction?.paymentMethod || null,
//                     paymentStatus: transaction?.status || null,
//                     amount: transaction?.amount || null,
//                     scheduledTime: ride.isSchedule ? ride.scheduleTime : null
//                 };
//             })
//         );

//         res.json({
//             code: '1',
//             message: req.t('success'),
//             rides
//         });

//     } catch (error) {
//         console.log('❌ getRides Error:', error);
//         next(error);
//     }
// };

// exports.getRides = async (req, res, next) => {
//     try {
//         let rides = await Ride.find({ user: req.user.id })
//             .populate('user', 'name phone')
//             .populate({
//                 path: 'driver',
//                 match: { isDeleted: false },
//                 select: 'name profile phone rating useFor',
//             })
//             .select('-__v')
//             .sort('-_id')
//             .lean();

//         rides = await Promise.all(
//             rides.map(async (ride) => {

//                 const transaction = await Transaction.findOne({
//                     $or: [
//                         { rideId: ride._id },
//                         { rideId: ride._id.toString() },
//                         { referenceId: ride._id }
//                     ]
//                 })
//                     .sort({ createdAt: -1 })
//                     .lean();

//                 // ================= VEHICLE IMAGE LOGIC =================
//                 let rideMode = null;
//                 let vehicleImage = null;

//                 if (ride.driver?.useFor) {
//                     rideMode = ride.driver.useFor.toLowerCase().trim();

//                     if (rideMode === 'taxi' || rideMode === 'car') {
//                         vehicleImage = "/img/taxi.png";
//                     }
//                     else if (rideMode === 'bike') {
//                         vehicleImage = "/img/bike.png";
//                     }
//                 }

//                 // ================= PAYMENT METHOD IMAGE LOGIC =================
//                 let paymentMethod = transaction?.paymentMethod || null;
//                 let paymentImage = null;

//                 if (paymentMethod) {
//                     const method = paymentMethod.toLowerCase().trim();

//                     if (method === 'cash') {
//                         paymentImage = "/img/cash.png";
//                     }
//                     else if (method === 'wallet') {
//                         paymentImage = "/img/wallet.png";
//                     }
//                     else if (method === 'stripe' || method === 'card' || method === 'online') {
//                         paymentImage = "/img/stripe.png";     // ya card.png
//                     }
//                 }

//                 return {
//                     ...ride,

//                     // ✅ Final Fields
//                     rideMode,           // taxi / bike
//                     vehicleImage,       // /img/taxi.png

//                     paymentMethod,      // cash / wallet / stripe
//                     paymentImage,       // /img/cash.png   ← Naya field
//                     paymentStatus: transaction?.status || null,
//                     amount: transaction?.amount || null,
//                     scheduledTime: ride.isSchedule ? ride.scheduleTime : null
//                 };
//             })
//         );

//         res.json({
//             code: '1',
//             message: req.t('success'),
//             rides
//         });

//     } catch (error) {
//         console.log('❌ getRides Error:', error);
//         next(error);
//     }
// };


exports.getRides = async (req, res, next) => {
    try {
        let rides = await Ride.find({ user: req.user.id })
            .populate('user', 'name phone')
            .populate({
                path: 'driver',
                match: { isDeleted: false },
                select: 'name profile phone rating useFor type',  // ✅ type add kiya
                populate: {
                    path: 'type',                                  // ✅ driver.type populate
                    select: 'en fr ar typeFor image'
                }
            })
            .select('-__v')
            .sort('-_id')
            .lean();

        rides = await Promise.all(
            rides.map(async (ride) => {

                const transaction = await Transaction.findOne({
                    $or: [
                        { rideId: ride._id },
                        { rideId: ride._id.toString() },
                        { referenceId: ride._id }
                    ]
                }).sort({ createdAt: -1 }).lean();

                // ================= VEHICLE TYPE from driver.type =================
                let vehicleType = null;
                let vehicleTypeImage = null;
                let rideMode = null;
                let vehicleImage = null;

                if (ride.driver?.type) {
                    const lang = req.language ||
                        req.headers['accept-language']?.slice(0, 2) ||
                        'en';

                    vehicleType = ride.driver.type[lang]?.name
                        || ride.driver.type.en?.name
                        || null;

                    vehicleTypeImage = ride.driver.type.image || null;

                    console.log(`Ride ${ride._id} | vehicleType: ${vehicleType}`);
                }

                // ================= RIDE MODE =================
                if (ride.driver?.useFor) {
                    rideMode = ride.driver.useFor.toLowerCase().trim();
                }

                // Fallback — driver.type.typeFor se
                if (!rideMode && ride.driver?.type?.typeFor) {
                    rideMode = ride.driver.type.typeFor.toLowerCase();
                }

                if (rideMode === 'taxi' || rideMode === 'car') {
                    vehicleImage = "/img/taxi.png";
                } else if (rideMode === 'bike') {
                    vehicleImage = "/img/bike.png";
                }

                // ================= PAYMENT METHOD IMAGE =================
                let paymentMethod = transaction?.paymentMethod || null;
                let paymentImage = null;

                if (paymentMethod) {
                    const method = paymentMethod.toLowerCase().trim();
                    if (method === 'cash') {
                        paymentImage = "/img/cash.png";
                    } else if (method === 'wallet') {
                        paymentImage = "/img/wallet.png";
                    } else if (['stripe', 'card', 'online'].includes(method)) {
                        paymentImage = "/img/stripe.png";
                    }
                }

                return {
                    ...ride,
                    rideMode,            // "taxi" / "bike"
                    vehicleType,         // "Economy" / "Family" / "Bike"
                    vehicleTypeImage,    // Type image URL
                    vehicleImage,        // "/img/taxi.png"
                    paymentMethod,
                    paymentImage,
                    paymentStatus: transaction?.status || null,
                    amount: transaction?.amount || null,
                    scheduledTime: ride.isSchedule ? ride.scheduleTime : null
                };
            })
        );

        res.json({
            code: '1',
            message: req.t('success'),
            rides
        });

    } catch (error) {
        console.log('❌ getRides Error:', error);
        next(error);
    }
};

exports.addRating = async (req, res, next) => {
    try {
        const { driverId, rating: newRating, comment } = req.body;

        let updatedRating = await Rating.findOne({ driver: driverId, user: req.user.id });

        if (updatedRating) {
            updatedRating.rating = newRating;
            updatedRating.comment = comment;
        } else {
            updatedRating = new Rating({ driver: driverId, user: req.user.id, rating: newRating, comment });
        }
        await updatedRating.save();

        Rating.aggregate([
            { $match: { driver: updatedRating.driver } },
            { $group: { _id: '$driver', averageRating: { $avg: '$rating' } } },
        ]).then(averageRatings => {
            const averageRating = averageRatings[0].averageRating.toFixed(1);
            Driver.findByIdAndUpdate(driverId, { rating: averageRating }).exec();
        });

        res.json({ code: '1', message: req.t('rating.added'), rating: updatedRating });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.BadRequest('Invalid driverId.'));
        next(error);
    }
};