const createError = require('http-errors');

const BookingReq = require('../../models/bookingReqModel');

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

exports.rejectRequest = async (req, res, next) => {
    try {
        const request = await BookingReq.findByIdAndDelete(req.params.id);

        if (!request)
            return next(createError.BadRequest('Invalid request id.'));

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        if (error.name === 'CastError')
            return next(createError.BadRequest('Invalid request id.'));
        next(error);
    }
};
