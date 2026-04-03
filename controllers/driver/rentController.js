// const createError = require('http-errors');
// const { sendNotification } = require('../../utils/sendNotification');

// const Booking = require('../../models/bookingModel');
// const BookingReq = require('../../models/bookingReqModel'); 

// exports.getRequests = async (req, res, next) => {
//     try {
//         const bookings = await BookingReq.find({
//             driver: req.driver.id,
//             status: 'requested',
//         })
//             .populate('user', 'name email country_code phone profile')
//             .populate('car', 'pics name')
//             .sort('-_id')
//             .lean();

//         // Extracting the first image from the 'pics' array
//         bookings.forEach(booking => {
//             if (booking.car.pics) booking.car.pic = booking.car.pics[0];
//             delete booking.car.pics;
//         });

//         res.json({
//             code: '1',
//             message: req.t('success'),
//             bookings,
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.acceptRequest = async (req, res, next) => {
//     try {
//         const request = await BookingReq.findByIdAndUpdate(
//             req.params.id,
//             { status: 'accepted' },
//             { new: true }
//         ).populate('user', 'fcmToken');

//         if (!request)
//             return next(createError.BadRequest('Invalid request id.'));

//         // Notify user
//         const data = {
//             user: request.user.id,
//             car: request.car,
//             requestId: request.id,
//             title: 'Booking Request Accepted',
//             body: 'Your booking request has been accepted. Please proceed with the payment to confirm the booking.',
//             paymentRequired: true,
//         };
//         sendNotification(request.user.fcmToken, data);

//         res.json({ code: '1', message: req.t('rent.accepted') });
//     } catch (error) {
//         if (error.name === 'CastError')
//             return next(createError.BadRequest('Invalid request id.'));
//         next(error);
//     }
// };

// exports.rejectRequest = async (req, res, next) => {
//     try {
//         const request = await BookingReq.findByIdAndUpdate(
//             req.params.id,
//             { status: 'rejected' },
//             { new: true }
//         ).populate('user', 'fcmToken');

//         if (!request)
//             return next(createError.BadRequest('Invalid request id.'));

//         // Notify user
//         const data = {
//             user: request.user.id,
//             car: request.car,
//             requestId: request.id,
//             title: 'Booking Request Rejected',
//             body: 'Unfortunately, your booking request has been rejected. You can find another available car and make a new booking request.',
//         };
//         sendNotification(request.user.fcmToken, data);

//         res.json({ code: '1', message: req.t('rent.rejected') });
//     } catch (error) {
//         if (error.name === 'CastError')
//             return next(createError.BadRequest('Invalid request id.'));
//         next(error);
//     }
// };

// exports.getBookings = async (req, res, next) => {
//     try {
//         const currentDate = new Date();
//         const queryOptions = {
//             status: 'accepted',
//             driver: req.driver.id,
//             bookedTo:
//                 req.params.type === 'current'
//                     ? { $gte: currentDate }
//                     : { $lt: currentDate },
//         };

//         const bookings = await Booking.find(queryOptions)
//             .populate('user', 'profile name email country_code phone')
//             .populate('car', 'name pics price model kmsDriven')
//             .select('-__v -driver -status')
//             .sort('-_id')
//             .lean();

//         // Extracting the first image from the 'pics' array
//         bookings.forEach(booking => {
//             if (booking.car.pics) booking.car.pic = booking.car.pics[0];
//             delete booking.car.pics;
//         });

//         res.json({ code: '1', message: req.t('success'), bookings });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.cancelBooking = async (req, res, next) => {
//     try {
//         const booking = await Booking.findOne({
//             _id: req.body.id,
//             driver: req.driver.id,
//             status: 'accepted',
//         }).populate('user', 'fcmToken');
//         if (!booking) return next(createError.NotFound('Booking not found!'));

//         booking.status = 'cancelled';
//         booking.reason = req.body.reason;
//         await booking.save();

//         const bookingRequest = await BookingReq.findOne({
//             user: booking.user._id,
//             car: booking.car,
//             driver: booking.driver,
//             bookedFrom: booking.bookedFrom,
//             bookedTo: booking.bookedTo,
//             pickupTime: booking.pickupTime,
//             returnTime: booking.returnTime,
//         });
//         if (bookingRequest) {
//             bookingRequest.status = 'cancelled';
//             await bookingRequest.save();
//         }

//         // Notify user
//         const data = {
//             user: booking.user.id,
//             car: booking.car,
//             bookingId: booking.id,
//             title: 'Booking cancelled',
//             body: `Your booking has been cancelled by ${req.driver.name}. Reason - ${req.body.reason}.`,
//         };
//         sendNotification(booking.user.fcmToken, data);

//         res.json({ code: '1', message: req.t('success') });
//     } catch (error) {
//         next(error);
//     }
// };


const createError = require('http-errors');
const { sendNotification } = require('../../utils/sendNotification');

const Booking = require('../../models/bookingModel');
const BookingReq = require('../../models/bookingReqModel');
const driver = require("../../models/driverModel")

exports.getRequests = async (req, res, next) => {
    try {
        const bookings = await BookingReq.find({
            driver: req.driver.id,
            status: 'requested', // Only show pending requests
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
            count: bookings.length
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
        )
            .populate('user', 'name fcmToken')
            .populate('car', 'name');

        if (!request) return next(createError.BadRequest('Invalid request id.'));

        // ★★★ IMPORTANT: Create actual Booking document here ★★★
        const newBooking = await Booking.create({
            user: request.user._id,
            car: request.car._id,
            driver: request.driver,
            bookingReq: request._id,           // Link back to BookingReq
            deliveryOption: request.deliveryOption,
            address: request.address,
            bookedFrom: request.bookedFrom,
            bookedTo: request.bookedTo,
            pickupTime: request.pickupTime,
            returnTime: request.returnTime,
            status: 'accepted',            // or 'confirmed' etc.
            paymentStatus: 'pending',
            // Add other fields if needed: pickupCheck: false, etc.
        });

        // Notify user
        const data = {
            user: request.user._id,
            car: request.car._id,
            requestId: request._id,
            bookingId: newBooking._id,          // ← optional: send new booking ID
            title: 'Booking Request Accepted',
            body: `${req.driver.name} has accepted your booking request for ${request.car.name}. Please proceed with the payment to confirm.`,
            paymentRequired: true,
        };
        sendNotification(request.user.fcmToken, data);

        res.json({
            code: '1',
            message: req.t('rent.accepted'),
            bookingId: newBooking._id   // optional: frontend ko new ID de do
        });

    } catch (error) {
        if (error.name === 'CastError')
            return next(createError.BadRequest('Invalid request id.'));
        next(error);
    }
};

// exports.rejectRequest = async (req, res, next) => {
//     try {
//         const request = await BookingReq.findByIdAndUpdate(
//             req.params.id,
//             { status: 'rejected' },
//             { new: true }
//         ).populate('user', 'name fcmToken')
//          .populate('car', 'name');

//         if (!request)
//             return next(createError.BadRequest('Invalid request id.'));

//         // Notify user
//         const data = {
//             user: request.user._id,
//             car: request.car._id,
//             requestId: request._id,
//             title: 'Booking Request Rejected',
//             body: `Unfortunately, ${req.driver.name} has rejected your booking request for ${request.car.name}. You can find another available car.`,
//         };
//         sendNotification(request.user.fcmToken, data);

//         res.json({ code: '1', message: req.t('rent.rejected') });
//     } catch (error) {
//         if (error.name === 'CastError')
//             return next(createError.BadRequest('Invalid request id.'));
//         next(error);
//     }
// };

exports.rejectRequest = async (req, res, next) => {
    try {
        const { reason, rejectionReason } = req.body; // both names allowed for flexibility

        const reasonText = reason || rejectionReason || 'No reason provided';

        const request = await BookingReq.findByIdAndUpdate(
            req.params.id,
            { 
                status: 'rejected',
                rejectionReason: reasonText,           // save reason
                rejectedBy: req.driver.id              // who rejected it
            },
            { new: true }
        )
            .populate('user', 'name fcmToken')
            .populate('car', 'name');

        if (!request) {
            return next(createError.BadRequest('Invalid request id.'));
        }

        // Notify user with reason
        const data = {
            user: request.user._id,
            car: request.car._id,
            requestId: request._id,
            title: 'Booking Request Rejected',
            body: `${req.driver.name} has rejected your booking request for ${request.car.name}. Reason: ${reasonText}`,
            reason: reasonText,               // also send in data (useful for app)
            status: 'rejected'
        };

        try {
            await sendNotification(request.user.fcmToken, data);
        } catch (notifErr) {
            console.error('Notification failed (reject):', notifErr);
            // Continue even if notification fails
        }

        res.json({ 
            code: '1', 
            message: req.t('rent.rejected'),
            reason: reasonText   // optional: return reason in response
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return next(createError.BadRequest('Invalid request id.'));
        }
        next(error);
    }
};

exports.getBookings = async (req, res, next) => {
    try {
        const currentDate = new Date();
        const type = req.params.type; // 'current' or 'past'

        let queryOptions;

        if (type === 'current') {
            // FIX: Show accepted bookings with completed payment that haven't ended
            queryOptions = {
                driver: req.driver.id,
                status: { $in: ['accepted', 'completed'] },
                paymentStatus: 'completed', // Only show paid bookings
                bookedTo: { $gte: currentDate }
            };
        } else if (type === 'past') {
            // FIX: Show completed/cancelled bookings that have ended
            queryOptions = {
                driver: req.driver.id,
                status: { $in: ['accepted', 'completed', 'cancelled'] },
                paymentStatus: 'completed', // Only show paid bookings
                bookedTo: { $lt: currentDate }
            };
        } else {
            return next(createError.BadRequest('Invalid type parameter'));
        }

        const bookings = await BookingReq.find(queryOptions)
            .populate('user', 'profile name email country_code phone')
            .populate('car', 'name pics price model kmsDriven')
            .select('-__v')
            .sort('-_id')
            .lean();

        // Extracting the first image from the 'pics' array
        bookings.forEach(booking => {
            if (booking.car.pics) booking.car.pic = booking.car.pics[0];
            delete booking.car.pics;

            // Add payment and status info
            booking.isPaid = booking.paymentStatus === 'completed';
        });

        res.json({
            code: '1',
            message: req.t('success'),
            bookings,
            count: bookings.length
        });
    } catch (error) {
        next(error);
    }
};

exports.cancelBooking = async (req, res, next) => {
    try {
        const booking = await BookingReq.findOne({
            _id: req.body.id,
            driver: req.driver.id,
            status: { $in: ['accepted', 'completed'] },
        }).populate('user', 'name fcmToken')
            .populate('car', 'name');

        if (!booking)
            return next(createError.NotFound('Booking not found!'));

        // Check if payment was completed
        const needsRefund = booking.paymentStatus === 'completed';

        booking.status = 'cancelled';
        booking.reason = req.body.reason;
        if (needsRefund) {
            booking.paymentStatus = 'refunded';
            // TODO: Implement actual refund logic
        }
        await booking.save();

        // Also update main Booking model if exists
        const mainBooking = await Booking.findOne({
            user: booking.user._id,
            car: booking.car._id,
            driver: booking.driver,
            bookedFrom: booking.bookedFrom,
            bookedTo: booking.bookedTo,
        });

        if (mainBooking) {
            mainBooking.status = 'cancelled';
            mainBooking.reason = req.body.reason;
            if (needsRefund) {
                mainBooking.paymentStatus = 'refunded';
            }
            await mainBooking.save();
        }

        // Notify user
        const data = {
            user: booking.user._id,
            car: booking.car._id,
            bookingId: booking._id,
            title: 'Booking Cancelled',
            body: `${req.driver.name} has cancelled your booking for ${booking.car.name}. Reason: ${req.body.reason}.${needsRefund ? ' Refund will be processed.' : ''}`,
        };
        sendNotification(booking.user.fcmToken, data);

        res.json({
            code: '1',
            message: req.t('success'),
            refundInitiated: needsRefund
        });
    } catch (error) {
        next(error);
    }
};