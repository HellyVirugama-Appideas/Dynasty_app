const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');
const deleteFile = require('../../utils/deleteFile');
const sendNotification = require('../../utils/sendNotification');

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
                    $maxDistance: 10000, // radiusInMeters
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

exports.carDetail = async (req, res, next) => {
    try {
        const carId = req.params.id;
        const currentDate = new Date();

        const [car, ratings, request, bookings, charge] = await Promise.all([
            Car.findById(carId)
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

        if (!car) return next(createError.BadRequest('Invalid car id.'));

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

exports.bookCar = async (req, res, next) => {
    try {
        const bookedFrom = new Date(req.body.dateFrom);
        const bookedTo = new Date(req.body.dateTo);

        if (isNaN(bookedFrom.getTime()) || isNaN(bookedTo.getTime()))
            return next(createError.BadRequest('Invalid date format'));

        const currentDate = new Date();
        if (bookedFrom <= currentDate || bookedTo <= currentDate)
            return next(createError.BadRequest('Dates must be in the future.'));

        if (bookedTo <= bookedFrom)
            return next(
                createError.BadRequest(
                    'To date should be greater than From date.'
                )
            );

        const car = await Car.findById(req.body.carId).populate(
            'driver',
            'address fcmToken'
        );
        if (!car) return next(createError.BadRequest('Invalid carId.'));

        // Check if the car is already booked within the requested period
        const overlappingBooking = await Booking.findOne({
            car: req.body.carId,
            bookedFrom: { $lt: bookedTo },
            bookedTo: { $gt: bookedFrom },
        });
        if (overlappingBooking)
            return next(createError.Conflict('rent.already'));

        const { deliveryOption } = req.body;
        let address;
        if (deliveryOption === 'delivery') address = req.body.address;
        else if (deliveryOption === 'pickup') address = car.driver.address;
        else return next(createError.BadRequest('Invalid delivery option.'));

        const booking = await BookingReq.create({
            user: req.user.id,
            car: req.body.carId,
            driver: car.driver,
            deliveryOption,
            address,
            bookedFrom,
            bookedTo,
            pickupTime: req.body.pickupTime,
            returnTime: req.body.returnTime,
        });

        // Notify driver
        const data = {
            driver: car.driver,
            car: req.body.carId,
            requestId: booking.id,
            title: 'New Booking Request',
            body: 'You have a new booking request. Please review and respond.',
        };
        sendNotification(car.driver.fcmToken, data);

        res.json({ code: '1', message: req.t('success'), booking });
    } catch (error) {
        if (error.name === 'CastError')
            return next(createError.BadRequest('Invalid carId.'));
        next(error);
    }
};

exports.tempPayment = async (req, res, next) => {
    try {
        const [request, charge] = await Promise.all([
            BookingReq.findById(req.body.requestId).populate('car').lean(),
            Charges.findOne(),
        ]);
        if (!request || request.status !== 'accepted')
            return next(createError.BadRequest('Invalid requestId.'));

        const { _id, ...requestData } = request;

        // Calculate days
        const { bookedFrom, bookedTo } = request;
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

        const booking = await Booking.create(requestData);

        await BookingReq.findByIdAndUpdate(_id, { status: 'completed' }).catch(
            error => console.log('Error updating booking: ', error)
        );

        // Notify user
        const data = {
            user: req.user.id,
            car: request.car,
            requestId: request.id,
            title: 'Booking has been completed.',
            body: 'Your booking has been successfully completed. Thank you for using our service!',
        };
        sendNotification(req.user.fcmToken, data);

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

exports.getBookings = async (req, res, next) => {
    try {
        const currentDate = new Date();
        const queryOptions = {
            status: 'accepted',
            user: req.user.id,
            bookedTo:
                req.params.type === 'current'
                    ? { $gte: currentDate }
                    : { $lt: currentDate },
        };

        const bookings = await Booking.find(queryOptions)
            .populate('user', 'profile name email country_code phone')
            .populate('car', 'name pics price kmsDriven model')
            .select('-__v -status')
            .sort('-_id')
            .lean();

        const carIds = [...new Set(bookings.map(booking => booking.car._id))];
        const ratings = await Rating.find({
            car: { $in: carIds },
            user: req.user.id,
        })
            .select('car rating comment')
            .lean();

        // Extracting the first image from the 'pics' array
        bookings.forEach(booking => {
            if (booking.car.pics) booking.car.pic = booking.car.pics[0];
            delete booking.car.pics;
            const rating = ratings.find(r => r.car.equals(booking.car._id));
            booking.rating = rating ? rating.rating : null;
            booking.comment = rating ? rating.comment : null;
        });

        res.json({ code: '1', message: req.t('success'), bookings });
    } catch (error) {
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

exports.cancelBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findOne({
            _id: req.body.id,
            user: req.user.id,
            status: 'accepted',
        });
        if (!booking) return next(createError.NotFound('Booking not found!'));

        booking.status = 'cancelled';
        booking.reason = req.body.reason;
        await booking.save();

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        next(error);
    }
};

exports.uploadSignature = async (req, res, next) => {
    try {
        if (!req.file)
            return next(createError.BadRequest('Please upload signature.'));

        let update = {};
        if (req.params.type === 'pickup')
            update = {
                pickupCheck: true,
                pickupSign: `/uploads/${req.file.filename}`,
            };
        else
            update = {
                returnCheck: true,
                returnSign: `/uploads/${req.file.filename}`,
            };

        await Booking.findByIdAndUpdate(req.body.bookingId, update);

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        if (req.file) deleteFile(`/uploads/${req.file.filename}`);
        next(error);
    }
};
