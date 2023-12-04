const geolib = require('geolib');
const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');
const notifyDrivers = require('../../utils/notifyDrivers');
const generateCode = require('../../utils/generateCode');

const Type = require('../../models/typeModel');
const Charges = require('../../models/chargesModel');
const RideReq = require('../../models/rideReqModel');
const Ride = require('../../models/rideModel');
const Driver = require('../../models/driverModel');
const Rating = require('../../models/driverRatingModel');

exports.getVehicleTypes = async (req, res, next) => {
    try {
        const { pickupLat, pickupLng, endLat, endLng } = req.body;
        if (!pickupLat || !pickupLng || !endLat || !endLng)
            return next(createError.BadRequest('Invalid coordinates.'));

        // Find nearby drivers
        const nearbyDrivers = await Driver.find({
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [pickupLng, pickupLat],
                    },
                    $maxDistance: process.env.radiusInMeters,
                },
            },
            status: 'online',
        });

        let [types, charges] = await Promise.all([
            Type.find({ typeFor: 'Taxi' }).select('-__v -typeFor'),
            Charges.findOne(),
        ]);

        types = types.filter(type =>
            nearbyDrivers.some(driver => driver.type.toString() === type.id)
        );
        types = types.map(type => multilingual(type, req));

        // calculate ride distance
        const distance = geolib.getDistance(
            { latitude: pickupLat, longitude: pickupLng },
            { latitude: endLat, longitude: endLng }
        );

        // calculate estimated price
        types.forEach(type => {
            const distanceCharge = (distance / 1000) * type.distanceRate;
            const price = (
                Math.max(
                    charges.baseFare + distanceCharge,
                    charges.minimumFare
                ) + charges.bookingFee
            ).toFixed(2); // ride price
            type.price = price;
            type.distanceRate = undefined;

            // Calculate average time for drivers of this type to reach user
            const driversOfType = nearbyDrivers.filter(
                driver => driver.type.toString() === type._id.toString()
            );
            const averageTimeMinutes =
                driversOfType.reduce((totalTime, driver) => {
                    const driverDistanceKm =
                        geolib.getDistance(
                            {
                                latitude: driver.location.coordinates[1],
                                longitude: driver.location.coordinates[0],
                            },
                            { latitude: pickupLat, longitude: pickupLng }
                        ) / 1000;
                    const timeForDriver = (driverDistanceKm / 30) * 60; // Est. speed 30 km/h
                    return totalTime + timeForDriver;
                }, 0) / driversOfType.length;
            type.time = Math.ceil(averageTimeMinutes);
        });

        res.json({ code: '1', message: req.t('success'), data: { types } });
    } catch (error) {
        next(error);
    }
};

exports.bookRide = async (req, res, next) => {
    try {
        const isScheduled =
            req.body.scheduleTime !== undefined &&
            !isNaN(Date.parse(req.body.scheduleTime));

        const nearbyDrivers = await Driver.find({
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [req.body.pickupLng, req.body.pickupLat],
                    },
                    $maxDistance: process.env.radiusInMeters,
                },
            },
            type: req.body.type,
            status: 'online',
        }).limit(5); // Limit to 5 closest drivers

        if (nearbyDrivers.length === 0)
            return next(createError.BadRequest('ride.fail'));

        const ride = await RideReq.create({
            user: req.user.id,
            pickupAddress: req.body.pickupAddress,
            pickupLat: req.body.pickupLat,
            pickupLng: req.body.pickupLng,
            endAddress: req.body.endAddress,
            endLat: req.body.endLat,
            endLng: req.body.endLng,
            type: req.body.type,
            scheduleTime: isScheduled ? req.body.scheduleTime : undefined,
        });
        await ride.populate('user', 'name phone');

        // Calculate distance for each driver
        const drivers = nearbyDrivers.map(driver => {
            const driverLocation = {
                latitude: driver.location.coordinates[1],
                longitude: driver.location.coordinates[0],
            };
            const pickupLocation = {
                latitude: ride.pickupLat,
                longitude: ride.pickupLng,
            };

            // Calculate distance
            const distanceInMeters = geolib.getDistance(
                driverLocation,
                pickupLocation
            );
            const distanceInKm = (distanceInMeters / 1000).toFixed(1);

            const timeInMinutes = (distanceInKm / 30) * 60; // Est. speed 30 km/h
            const time =
                timeInMinutes < 1
                    ? 'less than a minute away'
                    : `${Math.round(timeInMinutes)} minutes away`;

            const distance =
                distanceInMeters < 100
                    ? `${distanceInMeters} meter away`
                    : `${distanceInKm} km away`;

            return { id: driver.id, distance, time };
        });

        // Notify drivers
        const { driverId, time, distance } = await notifyDrivers(drivers, ride);

        // If no one accepted
        if (driverId === null)
            return res.json({ code: '0', message: req.t('ride.fail') });

        // Create ride
        let rideResponse = await Ride.create({
            ...ride._doc,
            driver: driverId,
            time,
            distance,
            otp: generateCode(6),
            status: isScheduled ? 'Upcoming' : 'Ongoing',
        });

        if (!isScheduled)
            await Driver.findByIdAndUpdate(driverId, { status: 'busy' });

        // Populate driver with type
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

        res.json({
            code: '1',
            message: req.t(isScheduled ? 'ride.schedule' : 'ride.success'),
            ride: rideResponse,
        });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.BadRequest('Invalid type id.'));
        next(error);
    }
};

exports.cancelRide = async (req, res, next) => {
    try {
        const ride = await Ride.findById(req.body.rideId);

        if (!ride || ['Completed', 'Cancelled'].includes(ride.status))
            return next(createError.NotFound('Ride not found with given id.'));

        ride.status = 'Cancelled';
        ride.cancellationReason = req.body.cancellationReason;

        // Save ride and Update driver status to online
        await Promise.all([
            ride.save(),
            Driver.findByIdAndUpdate(ride.driver, { status: 'online' }),
        ]);

        // Notify driver
        io.to(ride.driver.toString()).emit('cancelRide', { ride });

        res.json({ code: '1', message: req.t('ride.cancel') });
    } catch (error) {
        next(error);
    }
};

exports.getRides = async (req, res, next) => {
    try {
        const rides = await Ride.find({ user: req.user.id })
            .populate('driver', 'name profile phone')
            .select('-user -__v -otp')
            .sort('-_id');

        res.json({ code: '1', message: req.t('success'), rides });
    } catch (error) {
        next(error);
    }
};

exports.addRating = async (req, res, next) => {
    try {
        const { driverId, rating: newRating, comment } = req.body;

        let updatedRating = await Rating.findOne({
            driver: driverId,
            user: req.user.id,
        });

        if (updatedRating) {
            updatedRating.rating = newRating;
            updatedRating.comment = comment;
        } else {
            updatedRating = new Rating({
                driver: driverId,
                user: req.user.id,
                rating: newRating,
                comment,
            });
        }
        await updatedRating.save();

        Rating.aggregate([
            { $match: { driver: updatedRating.driver } },
            { $group: { _id: '$driver', averageRating: { $avg: '$rating' } } },
        ]).then(averageRatings => {
            const averageRating = averageRatings[0].averageRating.toFixed(1);
            Driver.findByIdAndUpdate(driverId, {
                rating: averageRating,
            }).exec();
        });

        res.json({
            code: '1',
            message: req.t('rating.added'),
            rating: updatedRating,
        });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.BadRequest('Invalid driverId.'));
        next(error);
    }
};
