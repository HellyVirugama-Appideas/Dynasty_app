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
