const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');
const sendNotification = require('../../utils/sendNotification');
const generateCode = require('../../utils/generateCode');

const Ride = require('../../models/rideModel');
const RideReq = require('../../models/rideReqModel');
const Driver = require('../../models/driverModel');
const User = require('../../models/userModel');

exports.getRides = async (req, res, next) => {
    try {
        const rides = await Ride.find({ driver: req.driver.id })
            .populate('user', 'name profile phone')
            .select('-driver -__v -otp')
            .sort('-_id');

        res.json({ code: '1', message: req.t('success'), rides });
    } catch (error) {
        next(error);
    }
};

exports.verifyRideOTP = async (req, res, next) => {
    try {
        const ride = await Ride.findById(req.body.rideId)
            .populate('user', 'name profile phone')
            .select('-driver -__v')
            .sort('-_id');

        if (Number(req.body.otp) !== ride.otp)
            return next(createError.BadRequest('Invalid OTP.'));

        // Update ride status
        ride.rideStatus = 'wayToDone';
        await ride.save();

        // Notify user
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

        if (response === 'accept') {
            // if (ride.acceptedBy) {
            //     // Ride has already been accepted by another driver
            //     return res.json({
            //         code: '0',
            //         message: req.t('ride.already'),
            //     });
            // }
            // ride.acceptedBy = driverId;
            // await ride.save();

            // await Driver.findByIdAndUpdate(driver.id, {
            //     isHandlingRequest: true,
            // });

            let rideResponse = await Ride.create({
                ...ride._doc,
                driver: driverId,
                time,
                distance,
                otp: generateCode(6),
                status: isSchedule ? 'Upcoming' : 'Ongoing',
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

            rideResponse = rideResponse._doc;
            rideResponse.type = multilingual(rideResponse.driver.type, req);
            rideResponse.driver.type = undefined;
            rideResponse.__v = undefined;

            const user = await User.findById(userId);

            const notificationData = {
                code: '1',
                title: 'Ride Accepted',
                // body: req.t(isSchedule ? 'ride.schedule' : 'ride.success'),
                body: 'Your ride has been successfully booked.',
                ride: rideResponse,
            };
            await sendNotification(user.fcmToken, notificationData);

            return res.json({
                code: '1',
                distance: distance,
                time: time,
            });
        } else if (response === 'reject') {
            const notificationData = {
                code: '0',
                message: req.t('ride.fail'),
            };
            await sendNotification(userId.fcmToken, notificationData);

            return res.json({ code: '0', message: req.t('ride.rejected') });
        } else {
            return res.json({ code: '0', message: 'Invalid response.' });
        }
    } catch (error) {
        next(error);
    }
};
