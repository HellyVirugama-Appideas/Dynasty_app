const createError = require('http-errors');

const Ride = require('../../models/rideModel');

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
