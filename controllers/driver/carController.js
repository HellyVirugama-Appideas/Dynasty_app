const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');
const deleteFile = require('../../utils/deleteFile');

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
        const cars = await Car.find({ driver: req.driver.id, isDeleted: false })
            .select('-driver')
            .sort('-_id');

        res.json({ code: '1', message: req.t('success'), cars });
    } catch (error) {
        next(error);
    }
};

exports.createCar = async (req, res, next) => {
    try {
        if (!req.files?.pics || req.files.pics.length === 0)
            throw createError.BadRequest('carImage.pics');
        if (!req.files?.purchaseBill)
            throw createError.BadRequest('carImage.purchaseBill');
        if (!req.files?.insurance)
            throw createError.BadRequest('carImage.insurance');
        if (!req.files?.rc) throw createError.BadRequest('carImage.rc');

        req.body.pics = req.files.pics.map(file => `/uploads/${file.filename}`);
        req.body.purchaseBill = `/uploads/${req.files.purchaseBill[0].filename}`;
        req.body.insurance = `/uploads/${req.files.insurance[0].filename}`;
        req.body.rc = `/uploads/${req.files.rc[0].filename}`;

        const { latitude, longitude } = req.body;
        if (!latitude || !longitude)
            throw createError.BadRequest('Invalid latitude longitude.');
        req.body.location = {
            type: 'Point',
            coordinates: [longitude, latitude],
        };

        req.body.driver = req.driver.id;
        let car = await Car.create(req.body);

        await car.populate('type');
        car = car._doc;
        car.type = multilingual(car.type, req).name;

        res.json({ code: '1', message: req.t('car.added'), car });
    } catch (error) {
        // Remove files
        if (req.files.pics)
            req.files.pics.forEach(file =>
                deleteFile(`/uploads/${file.filename}`)
            );
        if (req.files.purchaseBill)
            deleteFile(`/uploads/${req.files.purchaseBill[0].filename}`);
        if (req.files.insurance)
            deleteFile(`/uploads/${req.files.insurance[0].filename}`);
        if (req.files.rc) deleteFile(`/uploads/${req.files.rc[0].filename}`);

        next(error);
    }
};

exports.editCar = async (req, res, next) => {
    try {
        const { latitude, longitude } = req.body;
        if (latitude && longitude)
            req.body.location = {
                type: 'Point',
                coordinates: [longitude, latitude],
            };

        const car = await Car.findOneAndUpdate(
            { _id: req.params.id, driver: req.driver.id, isDeleted: false },
            req.body,
            { new: true }
        ).select('-__v -driver -type');
        if (!car) return next(createError.NotFound('Car not found.'));

        res.json({ code: '1', message: req.t('car.edited'), car });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.NotFound('Car not found.'));
        next(error);
    }
};

exports.deleteCar = async (req, res, next) => {
    try {
        const car = await Car.findOneAndUpdate(
            { _id: req.params.id, driver: req.driver.id, isDeleted: false },
            { isDeleted: true }
        );

        if (!car) return next(createError.NotFound('Car not found.'));

        res.json({ code: '1', message: req.t('car.deleted') });
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
            { _id: req.body.carId, driver: req.driver.id, isDeleted: false },
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

        deleteFile(req.body.pic);

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.NotFound('Car not found.'));
        next(error);
    }
};
