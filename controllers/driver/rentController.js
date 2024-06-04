const createError = require('http-errors');
const { sendNotification } = require('../../utils/sendNotification');

const Booking = require('../../models/bookingModel');
const BookingReq = require('../../models/bookingReqModel');

exports.getRequests = async (req, res, next) => {
    try {
        const bookings = await BookingReq.find({
            driver: req.driver.id,
            status: 'requested',
        })
            .populate('user', 'name email country_code phone profile')
            .populate('car', 'pics name')
            .sort('-_id')
            .lean();

        // Extracting the first image from the 'pics' array
        bookings.forEach(booking => {
            if (booking.car.pics) booking.car.pic = booking.car.pics[0];
            delete booking.car.pics;
        });

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
        ).populate('user', 'fcmToken');

        if (!request)
            return next(createError.BadRequest('Invalid request id.'));

        // Notify user
        const data = {
            user: request.user.id,
            car: request.car,
            requestId: request.id,
            title: 'Booking Request Accepted',
            body: 'Your booking request has been accepted. Please proceed with the payment to confirm the booking.',
            paymentRequired: true,
        };
        sendNotification(request.user.fcmToken, data);

        res.json({ code: '1', message: req.t('rent.accepted') });
    } catch (error) {
        if (error.name === 'CastError')
            return next(createError.BadRequest('Invalid request id.'));
        next(error);
    }
};

exports.rejectRequest = async (req, res, next) => {
    try {
        const request = await BookingReq.findByIdAndUpdate(
            req.params.id,
            { status: 'rejected' },
            { new: true }
        ).populate('user', 'fcmToken');

        if (!request)
            return next(createError.BadRequest('Invalid request id.'));

        // Notify user
        const data = {
            user: request.user.id,
            car: request.car,
            requestId: request.id,
            title: 'Booking Request Rejected',
            body: 'Unfortunately, your booking request has been rejected. You can find another available car and make a new booking request.',
        };
        sendNotification(request.user.fcmToken, data);

        res.json({ code: '1', message: req.t('rent.rejected') });
    } catch (error) {
        if (error.name === 'CastError')
            return next(createError.BadRequest('Invalid request id.'));
        next(error);
    }
};

exports.getBookings = async (req, res, next) => {
    try {
        const currentDate = new Date();
        const queryOptions = {
            status: 'accepted',
            driver: req.driver.id,
            bookedTo:
                req.params.type === 'current'
                    ? { $gte: currentDate }
                    : { $lt: currentDate },
        };

        const bookings = await Booking.find(queryOptions)
            .populate('user', 'profile name email country_code phone')
            .populate('car', 'name pics price model kmsDriven')
            .select('-__v -driver -status')
            .sort('-_id')
            .lean();

        // Extracting the first image from the 'pics' array
        bookings.forEach(booking => {
            if (booking.car.pics) booking.car.pic = booking.car.pics[0];
            delete booking.car.pics;
        });

        bookings.bookingReq = undefined;

        res.json({ code: '1', message: req.t('success'), bookings });
    } catch (error) {
        next(error);
    }
};

exports.cancelBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findOne({
            _id: req.body.id,
            driver: req.driver.id,
            status: 'accepted',
        }).populate('user', 'fcmToken');
        if (!booking) return next(createError.NotFound('Booking not found!'));

        booking.status = 'cancelled';
        booking.reason = req.body.reason;
        await booking.save();

        const bookingRequest = await BookingReq.findOne({
            user: booking.user._id,
            car: booking.car,
            driver: booking.driver,
            bookedFrom: booking.bookedFrom,
            bookedTo: booking.bookedTo,
            pickupTime: booking.pickupTime,
            returnTime: booking.returnTime,
        });
        if (bookingRequest) {
            bookingRequest.status = 'cancelled';
            await bookingRequest.save();
        }

        // Notify user
        const data = {
            user: booking.user.id,
            car: booking.car,
            bookingId: booking.id,
            title: 'Booking cancelled',
            body: `Your booking has been cancelled by ${req.driver.name}. Reason - ${req.body.reason}.`,
        };
        sendNotification(booking.user.fcmToken, data);

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        next(error);
    }
};
