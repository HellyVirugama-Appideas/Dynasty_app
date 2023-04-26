const geolib = require('geolib');
const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');

const Type = require('../../models/typeModel');
const Charges = require('../../models/chargesModel');
const Ride = require('../../models/rideModel');

exports.getVehicleTypes = async (req, res, next) => {
    try {
        const { pickupLat, pickupLng, endLat, endLng } = req.body;
        if (!pickupLat || !pickupLng || !endLat || !endLng)
            return next(createError.BadRequest('Invalid coordinates.'));

        let [types, charges] = await Promise.all([
            Type.find({ typeFor: 'Taxi' }).select('-__v -typeFor'),
            Charges.findOne(),
        ]);
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

// ? update this later
exports.bookRide = async (req, res, next) => {
    try {
        const {
            type,
            pickupLat,
            pickupLng,
            endLat,
            endLng,
            pickupAddress,
            endAddress,
        } = req.body;

        if (
            !pickupLat ||
            !pickupLng ||
            !endLat ||
            !endLng ||
            !pickupAddress ||
            !endAddress
        )
            return next(createError.BadRequest('Invalid addresses.'));

        // TODO: find near by drivers with type and online, notify them

        const ride = await Ride.create({
            user: req.user.id,
            pickupAddress: req.body.pickupAddress,
            pickupLat: req.body.pickupLat,
            pickupLng: req.body.pickupLng,
            endAddress: req.body.endAddress,
            endLat: req.body.endLat,
            endLng: req.body.endLng,
        });

        res.json({ code: '1', message: req.t('ride.success'), ride });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.BadRequest('Invalid driverId.'));
        next(error);
    }
};
