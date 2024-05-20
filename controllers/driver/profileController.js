const multilingual = require('../../utils/multilingual');
const multilingualUser = require('../../utils/multilingualUser');
const deleteFile = require('../../utils/deleteFile');

const Driver = require('../../models/driverModel');
const Car = require('../../models/carModel');
const Country = require('../../models/countryModel');
const City = require('../../models/cityModel');

exports.getProfile = async (req, res, next) => {
    try {
        await req.driver.populate('city country');
        const driver = multilingualUser(req.driver, req);

        if (driver.location.coordinates) {
            driver.latitude = driver.location.coordinates[1];
            driver.longitude = driver.location.coordinates[0];
        }

        // Hide fields
        driver.blocked = undefined;
        driver.location = undefined;

        res.json({ code: '1', message: req.t('success'), driver });
    } catch (error) {
        next(error);
    }
};

exports.editProfile = async (req, res, next) => {
    try {
        // Properties not allowed to change
        const disallowedProperties = [
            'country_code',
            'phone',
            'googleId',
            'facebookId',
            'appleId',
            'profile',
            'licence',
            'pan',
            'rc',
        ];
        disallowedProperties.forEach(property => {
            delete req.body[property];
        });

        let oldProfile;
        if (req.file) {
            oldProfile = req.driver.profile;
            req.body.profile = `/uploads/${req.file.filename}`;
        }

        let driver = await Driver.findByIdAndUpdate(req.driver.id, req.body, {
            new: true,
        }).populate('city country');

        // remove old images
        if (oldProfile && oldProfile !== '/uploads/default_user.jpg')
            deleteFile(oldProfile);

        driver = multilingualUser(driver, req);

        if (driver.location.coordinates) {
            driver.latitude = driver.location.coordinates[1];
            driver.longitude = driver.location.coordinates[0];
        }

        // Hide fields
        driver.location = undefined;

        res.json({ code: '1', message: req.t('success'), driver });
    } catch (error) {
        next(error);
    }
};

exports.deleteProfile = async (req, res, next) => {
    try {
        const driver = await Driver.findByIdAndUpdate(req.driver.id, {
            isDeleted: true,
        });
        if (!driver) return next(createError.Unauthorized('Driver not found!'));

        await Car.findOneAndUpdate(
            { driver: req.driver.id, isDeleted: false },
            { isDeleted: true }
        );

        const suffix = uniqueSuffix();

        await Driver.findByIdAndUpdate(req.driver.id, {
            email: driver.email + `${suffix}`,
        });

        res.json({ code: '1', message: req.t('deleted') });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.NotFound('Driver not found.'));
        next(error);
    }
};

exports.getSelectCountryCity = async (req, res, next) => {
    try {
        await req.driver.populate('city country');
        const driver = multilingualUser(req.driver, req);

        res.json({
            code: '1',
            message: req.t('success'),
            data: { city: driver.city, country: driver.country },
        });
    } catch (error) {
        next(error);
    }
};

exports.postSelectCountryCity = async (req, res, next) => {
    try {
        // get city and country by id
        const { city_id, country_id } = req.body;
        const [city, country] = await Promise.all([
            City.findOne({ city_id }),
            Country.findOne({ country_id }),
        ]);
        if (!city) return next(createError.BadRequest('Invalid city_id'));
        if (!country) return next(createError.BadRequest('Invalid country_id'));

        // update driver
        let driver = req.driver;
        driver.city = city.id;
        driver.country = country.id;
        await driver.save();

        res.json({
            code: '1',
            message: req.t('success'),
            data: {
                city: multilingual(city, req).name,
                country: multilingual(country, req).name,
            },
        });
    } catch (error) {
        next(error);
    }
};

const uniqueSuffix = () => {
    const random = Math.random().toString(36).substr(2, 3);
    return `_deleted_${random}`;
};
