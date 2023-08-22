const geolib = require('geolib');
const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');
const notifyDrivers = require('../../utils/notifyDrivers');

const Type = require('../../models/typeModel');
const Charges = require('../../models/chargesModel');
const RideReq = require('../../models/rideReqModel');
const Driver = require('../../models/driverModel');

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
        types.map(type => {
            const distanceCharge = (distance / 1000) * type.distanceRate;
            const price = (
                Math.max(
                    charges.baseFare + distanceCharge,
                    charges.minimumFare
                ) + charges.bookingFee
            ).toFixed(2); // ride price
            type.price = price;
            type.distanceRate = undefined;
        });

        res.json({ code: '1', message: req.t('success'), data: { types } });
    } catch (error) {
        next(error);
    }
};

exports.bookRide = async (req, res, next) => {
    try {
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
            return next(createError.BadRequest('No available drivers nearby.'));

        const ride = await RideReq.create({
            user: req.user.id,
            pickupAddress: req.body.pickupAddress,
            pickupLat: req.body.pickupLat,
            pickupLng: req.body.pickupLng,
            endAddress: req.body.endAddress,
            endLat: req.body.endLat,
            endLng: req.body.endLng,
            type: req.body.type,
        });

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
            const distance = geolib.getDistance(driverLocation, pickupLocation);

            return { id: driver.id, distance };
        });

        // Notify drivers
        notifyDrivers(drivers, ride);

        res.json({ code: '1', message: req.t('ride.success'), ride });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.BadRequest('Invalid driverId.'));
        next(error);
    }
};
