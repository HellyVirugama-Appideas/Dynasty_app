const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');

const Car = require('../../models/carModel');
const Booking = require('../../models/bookingModel');
const User = require('../../models/userModel');

exports.listCars = async (req, res, next) => {
    try {
        // Filter
        const filter = {};

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
            .select('name price')
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
        if (error.name == 'CastError')
            return next(createError.BadRequest('Invalid city id.'));
        next(error);
    }
};

exports.getFavorites = async (req, res, next) => {
    try {
        await req.user.populate('favorites');

        res.json({
            code: '1',
            message: req.t('success'),
            favorites: req.user.favorites,
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
