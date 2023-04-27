const createError = require('http-errors');

const Driver = require('../../models/driverModel');
const RideReq = require('../../models/rideReqModel');

exports.getStatus = (req, res, next) => {
    try {
        const status = req.driver.status;
        res.json({ code: '1', message: req.t('success'), status });
    } catch (error) {
        next(error);
    }
};

exports.setStatus = async (req, res, next) => {
    try {
        const status = req.body.status;
        if (status !== 'online' && status !== 'offline')
            return next(createError.BadRequest('Invalid status.'));

        const driver = await Driver.findByIdAndUpdate(
            req.driver.id,
            { status },
            { new: true, runValidators: true }
        );

        res.json({
            code: '1',
            message: req.t('success'),
            status: driver.status,
        });
    } catch (error) {
        next(error);
    }
};

exports.setLocation = async (req, res, next) => {
    try {
        const { latitude, longitude } = req.body;
        if (!latitude || !longitude)
            return next(createError.BadRequest('Invalid latitude longitude.'));

        await Driver.findByIdAndUpdate(
            req.driver.id,
            { location: { type: 'Point', coordinates: [longitude, latitude] } },
            { new: true }
        );

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        next(error);
    }
};

exports.getRides = async (req, res, next) => {
    try {
        // Get near by rides requests
        let rides = await RideReq.find({
            type: req.driver.type,
            pickupLocation: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: req.driver.location.coordinates,
                    },
                    $maxDistance: 10000, // distance in meters
                },
            },
        }).select('-__v -user -pickupLocation -type -createdAt');

        res.json({ code: '1', message: req.t('success'), rides });
    } catch (error) {
        next(error);
    }
};
