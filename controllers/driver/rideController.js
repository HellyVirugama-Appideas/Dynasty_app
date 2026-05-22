const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');
const { sendRideNotification } = require('../../utils/sendNotification');
const generateCode = require('../../utils/generateCode');

const Ride = require('../../models/rideModel');
const RideReq = require('../../models/rideReqModel');
const Driver = require('../../models/driverModel');
const User = require('../../models/userModel');
const Transaction = require("../../models/transaction")

// exports.getRides = async (req, res, next) => {
//     try {
//         const rides = await Ride.find({ driver: req.driver.id })
//             .populate('user', 'name profile phone')
//             .select('-driver -__v -otp')
//             .sort('-_id');

//         res.json({ code: '1', message: req.t('success'), rides });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.getRides = async (req, res, next) => {
//     try {
//         const rides = await Ride.find({ driver: req.driver.id })
//             .populate('user', 'name profile phone')
//             .select('-driver -__v -otp')
//             .sort('-_id');

//         const updatedRides = await Promise.all(
//             rides.map(async (ride) => {

//                 const transaction = await Transaction.findOne({
//                     rideId: ride._id
//                 }).sort({ createdAt: -1 });

//                 return {
//                     ...ride.toObject(),
//                     paymentMethod: transaction?.source || transaction?.paymentMethod || transaction?.method || null,
//                     paymentStatus: transaction?.status || null,
//                     amount: transaction?.amount || null
//                 };
//             })
//         );

//         res.json({
//             code: '1',
//             message: req.t('success'),
//             rides: updatedRides
//         });

//     } catch (error) {
//         next(error);
//     }
// };

// exports.getRides = async (req, res, next) => {
//     try {
//         const rides = await Ride.find({ driver: req.driver.id })
//             .populate('user', 'name profile phone')
//             .select('-driver -__v -otp')
//             .sort('-_id');

//         const updatedRides = rides.map((ride) => {
//             return {
//                 ...ride.toObject(),

//                 // 🔥 DIRECT DB FIELD (NO CONDITION)
//                 scheduledTime: ride.scheduleTime
//             };
//         });

//         res.json({
//             code: '1',
//             message: req.t('success'),
//             rides: updatedRides
//         });

//     } catch (error) {
//         next(error);
//     }
// };

exports.getRides = async (req, res, next) => {
    try {
        const rides = await Ride.find({ driver: req.driver.id })
            .populate('user', 'name profile phone')
            .select('-driver -__v -otp')
            .sort('-_id');

        const updatedRides = await Promise.all(
            rides.map(async (ride) => {

                const transaction = await Transaction.findOne({
                    rideId: ride._id
                }).sort({ createdAt: -1 });

                return {
                    ...ride.toObject(),

                    driverId: req.driver.id,

                    // ✅ payment
                    paymentMethod: transaction?.source || transaction?.paymentMethod || transaction?.method || null,
                    paymentStatus: transaction?.status || null,
                    amount: transaction?.amount || null,

                    // 🔥 ONLY upcoming rides ke liye
                    scheduledTime: ride.status?.toLowerCase() === "upcoming"
                        ? ride.scheduleTime
                        : null
                };
            })
        );

        res.json({
            code: '1',
            message: req.t('success'),
            rides: updatedRides
        });

    } catch (error) {
        next(error);
    }
};

exports.verifyRideOTP = async (req, res, next) => {
    try {
        const ride = await Ride.findById(req.body.rideId)
            .populate('user', 'name profile phone fcmToken')
            .select('-driver -__v')
            .sort('-_id');

        if (Number(req.body.otp) !== ride.otp)
            return next(createError.BadRequest('Invalid OTP.'));

        // Update ride status
        ride.rideStatus = 'start';
        await ride.save();

        // Notify user
        const notificationData = {
            code: '1',
            title: 'Ride Status',
            body: 'Your ride is on the way.',
            rideId: ride._id.toString(),
            rideStatus: ride.rideStatus,
        };

        await sendRideNotification(ride.user?.fcmToken, notificationData);

        io.to(ride.user.id).emit('rideStatusNotify', {
            rideId: ride.id,
            rideStatus: ride.rideStatus,
        });

        res.json({ code: '1', message: req.t('success'), ride });
    } catch (error) {
        next(error);
    }
};

exports.driverResponse = async (req, res, next) => {
    try {
        const { driverId, rideId, response, time, distance, userId } = req.body;
        const isSchedule = req.body.isSchedule === 'true';

        if (!driverId || !rideId || !response)
            return next(createError.BadRequest('Invalid request data.'));

        const driver = await Driver.findById(driverId);
        if (!driver) return next(createError.BadRequest('Driver not found.'));

        const ride = await RideReq.findById(rideId);
        if (!ride) return next(createError.BadRequest('Ride not found.'));

        const isScheduledRide = isSchedule || !!ride.scheduleTime || !!ride.scheduledDate || !!ride.isSchedule;

        // if (response === 'accept') {
        //     // if (ride.acceptedBy) {
        //     //     // Ride has already been accepted by another driver
        //     //     return res.json({
        //     //         code: '0',
        //     //         message: req.t('ride.already'),
        //     //     });
        //     // }
        //     // ride.acceptedBy = driverId;
        //     // await ride.save();

        //     // await Driver.findByIdAndUpdate(driver.id, {
        //     //     isHandlingRequest: true,
        //     // });

        //     let rideResponse = await Ride.create({
        //         ...ride._doc,
        //         driver: driverId,
        //         time,
        //         distance,
        //         otp: generateCode(6),
        //         // status: isSchedule ? 'Upcoming' : 'Ongoing',
        //         status: 'Upcoming',
        //         rideStatus: 'start',
        //     });

        //     if (!isSchedule)
        //         await Driver.findByIdAndUpdate(driverId, { status: 'busy' });

        //     await rideResponse.populate({
        //         path: 'driver',
        //         populate: {
        //             path: 'type',
        //             select: '-__v -distanceRate -typeFor -capacity',
        //         },
        //         select: 'name profile phone',
        //     });
        //     await rideResponse.populate({
        //         path: 'user',
        //         select: 'name phone',
        //     });

        //     rideResponse = rideResponse._doc;
        //     rideResponse.type = multilingual(rideResponse.driver.type, req);
        //     rideResponse.driver.type = undefined;
        //     rideResponse.__v = undefined;

        //     const user = await User.findById(userId);

        //     const notificationData = {
        //         code: '1',
        //         message: req.t('success'),
        //         title: 'Ride Accepted',
        //         // body: req.t(isSchedule ? 'ride.schedule' : 'ride.success'),
        //         body: 'Your ride has been successfully booked.',
        //         ride: rideResponse,
        //     };
        //     await sendRideNotification(user.fcmToken, notificationData);

        //     return res.json({
        //         code: '1',
        //         message: req.t('success'),
        //         distance: distance,
        //         time: time,
        //     });
        // } 
        if (response === 'accept') {

            let rideResponse = await Ride.create({
                ...ride._doc,
                driver: driverId,                    // ← Yeh line sahi hai
                time,
                distance,
                otp: generateCode(6),
                status: 'Upcoming',                  // ← Aap chahte the Upcoming
                rideStatus: 'start',                 // ← Yeh zaroori hai
                isSchedule: isScheduledRide,
            });

            if (!isSchedule)
                await Driver.findByIdAndUpdate(driverId, { status: 'busy' });

            await rideResponse.populate({
                path: 'driver',
                populate: {
                    path: 'type',
                    select: '-__v -distanceRate -typeFor -capacity',
                },
                select: 'name profile phone',
            });

            await rideResponse.populate({
                path: 'user',
                select: 'name phone',
            });

            rideResponse = rideResponse._doc;
            rideResponse.type = multilingual(rideResponse.driver.type, req);
            rideResponse.driver.type = undefined;
            rideResponse.__v = undefined;

            const user = await User.findById(userId);

            const notificationData = {
                code: '1',
                message: req.t('success'),
                title: 'Ride Accepted',
                body: 'Your ride has been successfully booked.',
                ride: rideResponse,
            };
            await sendRideNotification(user.fcmToken, notificationData);



            return res.json({
                code: '1',
                message: req.t('success'),
                distance: distance,
                time: time,
            });
        }

        // else if (response === 'reject') {
        //     const notificationData = {
        //         code: '0',
        //         title: 'Ride Fail',
        //         body: req.t('ride.fail'),
        //     };
        //     await sendRideNotification(userId.fcmToken, notificationData);

        //     return res.json({ code: '0', message: req.t('ride.rejected') });
        // } 

        else if (response === 'reject') {

            const user = await User.findById(userId);

            if (!user || !user.fcmToken) {
                return res.json({
                    code: '0',
                    message: 'User or FCM token not found'
                });
            }

            const notificationData = {
                code: '0',
                title: 'Ride Rejected',
                body: req.t('ride.fail'),
            };

            await sendRideNotification(user.fcmToken, notificationData); // ✅ FIX

            return res.json({ code: '0', message: req.t('ride.rejected') });
        }


        else {
            return res.json({ code: '0', message: 'Invalid response.' });
        }
    } catch (error) {
        next(error);
    }
};

// ==================== START JOURNEY ====================
exports.startJourney = async (req, res, next) => {
    try {
        const { rideId } = req.body;

        // Get driverId safely
        let driverId = req.driver?._id || req.driver?.id;

        if (!driverId && req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                driverId = decoded._id;
            } catch (e) {
                console.log('Token decode failed');
            }
        }

        console.log('========== START JOURNEY API CALLED ==========');
        console.log('Ride ID:', rideId);
        console.log('Driver ID found:', driverId);

        if (!rideId) {
            return next(createError.BadRequest('rideId is required'));
        }

        if (!driverId) {
            return next(createError.Unauthorized('Driver authentication failed. Please login again.'));
        }

        // Find the ride with populated driver
        const ride = await Ride.findById(rideId)
            .populate('user', 'name phone fcmToken')
            // .populate('driver', 'name _id');   // _id bhi populate kar rahe hain
            .populate('driver', 'name _id profile rating');

        if (!ride) {
            console.log('❌ Ride not found');
            return next(createError.NotFound('Ride not found'));
        }

        // ✅ Fixed Comparison: Both sides ko string mein convert kar rahe hain
        const rideDriverId = ride.driver?._id ? ride.driver._id.toString() : ride.driver?.toString();

        console.log('Ride.driver ID (string):', rideDriverId);
        console.log('Request driverId (string):', driverId.toString());

        let etaText = "Arriving soon";

        if (ride.driver?.location && ride.pickupLocation?.coordinates) {

            const [driverLng, driverLat] = ride.driver.location.coordinates;
            const [pickupLng, pickupLat] = ride.pickupLocation.coordinates;

            const distanceKm = getDistanceInKm(driverLat, driverLng, pickupLat, pickupLng);

            // Assume avg speed = 30 km/h (city traffic)
            const timeMinutes = Math.ceil((distanceKm / 30) * 60);

            if (timeMinutes <= 1) {
                etaText = "1 minute away";
            } else {
                etaText = `${timeMinutes} minutes away`;
            }
        }

        const driverData = {
            driverId: ride.driver?._id,
            driverName: ride.driver?.name || '',

            // ✅ direct DB value (NO base URL)
            imageUrl: ride.driver?.profile || '',

            rating: ride.driver?.rating || 0,

            time: etaText   // 🔥 dynamic
        };

        if (rideDriverId !== driverId.toString()) {
            console.log('❌ Unauthorized: Driver is not assigned to this ride');
            return next(createError.Forbidden('You are not authorized for this ride'));
        }

        // Check current status
        if (!['start', 'Upcoming'].includes(ride.rideStatus)) {
            console.log('⚠️ Ride cannot be started from current status:', ride.rideStatus);
            return next(createError.BadRequest('Ride cannot be started at this stage. Current status: ' + ride.rideStatus));
        }

        console.log('✅ Starting journey...');

        // Update ride status
        ride.rideStatus = 'wayToPickup';
        ride.status = 'Ongoing';
        await ride.save();

        console.log('✅ Ride status updated to wayToPickup');

        // Notification for User
        const notificationData = {
            code: '1',
            title: 'Journey Started',
            body: 'Your journey has started. Driver is on the way to pickup.',
            rideId: ride._id.toString(),
            rideStatus: 'wayToPickup'
        };

        if (ride.user?.fcmToken) {
            await sendRideNotification(ride.user.fcmToken, notificationData);
            console.log('✅ FCM notification sent to user');
        }

        if (global.io) {
            global.io.to(ride.user._id.toString()).emit('rideStatusNotify', {
                rideId: ride._id.toString(),
                rideStatus: 'wayToPickup',
                message: 'Your journey has started',
                driver: driverData
            });
            console.log('✅ Socket notification sent to user');
        }

        if (global.io) {
            global.io.to(driverId.toString()).emit('journeyStarted', {
                rideId: ride._id.toString(),
                message: 'Journey started successfully'
            });
        }

        console.log('========== JOURNEY STARTED SUCCESSFULLY ==========\n');

        return res.json({
            code: '1',
            message: 'Journey started successfully',
            rideId: ride._id.toString(),
            rideStatus: 'wayToPickup',
            driver: driverData
        });

    } catch (error) {
        console.error('❌ startJourney Error:', error);
        next(error);
    }
};


// ==================== COMPLETE RIDE API ====================
// exports.completeRide = async (req, res, next) => {
//     try {
//         const { rideId } = req.body;
//         const driverId = req.driver.id;   // assuming req.driver from auth middleware

//         console.log('========== COMPLETE RIDE API CALLED ==========');
//         console.log('Ride ID:', rideId);
//         console.log('Driver ID:', driverId);

//         if (!rideId) {
//             return next(createError.BadRequest('rideId is required'));
//         }

//         // 1. Find the ride
//         const ride = await Ride.findById(rideId)
//             .populate('user', 'name phone fcmToken')
//             .populate({
//                 path: 'driver',
//                 select: 'name phone'
//             });

//         if (!ride) {
//             console.log('❌ Ride not found');
//             return next(createError.NotFound('Ride not found'));
//         }

//         // 2. Check if this driver is assigned to this ride
//         if (ride.driver._id.toString() !== driverId.toString()) {
//             console.log('❌ Unauthorized: Driver is not assigned to this ride');
//             return next(createError.Forbidden('You are not authorized to complete this ride'));
//         }

//         // 3. Check current status
//         if (ride.status === 'Completed') {
//             console.log('⚠️ Ride is already completed');
//             return res.json({
//                 code: '0',
//                 message: 'Ride is already completed'
//             });
//         }

//         // if (!['Ongoing', 'wayToDone'].includes(ride.rideStatus)) {
//         if (!['Ongoing', 'wayToPickup', 'tripStarted', 'start'].includes(ride.rideStatus)) {
//             console.log('⚠️ Ride cannot be completed in current state');
//             return next(createError.BadRequest('Ride cannot be completed at this stage'));
//         }

//         console.log('✅ Ride validation passed. Completing ride...');

//         // 4. Update Ride
//         ride.status = 'Completed';
//         ride.rideStatus = 'wayToDone';
//         ride.completedAt = new Date();   // optional field (agar schema mein nahi hai to add kar sakte ho)

//         await ride.save();

//         console.log('✅ Ride status updated to Completed');

//         // 5. Change Driver Status to Online
//         await Driver.findByIdAndUpdate(driverId, {
//             status: 'online'
//         });

//         console.log('✅ Driver status changed to online');

//         // 6. Prepare Notification Data for User
//         const notificationData = {
//             code: '1',
//             title: 'Ride Completed',
//             body: 'Your ride has been successfully completed. Thank you for riding with us!',
//             rideId: ride._id.toString(),
//             rideStatus: 'Completed',
//             status: 'wayToDone'
//         };

//         // 7. Send Notification via FCM
//         if (ride.user?.fcmToken) {
//             await sendRideNotification(ride.user.fcmToken, notificationData);
//             console.log('✅ FCM notification sent to user');
//         } else {
//             console.warn('⚠️ User FCM token not found');
//         }

//         // 8. Send Real-time Socket Notification to User
//         if (global.io) {
//             global.io.to(ride.user._id.toString()).emit('rideCompleted', {
//                 rideId: ride._id.toString(),
//                 status: 'Completed',
//                 rideStatus: 'wayToDone',
//                 message: 'Ride has been completed successfully'
//             });
//             console.log('✅ Socket event rideCompleted sent to user');
//         }

//         // 9. Send Socket to Driver (confirmation)
//         if (global.io) {
//             global.io.to(driverId.toString()).emit('rideCompleteSuccess', {
//                 rideId: ride._id.toString(),
//                 message: 'Ride completed successfully'
//             });
//         }

//         console.log('========== RIDE COMPLETED SUCCESSFULLY ==========\n');

//         return res.json({
//             code: '1',
//             message: 'Ride completed successfully',
//             rideId: ride._id.toString()
//         });

//     } catch (error) {
//         console.error('❌ completeRide Error:', error);
//         next(error);
//     }
// };

// ==================== COMPLETE RIDE API ====================
exports.completeRide = async (req, res, next) => {
    try {
        const { rideId } = req.body;
        const driverId = req.driver.id;

        console.log('========== COMPLETE RIDE API CALLED ==========');
        console.log('Ride ID:', rideId);
        console.log('Driver ID:', driverId);

        if (!rideId) {
            return next(createError.BadRequest('rideId is required'));
        }

        // 1. Find the ride
        const ride = await Ride.findById(rideId)
            .populate('user', 'name phone fcmToken')
            .populate({
                path: 'driver',
                select: 'name phone'
            });

        if (!ride) {
            console.log('❌ Ride not found');
            return next(createError.NotFound('Ride not found'));
        }

        // 2. Check if this driver is assigned to this ride
        if (ride.driver._id.toString() !== driverId.toString()) {
            console.log('❌ Unauthorized: Driver is not assigned to this ride');
            return next(createError.Forbidden('You are not authorized to complete this ride'));
        }

        // 3. Check current status
        if (ride.status === 'Completed') {
            console.log('⚠️ Ride is already completed');
            return res.json({
                code: '0',
                message: 'Ride is already completed'
            });
        }

        if (!['Ongoing', 'wayToPickup', 'tripStarted', 'start'].includes(ride.rideStatus)) {
            console.log('⚠️ Ride cannot be completed in current state:', ride.rideStatus);
            return next(createError.BadRequest('Ride cannot be completed at this stage'));
        }

        console.log('✅ Ride validation passed. Completing ride...');

        // 4. Update Ride
        ride.status = 'Completed';
        ride.rideStatus = 'wayToDone';
        ride.completedAt = new Date();

        await ride.save();

        console.log('✅ Ride status updated to Completed');

        // 5. Change Driver Status to Online
        await Driver.findByIdAndUpdate(driverId, {
            status: 'online'
        });

        console.log('✅ Driver status changed to online');

        // 6. Prepare Notification Data for User (with price)
        const notificationData = {
            code: '1',
            title: 'Ride Completed',
            body: `Your ride has been completed. Total fare: ₹${ride.price}. Thank you for riding with us!`,
            rideId: ride._id.toString(),
            rideStatus: 'wayToDone',
            status: 'Completed',
            price: ride.price
        };

        // 7. Send Notification via FCM
        if (ride.user?.fcmToken) {
            await sendRideNotification(ride.user.fcmToken, notificationData);
            console.log('✅ FCM notification sent to user');
        } else {
            console.warn('⚠️ User FCM token not found');
        }

        // 8. Send Real-time Socket Notification to User (with price)
        if (global.io) {
            global.io.to(ride.user._id.toString()).emit('rideCompleted', {
                rideId: ride._id.toString(),
                status: 'Completed',
                rideStatus: 'wayToDone',
                message: 'Ride has been completed successfully',
                price: ride.price,
                fare: `₹${ride.price}`
            });
            console.log('✅ Socket event rideCompleted sent to user');
        }

        // 9. Send Socket to Driver (confirmation with price)
        if (global.io) {
            global.io.to(driverId.toString()).emit('rideCompleteSuccess', {
                rideId: ride._id.toString(),
                message: 'Ride completed successfully',
                price: ride.price,
                fare: `₹${ride.price}`
            });
        }

        console.log('========== RIDE COMPLETED SUCCESSFULLY ==========\n');

        // 10. Return response with fare details
        return res.json({
            code: '1',
            message: 'Ride completed successfully',
            rideId: ride._id.toString(),
            fare: {
                price: ride.price,
                currency: '₹',
                message: `Total fare for this ride is ₹${ride.price}`
            }
        });

    } catch (error) {
        console.error('❌ completeRide Error:', error);
        next(error);
    }
};