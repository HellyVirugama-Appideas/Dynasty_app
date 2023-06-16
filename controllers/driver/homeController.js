const createError = require('http-errors');

const Driver = require('../../models/driverModel');
const RideReq = require('../../models/rideReqModel');
const Ride = require('../../models/rideModel');
const Notification = require('../../models/notificationModel');

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

exports.acceptRide = async (req, res, next) => {
    try {
        // Ride req to ride collection
        const rideReq = await RideReq.findById(req.body.id).lean();
        if (!rideReq) return next(createError.Conflict('ride.already'));

        const ride = new Ride({ ...rideReq, driver: req.driver.id });
        await Promise.all([
            ride.save(),
            ride.populate('user', 'name country_code phone'),
        ]);

        // Notify user

        res.json({ code: '1', message: req.t('success'), ride });
    } catch (error) {
        if (error.code == 11000 && error.keyPattern._id)
            return next(createError.Conflict('ride.already'));
        next(error);
    }
};

exports.getNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find({
            driver: req.driver.id,
        })
            .select('-__v -driver')
            .sort('-_id')
            .lean();

        res.json({ code: '1', message: req.t('success'), notifications });
    } catch (error) {
        next(error);
    }
};
