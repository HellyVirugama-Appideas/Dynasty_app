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
        // 1. Validate required files
        if (!req.files?.pics || req.files.pics.length === 0)
            throw createError.BadRequest('carImage.pics');
        if (!req.files?.purchaseBill || !req.files.purchaseBill[0])
            throw createError.BadRequest('carImage.purchaseBill');
        if (!req.files?.insurance || !req.files.insurance[0])
            throw createError.BadRequest('carImage.insurance');
        if (!req.files?.rc || !req.files.rc[0])
            throw createError.BadRequest('carImage.rc');

        // 2. Generate URLs from Multer filenames
        const pics = req.files.pics.map(file => `/uploads/${file.filename}`);
        const purchaseBill = `/uploads/${req.files.purchaseBill[0].filename}`;
        const insurance = `/uploads/${req.files.insurance[0].filename}`;
        const rc = `/uploads/${req.files.rc[0].filename}`;

        // 3. Set to req.body
        req.body.pics = pics;
        req.body.purchaseBill = purchaseBill;
        req.body.insurance = insurance;
        req.body.rc = rc;

        // 4. Validate location
        const { latitude, longitude } = req.body;
        if (!latitude || !longitude)
            throw createError.BadRequest('Invalid latitude longitude.');

        req.body.location = {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
        };

        // 5. Set driver
        req.body.driver = req.driver.id;

        // 6. Create car
        let car = await Car.create(req.body);
        await car.populate('type');
        car = car._doc;
        car.type = multilingual(car.type, req).name;

        res.json({ code: '1', message: req.t('car.added'), car });

    } catch (error) {
        // 7. Delete uploaded files on error
        const files = [
            ...(req.files?.pics || []),
            ...(req.files?.purchaseBill || []),
            ...(req.files?.insurance || []),
            ...(req.files?.rc || [])
        ];
        files.forEach(file => deleteFile(file.path));

        next(error);
    }
};

exports.editCar = async (req, res, next) => {
    try {
        let pics = [];
        if (req.files?.pics?.length) {
            pics = req.files.pics.map(file => `/uploads/${file.filename}`);
        }

        const updatedData = {
            name: req.body.name,
            condition: req.body.condition,
            kmsDriven: req.body.kmsDriven,
            price: req.body.price,
        };

        if (pics.length) {
            updatedData.$push = { pics: { $each: pics } };
        }

        const car = await Car.findOneAndUpdate(
            { _id: req.params.id, driver: req.driver.id, isDeleted: false },
            updatedData,
            { new: true }
        ).select('-__v -driver -type');

        if (!car) {
            // Delete new pics on error
            if (req.files?.pics) {
                req.files.pics.forEach(file => deleteFile(file.path));
            }
            return next(createError.NotFound('Car not found.'));
        }

        res.json({ code: '1', message: req.t('car.edited'), car });

    } catch (error) {
        if (req.files?.pics) {
            req.files.pics.forEach(file => deleteFile(file.path));
        }
        if (error.name === 'CastError')
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
        if (!req.files || req.files.length === 0) {
            return next(createError.BadRequest('Please upload at least one image.'));
        }

        const pics = req.files.map(file => `/uploads/${file.filename}`);

        const car = await Car.findOneAndUpdate(
            { _id: req.body.carId, driver: req.driver.id, isDeleted: false },
            { $push: { pics: { $each: pics } } },
            { new: true }
        );

        if (!car) {
            req.files.forEach(file => deleteFile(file.path));
            return next(createError.NotFound('Car not found!'));
        }

        res.json({ code: '1', message: req.t('success') });

    } catch (error) {
        if (req.files) {
            req.files.forEach(file => deleteFile(file.path));
        }
        if (error.name === 'CastError')
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
