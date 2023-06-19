const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');

const Car = require('../../models/carModel');
const Booking = require('../../models/bookingModel');
const BookingReq = require('../../models/bookingReqModel');
const User = require('../../models/userModel');
const Rating = require('../../models/ratingModel');
const Notification = require('../../models/notificationModel');

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

            // Find the cars that are not booked within the date range
            const bookedCarIds = await Booking.distinct('car', {
                bookedFrom: { $lt: dateTo },
                bookedTo: { $gt: dateFrom },
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
                isFavourite: req.user.favorites.includes(car._id),
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

        const [car, ratings, request] = await Promise.all([
            Car.findById(req.params.id)
                .populate('driver', 'profile name')
                .select('-__v -location -type')
                .lean(),
            Rating.find({ car: carId })
                .populate('user', 'name')
                .select('-__v -car')
                .lean(),
            BookingReq.exists({
                car: carId,
                user: req.user.id,
                status: 'requested',
            }),
        ]);

        if (!car) return next(createError.BadRequest('Invalid car id.'));

        car.isFavourite = req.user.favorites.includes(car._id);
        car.ratings = ratings;
        car.requested = request ? true : false;

        res.json({ code: '1', message: req.t('success'), car });
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
        if (bookedFrom < currentDate || bookedTo < currentDate)
            return next(createError.BadRequest('Dates must be in the future.'));

        const car = await Car.findById(req.body.carId).populate(
            'driver',
            'address'
        );
        if (!car) return next(createError.BadRequest('Invalid carId.'));

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
        });

        // Notify driver

        Notification.create({
            driver: car.driver,
            message: 'New booking request.',
        }).catch(error => {
            console.log('Error creating notification: ', error);
        });

        res.json({ code: '1', message: req.t('success'), booking });
    } catch (error) {
        if (error.name === 'CastError')
            return next(createError.BadRequest('Invalid carId.'));
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
                isFavourite: true,
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

exports.addToFavorites = async (req, res, next) => {
    try {
        const car = await Car.findById(req.body.id);
        if (!car) return next(createError.NotFound('Car not found.'));

        await User.findByIdAndUpdate(req.user.id, {
            $addToSet: { favorites: req.body.id },
        });

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.NotFound('Car not found.'));
        next(error);
    }
};

exports.removeFromFavorites = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.user.id, {
            $pull: { favorites: req.body.id },
        });

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

        const updatedRating = await Rating.findOne({
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
