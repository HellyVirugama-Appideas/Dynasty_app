const geolib = require('geolib');
const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');

const Type = require('../../models/typeModel');
const Charges = require('../../models/chargesModel');
const RideReq = require('../../models/rideReqModel');

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

exports.bookRide = async (req, res, next) => {
    try {
        const ride = await RideReq.create({
            user: req.user.id,
            pickupLocation: {
                type: 'Point',
                coordinates: [req.body.pickupLng, req.body.pickupLat],
            },
            pickupAddress: req.body.pickupAddress,
            pickupLat: req.body.pickupLat,
            pickupLng: req.body.pickupLng,
            endAddress: req.body.endAddress,
            endLat: req.body.endLat,
            endLng: req.body.endLng,
            type: req.body.type,
        });

        res.json({ code: '1', message: req.t('ride.success'), ride });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.BadRequest('Invalid driverId.'));
        next(error);
    }
};
