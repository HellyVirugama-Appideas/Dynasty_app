const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');

const Type = require('../../models/typeModel');
const Car = require('../../models/carModel');

exports.getVehicleTypes = async (req, res, next) => {
    try {
        let types = await Type.find({ typeFor: 'Taxi' }).select(
            '-__v -typeFor -distanceRate'
        );
        types = types.map(type => multilingual(type, req));

        res.json({ code: '1', message: req.t('success'), data: { types } });
    } catch (error) {
        next(error);
    }
};

exports.getCars = async (req, res, next) => {
    try {
        const cars = await Car.find({ driver: req.driver.id })
            .select('-driver')
            .sort('-_id');

        res.json({ code: '1', message: req.t('success'), cars });
    } catch (error) {
        next(error);
    }
};

exports.createCar = async (req, res, next) => {
    try {
        req.body.pics = req.files?.pics
            ? req.files.pics.map(file => `/uploads/${file.filename}`)
            : undefined;
        req.body.purchaseBill = req.files?.purchaseBill
            ? `/uploads/${req.files.purchaseBill[0].filename}`
            : undefined;
        req.body.insurance = req.files?.insurance
            ? `/uploads/${req.files.insurance[0].filename}`
            : undefined;
        req.body.rc = req.files?.rc
            ? `/uploads/${req.files.rc[0].filename}`
            : undefined;

        req.body.driver = req.driver.id;
        const car = await Car.create(req.body);

        res.json({ code: '1', message: req.t('car.added'), car });
    } catch (error) {
        next(error);
    }
};

exports.editCar = async (req, res, next) => {
    try {
        const car = await Car.findOneAndUpdate(
            { _id: req.params.id, driver: req.driver.id },
            req.body,
            { new: true }
        ).select('-__v -driver');
        if (!car) return next(createError.NotFound('Car not found.'));

        res.json({ code: '1', message: req.t('car.edited'), car });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.NotFound('Car not found.'));
        next(error);
    }
};

exports.addImage = async (req, res, next) => {
    try {
        let pics = [];
        if (req.files.length)
            req.files.map(file => pics.push(`/uploads/${file.filename}`));

        await Car.findOneAndUpdate(
            { _id: req.body.carId, driver: req.driver.id },
            { $push: { pics: { $each: pics } } },
            { new: true }
        );

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.NotFound('Car not found.'));
        next(error);
    }
};

exports.deleteImage = async (req, res, next) => {
    try {
        if (!req.body.pic)
            return next(createError.BadRequest('Please provide pic.'));

        await Car.findOneAndUpdate(
            { _id: req.body.carId, driver: req.driver.id },
            { $pull: { pics: req.body.pic } },
            { new: true }
        );

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.NotFound('Car not found.'));
        next(error);
    }
};
