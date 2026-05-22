// const createError = require('http-errors');
// const multilingual = require('../../utils/multilingual');
// const deleteFile = require('../../utils/deleteFile');
// const { sendNotification } = require('../../utils/sendNotification');

// const Car = require('../../models/carModel');
// const Booking = require('../../models/bookingModel');
// const BookingReq = require('../../models/bookingReqModel');
// const Rating = require('../../models/ratingModel');
// const Charges = require('../../models/chargesModel');

// exports.listCars = async (req, res, next) => {
//     try {
//         // Filter
//         const filter = { isDeleted: false };

//         // Search
//         if (req.body.search) {
//             const searchRegex = new RegExp(req.body.search, 'i');
//             filter.$or = [
//                 { name: { $regex: searchRegex } },
//                 { company: { $regex: searchRegex } },
//                 { model: { $regex: searchRegex } },
//             ];
//         }

//         // By date time availability
//         if (req.body.dateFrom && req.body.dateTo) {
//             const dateFrom = new Date(req.body.dateFrom);
//             const dateTo = new Date(req.body.dateTo);

//             if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime()))
//                 return next(createError.BadRequest('Invalid date format'));
//             const currentDate = new Date();
//             if (dateFrom <= currentDate || dateTo <= currentDate)
//                 return next(
//                     createError.BadRequest('Dates must be in the future.')
//                 );
//             if (dateTo <= dateFrom)
//                 return next(
//                     createError.BadRequest(
//                         'To date should be greater than From date.'
//                     )
//                 );

//             // Find the cars that are not booked within the date range
//             const bookedCarIds = await Booking.distinct('car', {
//                 bookedFrom: { $lt: dateTo },
//                 bookedTo: { $gt: dateFrom },
//                 status: 'accepted',
//             });
//             filter._id = { $nin: bookedCarIds };
//         }

//         // By location
//         if (req.body.latitude && req.body.longitude)
//             filter.location = {
//                 $near: {
//                     $geometry: {
//                         type: 'Point',
//                         coordinates: [req.body.longitude, req.body.latitude],
//                     },
//                     $maxDistance: process.env.radiusInMeters,
//                 },
//             };

//         // Sort
//         const sort = { _id: -1 };

//         let cars = await Car.find(filter)
//             .sort(sort)
//             .populate('type')
//             .select('name price pics rating')
//             .lean();

//         cars = cars.map(car => {
//             return {
//                 ...car,
//                 isFavorite: req.user.favorites.includes(car._id),
//                 type: multilingual(car.type, req).name,
//             };
//         });

//         res.json({ code: '1', message: req.t('success'), cars });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.carDetail = async (req, res, next) => {
//     try {
//         const carId = req.params.id;
//         const currentDate = new Date();

//         const [car, ratings, request, bookings, charge] = await Promise.all([
//             Car.findById(carId)
//                 .populate('driver', 'profile name')
//                 .select('-__v -location -type')
//                 .lean(),
//             Rating.find({ car: carId })
//                 .populate('user', 'name profile')
//                 .select('-__v -car')
//                 .lean(),
//             BookingReq.exists({
//                 car: carId,
//                 user: req.user.id,
//                 status: 'requested',
//             }),
//             Booking.find({
//                 car: carId,
//                 status: 'accepted',
//                 bookedFrom: { $gte: currentDate },
//             }).select('bookedFrom bookedTo'),
//             Charges.findOne(),
//         ]);

//         if (!car) return next(createError.BadRequest('Invalid car id.'));

//         bookings.bookingReq = undefined;

//         // Filter out ratings with comments
//         const reviews = ratings.filter(rating => !!rating.comment);
//         car.numReviews = reviews.length;
//         car.numRatings = ratings.length;

//         car.isFavorite = req.user.favorites.includes(car._id);
//         car.reviews = reviews;
//         car.requested = request ? true : false;

//         res.json({
//             code: '1',
//             message: req.t('success'),
//             car,
//             bookedSlots: bookings,
//             carDeliveringFee: charge.carDeliveringFee,
//         });
//     } catch (error) {
//         if (error.name === 'CastError')
//             return next(createError.BadRequest('Invalid car id.'));
//         next(error);
//     }
// };

// exports.bookCar = async (req, res, next) => {
//     try {
//         const bookedFrom = new Date(req.body.dateFrom);
//         const bookedTo = new Date(req.body.dateTo);

//         if (isNaN(bookedFrom.getTime()) || isNaN(bookedTo.getTime()))
//             return next(createError.BadRequest('Invalid date format'));

//         const currentDate = new Date();
//         if (bookedFrom <= currentDate || bookedTo <= currentDate)
//             return next(createError.BadRequest('Dates must be in the future.'));

//         if (bookedTo <= bookedFrom)
//             return next(
//                 createError.BadRequest(
//                     'To date should be greater than From date.'
//                 )
//             );

//         const car = await Car.findById(req.body.carId).populate(
//             'driver',
//             'address fcmToken'
//         );
//         if (!car) return next(createError.BadRequest('Invalid carId.'));

//         // Check if the car is already booked within the requested period
//         const overlappingBooking = await Booking.findOne({
//             car: req.body.carId,
//             bookedFrom: { $lt: bookedTo },
//             bookedTo: { $gt: bookedFrom },
//             status: 'accepted',
//         });
//         if (overlappingBooking)
//             return next(createError.Conflict('rent.already'));

//         const { deliveryOption } = req.body;
//         let address;
//         if (deliveryOption === 'delivery') address = req.body.address;
//         else if (deliveryOption === 'pickup') address = car.driver.address;
//         else return next(createError.BadRequest('Invalid delivery option.'));

//         const booking = await BookingReq.create({
//             user: req.user.id,
//             car: req.body.carId,
//             driver: car.driver,
//             deliveryOption,
//             address,
//             bookedFrom,
//             bookedTo,
//             pickupTime: req.body.pickupTime,
//             returnTime: req.body.returnTime,
//         });

//         // Notify driver
//         const data = {
//             driver: car.driver,
//             car: req.body.carId,
//             requestId: booking.id,
//             title: 'New Booking Request',
//             body: 'You have a new booking request. Please review and respond.',
//         };
//         sendNotification(car.driver.fcmToken, data);

//         res.json({ code: '1', message: req.t('success'), booking });
//     } catch (error) {
//         if (error.name === 'CastError')
//             return next(createError.BadRequest('Invalid carId.'));
//         next(error);
//     }
// };

// exports.tempPayment = async (req, res, next) => {
//     try {
//         const [request, charge] = await Promise.all([
//             BookingReq.findById(req.body.requestId).populate('car').lean(),
//             Charges.findOne(),
//         ]);
//         if (!request || request.status !== 'accepted')
//             return next(createError.BadRequest('Invalid requestId.'));

//         const { _id, ...requestData } = request;

//         // Calculate days
//         const bookedFrom = new Date(request.bookedFrom);
//         const bookedTo = new Date(request.bookedTo);
//         bookedFrom.setHours(0, 0, 0, 0);
//         bookedTo.setHours(0, 0, 0, 0);
//         const days =
//             Math.ceil((bookedTo - bookedFrom) / (1000 * 60 * 60 * 24)) + 1;
//         if (days <= 0)
//             return next(createError.BadRequest('Invalid booking dates.'));

//         // Calculate the total rent price
//         let price = request.car.price * days;
//         if (request.deliveryOption == 'delivery')
//             price += charge.carDeliveringFee;
//         requestData.price = price;
//         requestData.bookingReq = req.body.requestId;

//         const booking = await Booking.create(requestData);

//         await BookingReq.findByIdAndUpdate(_id, { status: 'completed' }).catch(
//             error => console.log('Error updating booking: ', error)
//         );

//         // Notify user
//         const data = {
//             user: req.user.id,
//             car: request.car,
//             requestId: request.id,
//             title: 'Booking has been completed.',
//             body: 'Your booking has been successfully completed. Thank you for using our service!',
//         };
//         sendNotification(req.user.fcmToken, data);

//         booking.bookingReq = undefined;

//         res.json({ code: '1', message: req.t('success'), booking });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.getFavorites = async (req, res, next) => {
//     try {
//         await req.user.populate({
//             path: 'favorites',
//             match: { isDeleted: false },
//             select: 'name price pics rating',
//             options: { lean: true },
//             populate: { path: 'type' },
//         });

//         const favorites = req.user.favorites.map(car => {
//             return {
//                 ...car,
//                 isFavorite: true,
//                 type: multilingual(car.type, req).name,
//             };
//         });

//         favorites.reverse();

//         res.json({
//             code: '1',
//             message: req.t('success'),
//             favorites,
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.toggleFavorite = async (req, res, next) => {
//     try {
//         const car = await Car.findById(req.body.id);
//         if (!car) return next(createError.NotFound('Car not found.'));

//         const user = req.user;

//         const carIndex = user.favorites.indexOf(car.id);
//         if (carIndex !== -1) user.favorites.splice(carIndex, 1);
//         else user.favorites.push(car.id);

//         await user.save();

//         res.json({ code: '1', message: req.t('success') });
//     } catch (error) {
//         if (error.name == 'CastError')
//             return next(createError.NotFound('Car not found.'));
//         next(error);
//     }
// };

// exports.addRating = async (req, res, next) => {
//     try {
//         const { carId, rating: newRating, comment } = req.body;

//         let updatedRating = await Rating.findOne({
//             car: carId,
//             user: req.user.id,
//         });

//         if (updatedRating) {
//             updatedRating.rating = newRating;
//             updatedRating.comment = comment;
//         } else {
//             updatedRating = new Rating({
//                 car: carId,
//                 user: req.user.id,
//                 rating: newRating,
//                 comment,
//             });
//         }
//         await updatedRating.save();

//         Rating.aggregate([
//             { $match: { car: updatedRating.car } },
//             { $group: { _id: '$car', averageRating: { $avg: '$rating' } } },
//         ]).then(averageRatings => {
//             const averageRating = averageRatings[0].averageRating.toFixed(1);
//             Car.findByIdAndUpdate(carId, { rating: averageRating }).exec();
//         });

//         res.json({
//             code: '1',
//             message: req.t('rating.added'),
//             rating: updatedRating,
//         });
//     } catch (error) {
//         if (error.name == 'CastError')
//             return next(createError.BadRequest('Invalid carId.'));
//         next(error);
//     }
// };

// exports.getBookings = async (req, res, next) => {
//     try {
//         const currentDate = new Date();
//         const queryOptions = {
//             status: { $in: ['accepted', 'completed'] },
//             user: req.user.id,
//             bookedTo:
//                 req.params.type === 'current'
//                     ? { $gte: currentDate }
//                     : { $lt: currentDate },
//         };

//         const bookings = await BookingReq.find(queryOptions)
//             .populate('user', 'profile name email country_code phone')
//             .populate('car', 'name pics price kmsDriven model')
//             .select('-__v -status')
//             .sort('-_id')
//             .lean();

//         const carIds = [...new Set(bookings.map(booking => booking.car._id))];
//         const ratings = await Rating.find({
//             car: { $in: carIds },
//             user: req.user.id,
//         })
//             .select('car rating comment')
//             .lean();

//         // Extracting the first image from the 'pics' array
//         bookings.forEach(booking => {
//             if (booking.car.pics) booking.car.pic = booking.car.pics[0];
//             delete booking.car.pics;
//             const rating = ratings.find(r => r.car.equals(booking.car._id));
//             booking.rating = rating ? rating.rating : null;
//             booking.comment = rating ? rating.comment : null;
//         });

//         res.json({ code: '1', message: req.t('success'), bookings });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.getHistory = async (req, res, next) => {
//     try {
//         // Temp
//         const history = [
//             {
//                 type: 'Refund',
//                 amount: 39,
//                 Date: '2023-08-14T10:33:25.864Z',
//                 method: 'Cash',
//             },
//             {
//                 type: 'Paid',
//                 amount: 249,
//                 Date: '2023-08-10T14:46:25.864Z',
//                 method: 'Card',
//             },
//             {
//                 type: 'Paid',
//                 amount: 120,
//                 Date: '2023-07-25T09:14:41.773Z',
//                 method: 'Card',
//             },
//         ];

//         res.json({ code: '1', message: req.t('success'), history });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.cancelBooking = async (req, res, next) => {
//     try {
//         const booking = await BookingReq.findOne({
//             _id: req.body.id,
//             user: req.user.id,
//             status: 'accepted',
//         }).populate('driver', 'fcmToken');
//         if (!booking) return next(createError.NotFound('Booking not found!'));

//         booking.status = 'cancelled';
//         booking.reason = req.body.reason;
//         await booking.save();

//         // Notify driver
//         const data = {
//             driver: booking.driver.id,
//             car: booking.car,
//             requestId: booking.id,
//             title: 'Booking cancelled',
//             body: `Booking has been cancelled by ${req.user.name}. Reason - ${req.body.reason}.`,
//         };
//         sendNotification(booking.driver.fcmToken, data);

//         res.json({ code: '1', message: req.t('success') });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.uploadSignature = async (req, res, next) => {
//     try {
//         // 1. Validate file
//         if (!req.file) {
//             return next(createError.BadRequest('Please upload signature.'));
//         }

//         // 2. Generate public URL from Multer filename
//         const signatureUrl = `/uploads/${req.file.filename}`;

//         // 3. Build update object
//         const update = req.params.type === 'pickup'
//             ? { pickupCheck: true, pickupSign: signatureUrl }
//             : { returnCheck: true, returnSign: signatureUrl };

//         // 4. Update Booking
//         const booking = await Booking.findByIdAndUpdate(
//             req.body.bookingId,
//             update,
//             { new: true }
//         );

//         if (!booking) {
//             // Delete file if booking not found
//             deleteFile(req.file.path);
//             return next(createError.NotFound('Booking not found.'));
//         }

//         // 5. Update Booking Request
//         await BookingReq.findByIdAndUpdate(booking.bookingReq, update);

//         // 6. Success
//         res.json({ code: '1', message: req.t('success') });

//     } catch (error) {
//         // 7. Cleanup on error
//         if (req.file) {
//             deleteFile(req.file.path);
//         }
//         next(error);
//     }
// };



const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');
const deleteFile = require('../../utils/deleteFile');
const { sendNotification } = require('../../utils/sendNotification');

const Car = require('../../models/carModel');
const Booking = require('../../models/bookingModel');
const BookingReq = require('../../models/bookingReqModel');
const Rating = require('../../models/ratingModel');
const Charges = require('../../models/chargesModel');

exports.listCars = async (req, res, next) => {
    try {
        // Filter
        const filter = { isDeleted: false };

        // Search
        if (req.body.search) {
            const searchRegex = new RegExp(req.body.search, 'i');
            filter.$or = [
                { name: { $regex: searchRegex } },
                { company: { $regex: searchRegex } },
                { model: { $regex: searchRegex } },
            ];
        }

        // By date time availability
        if (req.body.dateFrom && req.body.dateTo) {
            const dateFrom = new Date(req.body.dateFrom);
            const dateTo = new Date(req.body.dateTo);

            if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime()))
                return next(createError.BadRequest('Invalid date format'));
            const currentDate = new Date();
            if (dateFrom <= currentDate || dateTo <= currentDate)
                return next(
                    createError.BadRequest('Dates must be in the future.')
                );
            if (dateTo <= dateFrom)
                return next(
                    createError.BadRequest(
                        'To date should be greater than From date.'
                    )
                );

            // Find the cars that are not booked within the date range
            const bookedCarIds = await Booking.distinct('car', {
                bookedFrom: { $lt: dateTo },
                bookedTo: { $gt: dateFrom },
                status: 'accepted',
            });
            filter._id = { $nin: bookedCarIds };
        }

        // By location
        if (req.body.latitude && req.body.longitude)
            filter.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [req.body.longitude, req.body.latitude],
                    },
                    $maxDistance: process.env.radiusInMeters,
                },
            };

        // Sort
        const sort = { _id: -1 };

        let cars = await Car.find(filter)
            .sort(sort)
            .populate('type')
            .select('name price pics rating')
            .lean();

        cars = cars.map(car => {
            return {
                ...car,
                isFavorite: req.user.favorites.includes(car._id),
                type: multilingual(car.type, req).name,
            };
        });

        res.json({ code: '1', message: req.t('success'), cars });
    } catch (error) {
        next(error);
    }
};

// exports.listCars = async (req, res, next) => {
//     try {
//         // Filter
//         const filter = { isDeleted: false };

//         // Search
//         if (req.body.search) {
//             const searchRegex = new RegExp(req.body.search, 'i');
//             filter.$or = [
//                 { name: { $regex: searchRegex } },
//                 { company: { $regex: searchRegex } },
//                 { model: { $regex: searchRegex } },
//             ];
//         }

//         // By date time availability
//         let bookedCarIds = []; // default empty

//         if (req.body.dateFrom && req.body.dateTo) {
//             const dateFrom = new Date(req.body.dateFrom);
//             const dateTo = new Date(req.body.dateTo);

//             if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
//                 return next(createError.BadRequest('Invalid date format'));
//             }

//             const currentDate = new Date();
//             if (dateFrom <= currentDate || dateTo <= currentDate) {
//                 return next(createError.BadRequest('Dates must be in the future.'));
//             }

//             if (dateTo <= dateFrom) {
//                 return next(createError.BadRequest('To date should be greater than From date.'));
//             }

//             // Find the cars that are booked (overlapping) in the date range
//             bookedCarIds = await Booking.distinct('car', {
//                 bookedFrom: { $lt: dateTo },
//                 bookedTo:   { $gt: dateFrom },
//                 status:     'accepted',
//             });

//             // ─── DEBUG LOGS ───────────────────────────────────────────────
//             console.log("=== DEBUG ===");
//             console.log("Requested range:", req.body.dateFrom, "→", req.body.dateTo);
//             console.log("Found overlapping accepted bookings for these car IDs:", bookedCarIds);
//             console.log("Total cars before exclusion:", await Car.countDocuments(filter));
//             console.log("=============");
//             // ──────────────────────────────────────────────────────────────

//             // Exclude booked cars
//             filter._id = { $nin: bookedCarIds };
//         }

//         // By location
//         if (req.body.latitude && req.body.longitude) {
//             filter.location = {
//                 $near: {
//                     $geometry: {
//                         type: 'Point',
//                         coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)],
//                     },
//                     $maxDistance: Number(process.env.radiusInMeters) || 20000, // fallback 20km if not set
//                 },
//             };
//         }

//         // Sort
//         const sort = { _id: -1 };

//         let cars = await Car.find(filter)
//             .sort(sort)
//             .populate('type')
//             .select('name price pics rating')
//             .lean();

//         cars = cars.map(car => {
//             return {
//                 ...car,
//                 isFavorite: req.user?.favorites?.includes(car._id.toString()) || false,
//                 type: multilingual(car.type, req).name,
//             };
//         });

//         // Optional: more debug at the end (how many cars we actually returned)
//         console.log(`Returning ${cars.length} cars after all filters`);

//         res.json({ 
//             code: '1', 
//             message: req.t('success'), 
//             cars,
//             debugInfo: { // optional - you can remove later
//                 requestedSearch: req.body.search || null,
//                 requestedDates: req.body.dateFrom && req.body.dateTo ? { from: req.body.dateFrom, to: req.body.dateTo } : null,
//                 excludedByBooking: bookedCarIds.length,
//                 finalCount: cars.length
//             }
//         });

//     } catch (error) {
//         next(error);
//     }
// };

// exports.carDetail = async (req, res, next) => {
//     try {
//         const carId = req.params.id;
//         const currentDate = new Date();

//         const [car, ratings, request, bookings, charge] = await Promise.all([
//             Car.findById(carId)
//                 .populate('driver', 'profile name')
//                 .select('-__v -location -type')
//                 .lean(),
//             Rating.find({ car: carId })
//                 .populate('user', 'name profile')
//                 .select('-__v -car')
//                 .lean(),
//             BookingReq.exists({
//                 car: carId,
//                 user: req.user.id,
//                 status: 'requested',
//             }),
//             Booking.find({
//                 car: carId,
//                 status: 'accepted',
//                 bookedFrom: { $gte: currentDate },
//             }).select('bookedFrom bookedTo'),
//             Charges.findOne(),
//         ]);

//         if (!car) return next(createError.BadRequest('Invalid car id.'));

//         bookings.bookingReq = undefined;

//         // Filter out ratings with comments
//         const reviews = ratings.filter(rating => !!rating.comment);
//         car.numReviews = reviews.length;
//         car.numRatings = ratings.length;

//         car.isFavorite = req.user.favorites.includes(car._id);
//         car.reviews = reviews;
//         car.requested = request ? true : false;

//         res.json({
//             code: '1',
//             message: req.t('success'),
//             car,
//             bookedSlots: bookings,
//             carDeliveringFee: charge.carDeliveringFee,
//         });
//     } catch (error) {
//         if (error.name === 'CastError')
//             return next(createError.BadRequest('Invalid car id.'));
//         next(error);
//     }
// };


exports.carDetail = async (req, res, next) => {
    try {
        const carId = req.params.id;
        const currentDate = new Date();

        const [car, ratings, request, bookings, charge] = await Promise.all([
            Car.findOne({
                _id: carId,
                isDeleted: false   // ← Deleted car ko block kar diya
            })
                .populate('driver', 'profile name')
                .select('-__v -location -type')
                .lean(),
            Rating.find({ car: carId })
                .populate('user', 'name profile')
                .select('-__v -car')
                .lean(),
            BookingReq.exists({
                car: carId,
                user: req.user.id,
                status: 'requested',
            }),
            Booking.find({
                car: carId,
                status: 'accepted',
                bookedFrom: { $gte: currentDate },
            }).select('bookedFrom bookedTo'),
            Charges.findOne(),
        ]);

        if (!car) {
            return next(createError.NotFound('Car not found or has been deleted.'));
        }

        bookings.bookingReq = undefined;

        // Filter out ratings with comments
        const reviews = ratings.filter(rating => !!rating.comment);
        car.numReviews = reviews.length;
        car.numRatings = ratings.length;

        car.isFavorite = req.user.favorites.includes(car._id);
        car.reviews = reviews;
        car.requested = request ? true : false;

        res.json({
            code: '1',
            message: req.t('success'),
            car,
            bookedSlots: bookings,
            carDeliveringFee: charge.carDeliveringFee,
        });
    } catch (error) {
        if (error.name === 'CastError')
            return next(createError.BadRequest('Invalid car id.'));
        next(error);
    }
};

// exports.bookCar = async (req, res, next) => {
//     try {
//         const bookedFrom = new Date(req.body.dateFrom);
//         const bookedTo = new Date(req.body.dateTo);

//         if (isNaN(bookedFrom.getTime()) || isNaN(bookedTo.getTime()))
//             return next(createError.BadRequest('Invalid date format'));

//         const currentDate = new Date();
//         if (bookedFrom <= currentDate || bookedTo <= currentDate)
//             return next(createError.BadRequest('Dates must be in the future.'));

//         if (bookedTo <= bookedFrom)
//             return next(
//                 createError.BadRequest(
//                     'To date should be greater than From date.'
//                 )
//             );

//         const car = await Car.findById(req.body.carId).populate(
//             'driver',
//             'name address fcmToken'
//         );
//         if (!car) return next(createError.BadRequest('Invalid carId.'));

//         // Check if the car is already booked within the requested period
//         const overlappingBooking = await Booking.findOne({
//             car: req.body.carId,
//             bookedFrom: { $lt: bookedTo },
//             bookedTo: { $gt: bookedFrom },
//             status: 'accepted',
//         });
//         if (overlappingBooking)
//             return next(createError.Conflict('rent.already'));

//         const { deliveryOption } = req.body;
//         let address;
//         if (deliveryOption === 'delivery') address = req.body.address;
//         else if (deliveryOption === 'pickup') address = car.driver.address;
//         else return next(createError.BadRequest('Invalid delivery option.'));

//         const booking = await BookingReq.create({
//             user: req.user.id,
//             car: req.body.carId,
//             driver: car.driver._id,
//             deliveryOption,
//             address,
//             bookedFrom,
//             bookedTo,
//             pickupTime: req.body.pickupTime,
//             returnTime: req.body.returnTime,
//             status: 'requested',
//             paymentStatus: 'pending' // Track payment status
//         });

//         // FIX: Notify driver about new booking request
//         const data = {
//             driver: car.driver._id,
//             car: req.body.carId,
//             requestId: booking._id,
//             title: 'New Booking Request',
//             body: `${req.user.name} has requested to book ${car.name} from ${bookedFrom.toLocaleDateString()} to ${bookedTo.toLocaleDateString()}.`,
//         };
//         sendNotification(car.driver.fcmToken, data);

//         res.json({ code: '1', message: req.t('success'), booking });
//     } catch (error) {
//         if (error.name === 'CastError')
//             return next(createError.BadRequest('Invalid carId.'));
//         next(error);
//     }
// };

// exports.bookCar = async (req, res, next) => {
//     // ────────────────────────────────────────────────────────────────
//     // BIG VISIBLE LOG – to confirm the function is being called
//     // ────────────────────────────────────────────────────────────────
//     console.log('\n\n');
//     console.log('============================================================');
//     console.log('🚀 bookCar API CALLED SUCCESSFULLY !');
//     console.log('Request Body:', JSON.stringify(req.body, null, 2));
//     console.log('User ID:', req.user?.id || 'No user');
//     console.log('Car ID from body:', req.body.carId);
//     console.log('============================================================\n\n');

//     try {
//         const bookedFrom = new Date(req.body.dateFrom);
//         const bookedTo = new Date(req.body.dateTo);

//         if (isNaN(bookedFrom.getTime()) || isNaN(bookedTo.getTime())) {
//             return next(createError.BadRequest('Invalid date format'));
//         }

//         const currentDate = new Date();
//         if (bookedFrom <= currentDate || bookedTo <= currentDate) {
//             return next(createError.BadRequest('Dates must be in the future.'));
//         }

//         if (bookedTo <= bookedFrom) {
//             return next(createError.BadRequest('To date should be greater than From date.'));
//         }

//         const car = await Car.findById(req.body.carId).populate(
//             'driver',
//             'name address fcmToken'
//         );

//         if (!car) {
//             return next(createError.BadRequest('Invalid carId.'));
//         }

//         if (!car.driver) {
//             console.warn(`[bookCar] No driver assigned to car ${req.body.carId}`);
//             return next(createError.BadRequest('This car has no assigned driver.'));
//         }

//         const overlappingBooking = await Booking.findOne({
//             car: req.body.carId,
//             bookedFrom: { $lt: bookedTo },
//             bookedTo: { $gt: bookedFrom },
//             status: 'accepted',
//         });

//         if (overlappingBooking) {
//             return next(createError.Conflict('rent.already'));
//         }

//         // const { deliveryOption } = req.body;
//         const { deliveryOption, address: userAddress, amount, price } = req.body;
//         let address;
//         if (deliveryOption === 'delivery') {
//             address = req.body.address;
//         } else if (deliveryOption === 'pickup') {
//             address = car.driver.address;
//         } else {
//             return next(createError.BadRequest('Invalid delivery option.'));
//         }

//        // ✅ Final Amount decide karo (priority: amount > price > 0)
//         const finalAmount = Number(amount) || Number(price) || 0;

//         if (finalAmount <= 0) {
//             return next(createError.BadRequest('Amount or Price is required and must be greater than 0'));
//         }


//         const booking = await BookingReq.create({
//             user: req.user.id,
//             car: req.body.carId,
//             driver: car.driver._id,
//             deliveryOption,
//             address,
//             bookedFrom,
//             bookedTo,
//             pickupTime: req.body.pickupTime,
//             returnTime: req.body.returnTime,
//             status: 'requested',
//             paymentStatus: 'pending',
//             // amount: req.body.amount || 0,
//             price: bookingReq.amount || bookingReq.car?.price || 10,
//         });

//         // const amount = req.body.amount;

//         // ───────────────────────────────────────────────
//         // Send notification to driver – with super visible logs
//         // ───────────────────────────────────────────────
//         if (car.driver.fcmToken) {
//             const notificationPayload = {
//                 driver: car.driver._id.toString(),
//                 car: req.body.carId,
//                 requestId: booking._id.toString(),
//                 bookingId: booking._id.toString(),
//                 title: 'New Booking Request',
//                 body: `${req.user.name || 'A customer'} has requested to book ${car.name} from ${bookedFrom.toLocaleDateString()} to ${bookedTo.toLocaleDateString()}.`,
//                 type: 'new_rent_request',
//                 timestamp: new Date().toISOString(),
//             };

//             // ── BIG LOGS FOR YOU ───────────────────────────────
//             console.log('\n\n');
//             console.log('🔥🔥🔥 ABOUT TO SEND FCM NOTIFICATION 🔥🔥🔥');
//             console.log('FCM Token (first 10 chars):', car.driver.fcmToken.substring(0, 10) + '...');
//             console.log('Full Token Length:', car.driver.fcmToken.length);
//             console.log('Notification Title:', notificationPayload.title);
//             console.log('Notification Body:', notificationPayload.body);
//             console.log('Payload JSON:', JSON.stringify(notificationPayload, null, 2));
//             console.log('🔥🔥🔥 SENDING NOW... 🔥🔥🔥\n\n');

//             try {
//                 const response = await sendNotification(car.driver.fcmToken, notificationPayload);
//                 console.log('🎉 NOTIFICATION SENT SUCCESSFULLY 🎉');
//                 console.log('FCM Response Message ID:', response); // This is the key success indicator
//                 console.log(`Driver ID: ${car.driver._id}`);
//             } catch (notifyError) {
//                 console.error('❌ FCM NOTIFICATION FAILED ❌');
//                 console.error('Error Code:', notifyError.code);
//                 console.error('Error Message:', notifyError.message);
//                 console.error('Full Error:', notifyError);
//             }
//         } else {
//             console.warn(
//                 '[bookCar] ❌ No FCM token found for driver ' + car.driver._id + ' — skipping notification'
//             );
//         }

//         // Success response
//         res.json({
//             code: '1',
//             message: req.t('success') || 'Booking request created successfully',
//             booking,
//         });

//     } catch (error) {
//         console.error('[bookCar] GENERAL ERROR:', error.message);
//         if (error.name === 'CastError') {
//             return next(createError.BadRequest('Invalid carId or other ID format.'));
//         }
//         next(error);
//     }
// };

exports.bookCar = async (req, res, next) => {
    console.log('\n\n');
    console.log('============================================================');
    console.log('🚀 bookCar API CALLED SUCCESSFULLY !');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    console.log('User ID:', req.user?.id || 'No user');
    console.log('Car ID from body:', req.body.carId);
    console.log('============================================================\n\n');

    try {
        const bookedFrom = new Date(req.body.dateFrom);
        const bookedTo = new Date(req.body.dateTo);

        if (isNaN(bookedFrom.getTime()) || isNaN(bookedTo.getTime())) {
            return next(createError.BadRequest('Invalid date format'));
        }

        const currentDate = new Date();
        if (bookedFrom <= currentDate || bookedTo <= currentDate) {
            return next(createError.BadRequest('Dates must be in the future.'));
        }

        if (bookedTo <= bookedFrom) {
            return next(createError.BadRequest('To date should be greater than From date.'));
        }

        const car = await Car.findById(req.body.carId).populate(
            'driver',
            'name address fcmToken'
        );

        if (!car) {
            return next(createError.BadRequest('Invalid carId.'));
        }

        if (!car.driver) {
            console.warn(`[bookCar] No driver assigned to car ${req.body.carId}`);
            return next(createError.BadRequest('This car has no assigned driver.'));
        }

        const overlappingBooking = await Booking.findOne({
            car: req.body.carId,
            bookedFrom: { $lt: bookedTo },
            bookedTo: { $gt: bookedFrom },
            status: 'accepted',
        });

        if (overlappingBooking) {
            return next(createError.Conflict('rent.already'));
        }

        const { deliveryOption, amount, price } = req.body;

        let address;
        if (deliveryOption === 'delivery') {
            address = req.body.address;
        } else if (deliveryOption === 'pickup') {
            address = car.driver.address;
        } else {
            return next(createError.BadRequest('Invalid delivery option.'));
        }

        // ✅ Final amount decide karo (priority: amount > price > car.price > 0)
        const finalAmount = Number(amount) || Number(price) || Number(car.price) || 0;

        console.log(`[bookCar] finalAmount calculated: ₹${finalAmount}`);

        if (finalAmount <= 0) {
            return next(createError.BadRequest('Amount or Price is required and must be greater than 0'));
        }

        // ✅ BookingReq create karo with correct amount
        const booking = await BookingReq.create({
            user: req.user.id,
            car: req.body.carId,
            driver: car.driver._id,
            deliveryOption,
            address,
            bookedFrom,
            bookedTo,
            pickupTime: req.body.pickupTime,
            returnTime: req.body.returnTime,
            status: 'requested',
            paymentStatus: 'pending',
            amount: finalAmount,   // ✅ FIXED: bookingReq.amount was undefined before
        });

        console.log(`✅ BookingReq Created Successfully | Amount: ₹${finalAmount} | ID: ${booking._id}`);

        // ── Send notification to driver ──────────────────────────────────
        if (car.driver.fcmToken) {
            const notificationPayload = {
                driver: car.driver._id.toString(),
                car: req.body.carId,
                requestId: booking._id.toString(),
                bookingId: booking._id.toString(),
                title: 'New Booking Request',
                body: `${req.user.name || 'A customer'} has requested to book ${car.name} from ${bookedFrom.toLocaleDateString()} to ${bookedTo.toLocaleDateString()}.`,
                type: 'new_rent_request',
                timestamp: new Date().toISOString(),
            };

            console.log('\n🔥 ABOUT TO SEND FCM NOTIFICATION 🔥');
            console.log('FCM Token (first 10 chars):', car.driver.fcmToken.substring(0, 10) + '...');
            console.log('Notification Title:', notificationPayload.title);

            try {
                const response = await sendNotification(car.driver.fcmToken, notificationPayload);
                console.log(`🎉 Notification sent to driver | Message ID: ${response}`);
            } catch (notifyError) {
                console.error('❌ FCM NOTIFICATION FAILED ❌');
                console.error('Error Code:', notifyError.code);
                console.error('Error Message:', notifyError.message);
            }
        } else {
            console.warn('[bookCar] ❌ No FCM token found for driver ' + car.driver._id + ' — skipping notification');
        }

        res.json({
            code: '1',
            message: req.t('success') || 'Booking request created successfully',
            booking,
        });

    } catch (error) {
        console.error('[bookCar] GENERAL ERROR:', error.message);
        if (error.name === 'CastError') {
            return next(createError.BadRequest('Invalid carId or other ID format.'));
        }
        next(error);
    }
};

exports.tempPayment = async (req, res, next) => {
    try {
        const [request, charge] = await Promise.all([
            BookingReq.findById(req.body.requestId)
                .populate('car')
                .populate('driver', 'name fcmToken')
                .lean(),
            Charges.findOne(),
        ]);

        if (!request || request.status !== 'accepted')
            return next(createError.BadRequest('Invalid requestId.'));

        const { _id, ...requestData } = request;

        // Calculate days
        const bookedFrom = new Date(request.bookedFrom);
        const bookedTo = new Date(request.bookedTo);
        bookedFrom.setHours(0, 0, 0, 0);
        bookedTo.setHours(0, 0, 0, 0);
        const days =
            Math.ceil((bookedTo - bookedFrom) / (1000 * 60 * 60 * 24)) + 1;
        if (days <= 0)
            return next(createError.BadRequest('Invalid booking dates.'));

        // Calculate the total rent price
        let price = request.car.price * days;
        if (request.deliveryOption == 'delivery')
            price += charge.carDeliveringFee;
        requestData.price = price;
        requestData.bookingReq = req.body.requestId;

        // Set payment status to completed
        requestData.paymentStatus = 'completed';
        requestData.paymentMethod = req.body.paymentMethod || 'cash';
        requestData.paidAt = new Date();

        const booking = await Booking.create(requestData);

        // Update BookingReq status to completed with payment info
        await BookingReq.findByIdAndUpdate(_id, {
            status: 'completed',
            paymentStatus: 'completed',
            paymentMethod: req.body.paymentMethod || 'cash',
            paidAt: new Date()
        }).catch(error => console.log('Error updating booking request: ', error));

        // Notify user about successful booking completion
        const data = {
            user: req.user.id,
            car: request.car._id,
            bookingId: booking._id,
            title: 'Booking Confirmed',
            body: `Your booking for ${request.car.name} has been successfully completed. Enjoy your ride!`,
        };
        sendNotification(req.user.fcmToken, data);

        // FIX: Notify driver about completed payment
        const driverData = {
            driver: request.driver._id,
            car: request.car._id,
            bookingId: booking._id,
            title: 'Payment Received',
            body: `Payment completed for ${request.car.name} booking by ${req.user.name}.`,
        };
        sendNotification(request.driver.fcmToken, driverData);

        booking.bookingReq = undefined;

        res.json({ code: '1', message: req.t('success'), booking });
    } catch (error) {
        next(error);
    }
};

exports.getFavorites = async (req, res, next) => {
    try {
        await req.user.populate({
            path: 'favorites',
            match: { isDeleted: false },
            select: 'name price pics rating',
            options: { lean: true },
            populate: { path: 'type' },
        });

        const favorites = req.user.favorites.map(car => {
            return {
                ...car,
                isFavorite: true,
                type: multilingual(car.type, req).name,
            };
        });

        favorites.reverse();

        res.json({
            code: '1',
            message: req.t('success'),
            favorites,
        });
    } catch (error) {
        next(error);
    }
};

exports.toggleFavorite = async (req, res, next) => {
    try {
        const car = await Car.findById(req.body.id);
        if (!car) return next(createError.NotFound('Car not found.'));

        const user = req.user;

        const carIndex = user.favorites.indexOf(car.id);
        if (carIndex !== -1) user.favorites.splice(carIndex, 1);
        else user.favorites.push(car.id);

        await user.save();

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.NotFound('Car not found.'));
        next(error);
    }
};

exports.addRating = async (req, res, next) => {
    try {
        const { carId, rating: newRating, comment } = req.body;

        let updatedRating = await Rating.findOne({
            car: carId,
            user: req.user.id,
        });

        if (updatedRating) {
            updatedRating.rating = newRating;
            updatedRating.comment = comment;
        } else {
            updatedRating = new Rating({
                car: carId,
                user: req.user.id,
                rating: newRating,
                comment,
            });
        }
        await updatedRating.save();

        Rating.aggregate([
            { $match: { car: updatedRating.car } },
            { $group: { _id: '$car', averageRating: { $avg: '$rating' } } },
        ]).then(averageRatings => {
            const averageRating = averageRatings[0].averageRating.toFixed(1);
            Car.findByIdAndUpdate(carId, { rating: averageRating }).exec();
        });

        res.json({
            code: '1',
            message: req.t('rating.added'),
            rating: updatedRating,
        });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.BadRequest('Invalid carId.'));
        next(error);
    }
};

// exports.getBookings = async (req, res, next) => {
//     try {
//         const currentDate = new Date();
//         const type = req.params.type; // 'current' or 'past'

//         let queryOptions;

//         if (type === 'current') {
//             // FIX: Show only accepted bookings with completed payment that haven't ended yet
//             queryOptions = {
//                 user: req.user.id,
//                 status: { $in: ['accepted', 'completed'] },
//                 paymentStatus: 'completed', // Only show paid bookings
//                 bookedTo: { $gte: currentDate }
//             };
//         } else if (type === 'past') {
//             // FIX: Show completed bookings that have ended
//             queryOptions = {
//                 user: req.user.id,
//                 status: { $in: ['accepted', 'completed', 'cancelled'] },
//                 paymentStatus: 'completed', // Only show paid bookings
//                 bookedTo: { $lt: currentDate }
//             };
//         } else {
//             return next(createError.BadRequest('Invalid type parameter'));
//         }

//         const bookings = await BookingReq.find(queryOptions)
//             .populate('user', 'profile name email country_code phone')
//             .populate('car', 'name pics price kmsDriven model')
//             .populate('driver', 'name phone')
//             .select('-__v')
//             .sort('-_id')
//             .lean();

//         const carIds = [...new Set(bookings.map(booking => booking.car._id))];
//         const ratings = await Rating.find({
//             car: { $in: carIds },
//             user: req.user.id,
//         })
//             .select('car rating comment')
//             .lean();

//         // Extracting the first image from the 'pics' array
//         bookings.forEach(booking => {
//             if (booking.car.pics) booking.car.pic = booking.car.pics[0];
//             delete booking.car.pics;
//             const rating = ratings.find(r => r.car.equals(booking.car._id));
//             booking.rating = rating ? rating.rating : null;
//             booking.comment = rating ? rating.comment : null;

//             // Add payment status info
//             booking.isPaid = booking.paymentStatus === 'completed';
//         });

//         res.json({ 
//             code: '1', 
//             message: req.t('success'), 
//             bookings,
//             count: bookings.length 
//         });
//     } catch (error) {
//         next(error);
//     }
// };

exports.getBookings = async (req, res, next) => {
    try {
        const currentDate = new Date();
        const type = req.params.type; // 'current' or 'past'

        if (!['current', 'past'].includes(type)) {
            return next(createError.BadRequest('Invalid type parameter. Use "current" or "past"'));
        }

        let queryOptions = {
            user: req.user.id,
            paymentStatus: 'completed',
        };

        if (type === 'current') {
            // Ongoing or upcoming – signatures may not be complete yet
            queryOptions.status = { $in: ['accepted', 'completed'] };
            queryOptions.bookedTo = { $gte: currentDate };
        } else if (type === 'past') {
            // Truly finished trips – require both signatures + payment
            queryOptions.status = { $in: ['completed', 'cancelled'] }; // or only 'completed' if you want
            queryOptions.bookedTo = { $lt: currentDate };

            // Key change: both signatures must be present
            queryOptions.$and = [
                { pickupSign: { $exists: true, $ne: null, $ne: "" } },
                { returnSign: { $exists: true, $ne: null, $ne: "" } }
            ];
        }

        const bookings = await Booking.find(queryOptions)
            .populate('user', 'profile name email country_code phone')
            .populate('car', 'name pics price kmsDriven model')
            .populate('driver', 'name phone')
            .select('-__v')
            .sort('-_id')
            .lean();

        const carIds = [...new Set(bookings.map(booking => booking.car._id))];

        const ratings = await Rating.find({
            car: { $in: carIds },
            user: req.user.id,
        })
            .select('car rating comment')
            .lean();

        // Process each booking
        bookings.forEach(booking => {

            booking.bookingId = booking._id;
            // First photo
            if (booking.car.pics?.length > 0) {
                booking.car.pic = booking.car.pics[0];
            }
            delete booking.car.pics;

            // Rating
            const rating = ratings.find(r => r.car.equals(booking.car._id));
            booking.rating = rating ? rating.rating : null;
            booking.comment = rating ? rating.comment : null;

            // Payment & completion flags
            booking.isPaid = booking.paymentStatus === 'completed';
            booking.hasPickupSign = !!booking.pickupSign && booking.pickupSign.trim() !== '';
            booking.hasReturnSign = !!booking.returnSign && booking.returnSign.trim() !== '';
            booking.isFullyCompleted = booking.isPaid && booking.hasPickupSign && booking.hasReturnSign;
        });

        res.json({
            code: '1',
            message: req.t('success') || 'Bookings fetched successfully',
            type,
            bookings,
            count: bookings.length
        });

    } catch (error) {
        console.error('getBookings error:', error);
        next(error);
    }
};

exports.getHistory = async (req, res, next) => {
    try {
        // Temp
        const history = [
            {
                type: 'Refund',
                amount: 39,
                Date: '2023-08-14T10:33:25.864Z',
                method: 'Cash',
            },
            {
                type: 'Paid',
                amount: 249,
                Date: '2023-08-10T14:46:25.864Z',
                method: 'Card',
            },
            {
                type: 'Paid',
                amount: 120,
                Date: '2023-07-25T09:14:41.773Z',
                method: 'Card',
            },
        ];

        res.json({ code: '1', message: req.t('success'), history });
    } catch (error) {
        next(error);
    }
};

// exports.cancelBooking = async (req, res, next) => {
//     try {
//         const booking = await BookingReq.findOne({
//             _id: req.body.id,
//             user: req.user.id,
//             status: { $in: ['requested', 'accepted'] }, // Can cancel if requested or accepted
//         }).populate('driver', 'name fcmToken');

//         if (!booking) 
//             return next(createError.NotFound('Booking not found or already processed!'));

//         // Check if payment was completed - handle refund logic if needed
//         const needsRefund = booking.paymentStatus === 'completed';

//         booking.status = 'cancelled';
//         booking.reason = req.body.reason;
//         if (needsRefund) {
//             booking.paymentStatus = 'refunded';
//             // TODO: Implement actual refund logic here
//         }
//         await booking.save();

//         // Also update Booking model if it exists
//         const mainBooking = await Booking.findOne({
//             user: booking.user,
//             car: booking.car,
//             driver: booking.driver,
//             bookedFrom: booking.bookedFrom,
//             bookedTo: booking.bookedTo,
//         });

//         if (mainBooking) {
//             mainBooking.status = 'cancelled';
//             mainBooking.reason = req.body.reason;
//             if (needsRefund) {
//                 mainBooking.paymentStatus = 'refunded';
//             }
//             await mainBooking.save();
//         }

//         // Notify driver
//         const data = {
//             driver: booking.driver._id,
//             car: booking.car,
//             requestId: booking._id,
//             title: 'Booking Cancelled',
//             body: `${req.user.name} has cancelled their booking. Reason: ${req.body.reason}.${needsRefund ? ' Refund will be processed.' : ''}`,
//         };
//         sendNotification(booking.driver.fcmToken, data);

//         res.json({ 
//             code: '1', 
//             message: req.t('success'),
//             refundInitiated: needsRefund 
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// exports.uploadSignature = async (req, res, next) => {
//     try {
//         // 1. Validate file
//         if (!req.file) {
//             return next(createError.BadRequest('Please upload signature.'));
//         }

//         // 2. Generate public URL from Multer filename
//         const signatureUrl = `/uploads/${req.file.filename}`;

//         // 3. Build update object
//         const update = req.params.type === 'pickup'
//             ? { pickupCheck: true, pickupSign: signatureUrl }
//             : { returnCheck: true, returnSign: signatureUrl };

//         // 4. Update Booking
//         const booking = await Booking.findByIdAndUpdate(
//             req.body.bookingId,
//             update,
//             { new: true }
//         );

//         if (!booking) {
//             // Delete file if booking not found
//             deleteFile(req.file.path);
//             return next(createError.NotFound('Booking not found.'));
//         }

//         // 5. Update Booking Request
//         await BookingReq.findByIdAndUpdate(booking.bookingReq, update);

//         // 6. Success
//         res.json({ code: '1', message: req.t('success') });

//     } catch (error) {
//         // 7. Cleanup on error
//         if (req.file) {
//             deleteFile(req.file.path);
//         }
//         next(error);
//     }
// };

// exports.cancelBooking = async (req, res, next) => {
//     try {
//         const { id, reason } = req.body;

//         if (!id) {
//             return next(createError.BadRequest('Booking ID is required'));
//         }

//         const cancelReason = reason?.trim() || 'No reason provided';

//         // Find and populate driver
//         const booking = await BookingReq.findOne({
//             _id: id,
//             user: req.user.id,
//             status: { $in: ['requested', 'accepted'] },
//         }).populate('driver', 'name fcmToken');

//         if (!booking) {
//             return next(createError.NotFound('Booking not found, already processed, or you are not the owner'));
//         }

//         // Debug population
//         console.log('[CANCEL DEBUG] Driver populated:', {
//             driverId: booking.driver?._id?.toString(),
//             driverName: booking.driver?.name,
//             hasFcmToken: !!booking.driver?.fcmToken,
//             fcmTokenPreview: booking.driver?.fcmToken?.substring(0, 15) || 'MISSING'
//         });

//         const needsRefund = booking.paymentStatus === 'completed';

//         booking.status = 'cancelled';
//         booking.reason = cancelReason;
//         // Optional: booking.cancelledBy = req.user.id;
//         if (needsRefund) {
//             booking.paymentStatus = 'refunded';
//             // TODO: actual refund
//         }
//         await booking.save();

//         // Update main Booking if exists (your existing logic)
//         await Booking.findOneAndUpdate(
//             { bookingReq: booking._id },
//             {
//                 status: 'cancelled',
//                 reason: cancelReason,
//                 paymentStatus: needsRefund ? 'refunded' : booking.paymentStatus,
//             }
//         );

//         // ── Notify driver ────────────────────────────────────────────────
//         if (booking.driver?.fcmToken) {
//             const data = {
//                 bookingId: booking._id.toString(),
//                 userId: req.user.id.toString(),
//                 title: 'Booking Cancelled by User',
//                 body: `${req.user.name} has cancelled the booking. Reason: ${cancelReason}${needsRefund ? ' (Refund will be processed)' : ''}`,
//                 reason: cancelReason,
//                 needsRefund,
//                 type: 'booking_cancelled_by_user',
//             };

//             try {
//                 console.log('[CANCEL NOTIFY] Sending to driver token:', booking.driver.fcmToken.substring(0, 15) + '...');
//                 const response = await sendNotification(booking.driver.fcmToken, data);
//                 console.log('[CANCEL NOTIFY] Success → Message ID:', response);
//             } catch (notifErr) {
//                 console.error('[CANCEL NOTIFY] Failed to send to driver:');
//                 console.error('  Error code:', notifErr.code);
//                 console.error('  Message:', notifErr.message);
//                 // Do NOT throw — cancellation should succeed even if notification fails
//             }
//         } else {
//             console.warn('[CANCEL NOTIFY] Driver has NO FCM token → notification skipped');
//             console.warn('  Driver ID:', booking.driver?._id?.toString());
//         }

//         res.json({
//             code: '1',
//             message: 'Booking cancelled successfully',
//             refundInitiated: needsRefund,
//             reason: cancelReason
//         });
//     } catch (error) {
//         console.error('[CANCEL BOOKING] Error:', error.message);
//         next(error);
//     }
// };

exports.cancelBooking = async (req, res, next) => {
    try {
        const { id, reason } = req.body;

        if (!id) {
            console.log('[USER CANCEL] Error: Booking ID is required');
            return next(createError.BadRequest('Booking ID is required'));
        }

        const cancelReason = reason?.trim() || 'No reason provided';

        console.log(`[USER CANCEL] Request received - BookingID: ${id}, UserID: ${req.user.id}`);

        // Find and populate driver
        const booking = await BookingReq.findOne({
            _id: id,
            user: req.user.id,
            status: { $in: ['requested', 'accepted'] },
        }).populate('driver', 'name fcmToken');

        if (!booking) {
            console.log(`[USER CANCEL] Booking not found or not allowed - ID: ${id}, User: ${req.user.id}`);
            return next(createError.NotFound('Booking not found, already processed, or you are not the owner'));
        }

        console.log(`[USER CANCEL] Booking found - Status: ${booking.status}, Driver: ${booking.driver?._id}`);

        const needsRefund = booking.paymentStatus === 'completed';

        booking.status = 'cancelled';
        booking.reason = cancelReason;
        if (needsRefund) {
            booking.paymentStatus = 'refunded';
            // TODO: actual refund
        }
        await booking.save();

        // Update main Booking
        const mainUpdate = await Booking.findOneAndUpdate(
            { bookingReq: booking._id },
            {
                status: 'cancelled',
                reason: cancelReason,
                paymentStatus: needsRefund ? 'refunded' : booking.paymentStatus,
            }
        );

        if (mainUpdate) {
            console.log(`[USER CANCEL] Main Booking updated successfully`);
        }

        // ── Notify Driver ────────────────────────────────────────────────
        if (booking.driver?.fcmToken) {
            const notificationData = {
                bookingId: booking._id.toString(),
                userId: req.user.id.toString(),
                title: 'Booking Cancelled by User',
                body: `${req.user.name} has cancelled the booking. Reason: ${cancelReason}${needsRefund ? ' (Refund will be processed)' : ''}`,
                reason: cancelReason,
                needsRefund,
                type: 'booking_cancelled_by_user',
            };

            console.log(`[USER CANCEL NOTIFY] Sending to Driver - Token: ${booking.driver.fcmToken.substring(0, 15)}...`);
            console.log(`[USER CANCEL NOTIFY] BookingID: ${booking._id}, DriverID: ${booking.driver._id}`);

            try {
                const response = await sendNotification(booking.driver.fcmToken, notificationData);
                console.log(`[USER CANCEL NOTIFY] SUCCESS → Message ID: ${response}`);
            } catch (notifErr) {
                console.error(`[USER CANCEL NOTIFY] FAILED:`);
                console.error(`  Error Code : ${notifErr.code || 'UNKNOWN'}`);
                console.error(`  Message    : ${notifErr.message}`);
                console.error(`  BookingID  : ${booking._id}`);
                // Notification fail hone par bhi cancellation success rahega
            }
        } else {
            console.warn(`[USER CANCEL NOTIFY] Driver has NO FCM Token! DriverID: ${booking.driver?._id}`);
        }

        res.json({
            code: '1',
            message: 'Booking cancelled successfully',
            refundInitiated: needsRefund,
            reason: cancelReason
        });

    } catch (error) {
        console.error(`[USER CANCEL ERROR] BookingID: ${req.body.id}, Error:`, error.message);
        console.error(error); // full stack trace ke liye
        next(error);
    }
};

exports.uploadSignature = async (req, res, next) => {
    try {
        // 1. Validate file
        if (!req.file) {
            return next(createError.BadRequest('Please upload signature.'));
        }

        // 2. Generate public URL from Multer filename
        const signatureUrl = `/uploads/${req.file.filename}`;

        // 3. Build update object
        const update = req.params.type === 'pickup'
            ? { pickupCheck: true, pickupSign: signatureUrl }
            : { returnCheck: true, returnSign: signatureUrl };

        // 4. Update Booking
        const booking = await Booking.findByIdAndUpdate(
            req.body.bookingId,
            update,
            { new: true }
        );

        if (!booking) {
            // Delete file if booking not found
            deleteFile(req.file.path);
            return next(createError.NotFound('Booking not found.'));
        }

        // 5. Update Booking Request
        await BookingReq.findByIdAndUpdate(booking.bookingReq, update);

        // 6. Success
        res.json({ code: '1', message: req.t('success') });

    } catch (error) {
        // 7. Cleanup on error
        if (req.file) {
            deleteFile(req.file.path);
        }
        next(error);
    }
};

