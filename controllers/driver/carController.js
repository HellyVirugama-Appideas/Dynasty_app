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
        let cars = await Car.find({ driver: req.driver.id, isDeleted: false })
            .select('-driver -__v')
            .sort('-_id')
            .lean();

        cars = cars.map(car => {
            const updatedPics = car.pics.map(pic => {
                if (pic === '/uploads/car_404.jpg')
                    return { pic, status: null };
                else return { pic, status: 0 };
            });
            return { ...car, pics: updatedPics };
        });

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

        const pics = await Promise.all(
            req.files.pics.map(async file => {
                const result = await S3.uploadFile(file);
                return result.Location;
            })
        );
        const [purchaseBillResult, insuranceResult, rcResult] =
            await Promise.all([
                S3.uploadFile(req.files.purchaseBill[0]),
                S3.uploadFile(req.files.insurance[0]),
                S3.uploadFile(req.files.rc[0]),
            ]);

        req.body.pics = pics;
        req.body.purchaseBill = purchaseBillResult.Location;
        req.body.insurance = insuranceResult.Location;
        req.body.rc = rcResult.Location;

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
        next(error);
    }
};

exports.editCar = async (req, res, next) => {
    try {
        let pics = [];
        if (req.files?.length)
            pics = await Promise.all(
                req.files.map(async file => {
                    const result = await S3.uploadFile(file);
                    return result.Location;
                })
            );

        const updatedData = {
            name: req.body.name,
            condition: req.body.condition,
            kmsDriven: req.body.kmsDriven,
            price: req.body.price,
        };
        if (pics.length) updatedData.$push = { pics: { $each: pics } };

        const car = await Car.findOneAndUpdate(
            { _id: req.params.id, driver: req.driver.id, isDeleted: false },
            updatedData,
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
        if (req.files?.length)
            pics = await Promise.all(
                req.files.map(async file => {
                    const result = await S3.uploadFile(file);
                    return result.Location;
                })
            );

        const car = await Car.findOneAndUpdate(
            { _id: req.body.carId, driver: req.driver.id, isDeleted: false },
            { $push: { pics: { $each: pics } } },
            { new: true }
        );

        if (!car) return next(createError.NotFound('Car not found!'));

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

        if (req.body.pic !== '/uploads/car_404.jpg') deleteFile(req.body.pic);

        res.json({ code: '1', message: req.t('success') });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.NotFound('Car not found.'));
        next(error);
    }
};
