const Ride = require('../../models/rideModel');
const Booking = require('../../models/bookingModel');

// GET - All Rides (Taxi Rides)
// exports.getRides = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = 5000;
//         const skip = (page - 1) * limit;
//         const statusFilter = req.query.status || 'all';

//         let query = {};
//         if (statusFilter !== 'all') {
//             query.status = statusFilter;
//         }

//         const [rides, total, ongoingCount, completedCount, cancelledCount, upcomingCount, expiredCount] =
//             await Promise.all([
//                 Ride.find(query)
//                     .populate('user', 'name email phone')
//                     .populate('driver', 'name email phone')
//                     .sort({ createdAt: -1 })
//                     .skip(skip)
//                     .limit(limit)
//                     .lean(),

//                 Ride.countDocuments(query),
//                 Ride.countDocuments({ status: 'Ongoing' }),
//                 Ride.countDocuments({ status: 'Completed' }),
//                 Ride.countDocuments({ status: 'Cancelled' }),
//                 Ride.countDocuments({ status: 'Upcoming' }),
//                 Ride.countDocuments({ status: 'Expired' }),
//             ]);

//         res.render('rides', {
//             title: 'Dynasty Admin',
//             rides,
//             statusFilter,
//             totalPages: Math.ceil(total / limit),
//             currentPage: page,
//             ongoingCount,
//             completedCount,
//             cancelledCount,
//             upcomingCount,
//             expiredCount,
//             totalCount: total,
//         });
//     } catch (error) {
//         req.flash('red', error.message);
//         res.redirect('/admin');
//     }
// };

exports.getRides = async (req, res) => {
    try {
        const statusFilter = req.query.status || 'all';

        let query = {};
        if (statusFilter !== 'all') {
            query.status = statusFilter;
            // Agar tum rideStatus use kar rahe ho to yeh use karo:
            // query.rideStatus = statusFilter;
        }

        const [rides, total, ongoingCount, completedCount, cancelledCount, upcomingCount, expiredCount] =
            await Promise.all([
                Ride.find(query)
                    .populate('user', 'name email phone')
                    .populate('driver', 'name email phone')
                    .sort({ createdAt: -1 })
                    .lean(),                     // No limit, No skip

                Ride.countDocuments(query),
                Ride.countDocuments({ status: 'Ongoing' }),
                Ride.countDocuments({ status: 'Completed' }),
                Ride.countDocuments({ status: 'Cancelled' }),
                Ride.countDocuments({ status: 'Upcoming' }),
                Ride.countDocuments({ status: 'Expired' }),
            ]);

        res.render('rides', {
            title: 'Rides Management',
            rides,
            statusFilter,
            totalCount: total,
            ongoingCount,
            completedCount,
            cancelledCount,
            upcomingCount,
            expiredCount,
            currentPage: 1,        // ← Yeh line add ki taaki EJS error na de
            totalPages: 1          // Yeh bhi add kiya
        });

    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};


// GET - All Bookings (Rent)
// exports.getBookings = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = 20;
//         const skip = (page - 1) * limit;
//         const statusFilter = req.query.status || 'all';

//         let query = {};
//         if (statusFilter !== 'all') {
//             query.status = statusFilter;
//         }

//         const [bookings, total, acceptedCount, completedCount, cancelledCount] = await Promise.all([
//             Booking.find(query)
//                 .populate('user', 'name email phone')
//                 .populate('driver', 'name email phone')
//                 .populate('car', 'name model plateNumber')
//                 .sort({ createdAt: -1 })
//                 .skip(skip)
//                 .limit(limit)
//                 .lean(),

//             Booking.countDocuments(query),
//             Booking.countDocuments({ status: 'accepted' }),
//             Booking.countDocuments({ status: 'completed' }),
//             Booking.countDocuments({ status: 'cancelled' }),
//         ]);

//         res.render('bookings', {
//             title: 'Dynasty Admin',
//             bookings,
//             statusFilter,
//             totalPages: Math.ceil(total / limit),
//             currentPage: page,
//             acceptedCount,
//             completedCount,
//             cancelledCount,
//             totalCount: total,
//         });
//     } catch (error) {
//         req.flash('red', error.message);
//         res.redirect('/admin');
//     }
// };

// GET - All Bookings (Rent) - Without Pagination (Sab records ek saath)
exports.getBookings = async (req, res) => {
    try {
        const statusFilter = req.query.status || 'all';

        let query = {};
        if (statusFilter !== 'all') {
            query.status = statusFilter;
        }

        const [bookings, total, acceptedCount, completedCount, cancelledCount] = await Promise.all([
            Booking.find(query)
                .populate('user', 'name email phone')
                .populate('driver', 'name email phone')
                .populate('car', 'name model plateNumber')
                .sort({ createdAt: -1 })
                .lean(),                    // ← No limit, No skip

            Booking.countDocuments(query),
            Booking.countDocuments({ status: 'accepted' }),
            Booking.countDocuments({ status: 'completed' }),
            Booking.countDocuments({ status: 'cancelled' }),
        ]);

        res.render('bookings', {
            title: 'Bookings (Car Rent)',
            bookings,
            statusFilter,
            totalCount: total,
            acceptedCount,
            completedCount,
            cancelledCount,
            currentPage: 1,
            totalPages: 1
        });

    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

