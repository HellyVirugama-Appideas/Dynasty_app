const createError = require('http-errors');

const BookingReq = require('../../models/bookingReqModel');
const Notification = require('../../models/notificationModel');

exports.getRequests = async (req, res, next) => {
    try {
        const bookings = await BookingReq.find({
            driver: req.driver.id,
            status: 'requested',
        }).populate('user', 'name');

        res.json({
            code: '1',
            message: req.t('success'),
            bookings,
        });
    } catch (error) {
        next(error);
    }
};

exports.acceptRequest = async (req, res, next) => {
    try {
        const request = await BookingReq.findByIdAndUpdate(
            req.params.id,
            { status: 'accepted' },
            { new: true }
        );

        if (!request)
            return next(createError.BadRequest('Invalid request id.'));

        // Notify user

        Notification.create({
            user: request.user,
            message: 'Booking request accepted.',
        }).catch(error => {
            console.log('Error creating notification: ', error);
        });

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        if (error.name === 'CastError')
            return next(createError.BadRequest('Invalid request id.'));
        next(error);
    }
};

exports.rejectRequest = async (req, res, next) => {
    try {
        const request = await BookingReq.findByIdAndDelete(req.params.id);

        if (!request)
            return next(createError.BadRequest('Invalid request id.'));

        // Notify user

        Notification.create({
            user: request.user,
            message: 'Booking request rejected.',
        }).catch(error => {
            console.log('Error creating notification: ', error);
        });

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        if (error.name === 'CastError')
            return next(createError.BadRequest('Invalid request id.'));
        next(error);
    }
};
