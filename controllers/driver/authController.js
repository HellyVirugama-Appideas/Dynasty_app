const { promisify } = require('util');
const createError = require('http-errors');
const validator = require('validator');
const multilingual = require('../../utils/multilingual');
const multilingualUser = require('../../utils/multilingualUser');
const jwt = require('jsonwebtoken');
// const { sendOTP } = require('../../utils/sendSMS');

const Driver = require('../../models/driverModel');
const OTP = require('../../models/otpModel');
const City = require('../../models/cityModel');
const Country = require('../../models/countryModel');
const Type = require('../../models/typeModel');

exports.checkDriver = async (req, res, next) => {
    try {
        const token = req.headers.token;

        if (!token) return next(createError.BadRequest('auth.provideToken'));

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let driver = await Driver.findById(decoded._id).select(
            '+blocked +password'
        );

        if (!driver) return next(createError.BadRequest('auth.login'));
        if (driver.blocked)
            return next(createError.Unauthorized('auth.blocked'));

        req.driver = driver;
        next();
    } catch (error) {
        next(error);
    }
};

exports.sendOTP = async (req, res, next) => {
    try {
        const { country_code, phone } = req.body;

        // validate mobile
        if (!country_code)
            return next(createError.BadRequest('validation.country_code'));
        if (!phone) return next(createError.BadRequest('validation.phone'));

        const mobile = country_code + phone;
        if (!validator.isMobilePhone(mobile, 'any', { strictMode: true }))
            return next(createError.BadRequest('validation.mobileInvalid'));

        // generate and save OTP
        const otp = generateCode(4);
        await OTP.updateOne(
            { mobile },
            { otp, expireAt: Date.now() + 5 * 60 * 1000 },
            { upsert: true }
        );

        // send OTP
        // await sendOTP(mobile, otp);

        res.json({
            code: '1',
            message: req.t('otp.sent'),
            result: {
                otp,
                country_code,
                phone,
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.verifyOTP = async (req, res, next) => {
    try {
        const { country_code, phone, otp } = req.body;
        const mobile = country_code + phone;

        // verify otp
        const otpVerified = await OTP.findOne({ mobile, otp });
        if (!otpVerified) return next(createError.BadRequest('otp.fail'));

        // if driver exists, login else send verifyToken
        let driver = await Driver.findOne({ country_code, phone })
            .select('-__v')
            .populate('city country');

        if (driver) {
            const token = await driver.generateAuthToken();

            driver = multilingualUser(driver, req);

            if (driver.location.coordinates) {
                driver.latitude = driver.location.coordinates[1];
                driver.longitude = driver.location.coordinates[0];
            }

            // Hide fields
            driver.location = undefined;

            return res.json({
                code: '1',
                message: req.t('loggedIn'),
                token,
                driver,
            });
        }

        // generate verifyToken
        const verifyToken = jwt.sign(
            { country_code, phone },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            code: '001',
            message: req.t('otp.verified'),
            verifyToken,
            country_code,
            phone,
        });
    } catch (error) {
        next(error);
    }
};

exports.createProfile = async (req, res, next) => {
    try {
        // verify verifyToken
        const decoded = await promisify(jwt.verify)(
            req.body.verifyToken,
            process.env.JWT_SECRET
        );
        if (!decoded.phone) return next(createError.BadRequest('phone.verify'));

        const { city_id, country_id } = req.body;
        const [city, country] = await Promise.all([
            City.findOne({ city_id }),
            Country.findOne({ country_id }),
        ]);
        if (!city) return next(createError.BadRequest('Invalid city_id'));
        if (!country) return next(createError.BadRequest('Invalid country_id'));

        // create driver
        let driver = await Driver.create({
            name: req.body.name,
            email: req.body.email,
            country_code: decoded.country_code,
            phone: decoded.phone,
            city: city.id,
            country: country.id,
            address: req.body.address,
        });

        const token = await driver.generateAuthToken();

        await driver.populate('city country');
        driver = multilingualUser(driver, req);

        // Hide fields
        driver.password = undefined;
        driver.__v = undefined;
        driver.location = undefined;

        res.status(201).json({
            code: '1',
            message: req.t('profile'),
            token,
            driver,
        });
    } catch (error) {
        if (error.name == 'JsonWebTokenError')
            return next(createError.BadRequest('token.invalid'));
        if (error.name == 'TokenExpiredError')
            return next(createError.BadRequest('token.expired'));
        next(error);
    }
};

exports.socialLogin = async (req, res, next) => {
    try {
        const { email, googleId, facebookId, appleId } = req.body;

        let driver = await Driver.findOne({ email }).populate('city country');

        // if driver exists, redirect to create profile screen
        if (!driver) {
            return res.json({
                code: '001',
                message: req.t('success'),
                data: { email, googleId, facebookId, appleId },
            });
        }

        if (googleId) {
            if (!driver.googleId) {
                const errorMessage = driver.facebookId
                    ? 'social.facebook'
                    : driver.appleId
                    ? 'social.apple'
                    : 'social.phone';
                return next(createError.BadRequest(errorMessage));
            }
            if (googleId !== driver.googleId) {
                return next(createError.BadRequest('social.invalidGoogle'));
            }
        }

        if (facebookId) {
            if (!driver.facebookId) {
                const errorMessage = driver.googleId
                    ? 'social.google'
                    : driver.appleId
                    ? 'social.apple'
                    : 'social.phone';
                return next(createError.BadRequest(errorMessage));
            }
            if (facebookId !== driver.facebookId) {
                return next(createError.BadRequest('social.invalidFacebook'));
            }
        }

        if (appleId) {
            if (!driver.appleId) {
                const errorMessage = driver.googleId
                    ? 'social.google'
                    : driver.facebookId
                    ? 'social.facebook'
                    : 'social.phone';
                return next(createError.BadRequest(errorMessage));
            }
            if (appleId !== driver.appleId) {
                return next(createError.BadRequest('social.invalidApple'));
            }
        }

        const token = await driver.generateAuthToken();
        driver = multilingualUser(driver, req);

        if (driver.location.coordinates) {
            driver.latitude = driver.location.coordinates[1];
            driver.longitude = driver.location.coordinates[0];
        }

        // Hide fields
        driver.password = undefined;
        driver.__v = undefined;
        driver.location = undefined;

        return res.json({
            code: '1',
            message: req.t('loggedIn'),
            token,
            driver,
        });
    } catch (error) {
        next(error);
    }
};

exports.createSocialProfile = async (req, res, next) => {
    try {
        const { city_id, country_id } = req.body;
        const [city, country] = await Promise.all([
            City.findOne({ city_id }),
            Country.findOne({ country_id }),
        ]);
        if (!city) return next(createError.BadRequest('Invalid city_id'));
        if (!country) return next(createError.BadRequest('Invalid country_id'));

        // create driver
        let driver = await Driver.create({
            name: req.body.name,
            email: req.body.email,
            country_code: req.body.country_code,
            phone: req.body.phone,
            city: city.id,
            country: country.id,
            address: req.body.address,
            googleId: req.body.googleId,
            facebookId: req.body.facebookId,
            appleId: req.body.appleId,
        });

        const token = await driver.generateAuthToken();

        await driver.populate('city country');
        driver = multilingualUser(driver, req);

        // Hide fields
        driver.password = undefined;
        driver.__v = undefined;
        driver.location = undefined;

        res.status(201).json({
            code: '1',
            message: req.t('profile'),
            token,
            driver,
        });
    } catch (error) {
        if (error.name == 'JsonWebTokenError')
            return next(createError.BadRequest('token.invalid'));
        if (error.name == 'TokenExpiredError')
            return next(createError.BadRequest('token.expired'));
        next(error);
    }
};

exports.getVehicleTypes = async (req, res, next) => {
    try {
        let types = await Type.find().select('-__v -typeFor -distanceRate');
        types = types.map(type => multilingual(type, req));

        res.json({ code: '1', message: req.t('success'), data: { types } });
    } catch (error) {
        next(error);
    }
};

exports.selectVehicleType = async (req, res, next) => {
    try {
        const type = await Type.findById(req.body.type);
        if (!type)
            return next(createError.BadRequest('Invalid vehicle type id.'));

        let driver = await Driver.findByIdAndUpdate(
            req.driver.id,
            { type: req.body.type },
            { new: true }
        ).populate('city country');

        driver = multilingualUser(driver, req);

        if (driver.location.coordinates) {
            driver.latitude = driver.location.coordinates[1];
            driver.longitude = driver.location.coordinates[0];
        }

        // Hide fields
        driver.location = undefined;
        driver.__v = undefined;

        res.json({ code: '1', message: req.t('success'), driver });
    } catch (error) {
        next(error);
    }
};

exports.getDocs = async (req, res, next) => {
    try {
        const driver = req.driver;

        const obj = { profile: 1, licence: 1, pan: 1, rc: 1 };

        if (!driver.profile) {
            obj.profile = 0;
            obj.licence = driver.licence ? 1 : 2;
            obj.pan = driver.pan ? 1 : 2;
            obj.rc = driver.rc ? 1 : 2;
        } else if (!driver.licence) {
            obj.licence = 0;
            obj.pan = driver.pan ? 1 : 2;
            obj.rc = driver.rc ? 1 : 2;
        } else if (!driver.pan) {
            obj.pan = 0;
            obj.rc = driver.rc ? 1 : 2;
        } else if (!driver.rc) {
            obj.rc = 0;
        }

        const data = Object.entries(obj).map(([title, status]) => ({
            title,
            status,
            url: req.driver[title],
        }));

        res.json({ code: '1', message: req.t('success'), data });
    } catch (error) {
        next(error);
    }
};

exports.uploadProfile = async (req, res, next) => {
    try {
        if (!req.file)
            return next(createError.BadRequest('Please upload file.'));

        let driver = await Driver.findByIdAndUpdate(
            req.driver.id,
            { profile: `/uploads/${req.file.filename}` },
            { new: true }
        ).populate('city country');

        driver = multilingualUser(driver, req);

        if (driver.location.coordinates) {
            driver.latitude = driver.location.coordinates[1];
            driver.longitude = driver.location.coordinates[0];
        }

        // Hide fields
        driver.location = undefined;
        driver.__v = undefined;

        res.json({ code: '1', message: req.t('success'), driver });
    } catch (error) {
        next(error);
    }
};

exports.uploadLicence = async (req, res, next) => {
    try {
        if (!req.file)
            return next(createError.BadRequest('Please upload file.'));

        let driver = await Driver.findByIdAndUpdate(
            req.driver.id,
            { licence: `/uploads/${req.file.filename}` },
            { new: true }
        ).populate('city country');

        driver = multilingualUser(driver, req);

        if (driver.location.coordinates) {
            driver.latitude = driver.location.coordinates[1];
            driver.longitude = driver.location.coordinates[0];
        }
        // Hide fields
        driver.location = undefined;
        driver.__v = undefined;

        res.json({ code: '1', message: req.t('success'), driver });
    } catch (error) {
        next(error);
    }
};

exports.uploadPAN = async (req, res, next) => {
    try {
        if (!req.file)
            return next(createError.BadRequest('Please upload file.'));

        let driver = await Driver.findByIdAndUpdate(
            req.driver.id,
            { pan: `/uploads/${req.file.filename}` },
            { new: true }
        ).populate('city country');

        driver = multilingualUser(driver, req);

        if (driver.location.coordinates) {
            driver.latitude = driver.location.coordinates[1];
            driver.longitude = driver.location.coordinates[0];
        }

        // Hide fields
        driver.location = undefined;
        driver.__v = undefined;

        res.json({ code: '1', message: req.t('success'), driver });
    } catch (error) {
        next(error);
    }
};

exports.uploadRC = async (req, res, next) => {
    try {
        if (!req.file)
            return next(createError.BadRequest('Please upload file.'));

        let driver = await Driver.findByIdAndUpdate(
            req.driver.id,
            { rc: `/uploads/${req.file.filename}` },
            { new: true }
        ).populate('city country');

        driver = multilingualUser(driver, req);

        if (driver.location.coordinates) {
            driver.latitude = driver.location.coordinates[1];
            driver.longitude = driver.location.coordinates[0];
        }

        // Hide fields
        driver.location = undefined;
        driver.__v = undefined;

        res.json({ code: '1', message: req.t('success'), driver });
    } catch (error) {
        next(error);
    }
};

// generate random code
const generateCode = length => {
    const digits = '0123456789';
    let generated = '';
    for (let i = 0; i < length; i++)
        generated += digits[Math.floor(Math.random() * 10)];
    return generated;
};
