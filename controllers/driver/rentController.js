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
