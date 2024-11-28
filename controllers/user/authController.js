const { promisify } = require('util');
const createError = require('http-errors');
// const validator = require('validator');
const jwt = require('jsonwebtoken');
const multilingualUser = require('../../utils/multilingualUser');
const generateCode = require('../../utils/generateCode');
// const { sendOTP } = require('../../utils/sendSMS');
const deleteFile = require('../../utils/deleteFile');
const S3 = require('../../helpers/s3');

const User = require('../../models/userModel');
const OTP = require('../../models/otpModel');
const Address = require('../../models/addressModel');
const City = require('../../models/cityModel');
const Country = require('../../models/countryModel');

exports.checkUser = async (req, res, next) => {
    try {
        const token = req.headers.token;

        if (!token) return next(createError.BadRequest('auth.provideToken'));

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let user = await User.findById(decoded._id).select(
            '+blocked +password'
        );

        if (!user) return next(createError.BadRequest('auth.login'));
        if (user.blocked) return next(createError.Unauthorized('auth.blocked'));

        req.user = user;
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
        // if (!validator.isMobilePhone(mobile, 'any'))
        //     return next(createError.BadRequest('validation.mobileInvalid'));

        // generate and save OTP
        const otp = generateCode(4);
        await OTP.updateOne(
            { mobile },
            { otp, expireAt: Date.now() + 2 * 60 * 1000 },
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

        // if userExists, login else send verifyToken
        const userExists = await User.findOne({ country_code, phone }).select(
            '-__v'
        );
        if (userExists) {
            userExists.fcmToken = req.body.fcmToken;
            await userExists.save();
            const token = await userExists.generateAuthToken();
            return res.json({
                code: '1',
                message: req.t('loggedIn'),
                token,
                user: userExists,
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
        // if (!city) return next(createError.BadRequest('Invalid city_id'));
        // if (!country) return next(createError.BadRequest('Invalid country_id'));

        // images validation
        // if (!req.files.licenseFront)
        //     throw createError.BadRequest(
        //         'Please add Frontside image of License.'
        //     );
        // if (!req.files.licenseBack)
        //     throw createError.BadRequest(
        //         'Please add Backside image of License.'
        //     );

        // if (!req.body.latitude || !req.body.longitude)
        //     throw createError.BadRequest('Please select valid address.');

        // images
        const [profile, licenseFront, licenseBack] = await Promise.all([
            req.files.profile
                ? S3.uploadFile(req.files.profile[0]).then(res => res.Location)
                : undefined,
            req.files.licenseFront
                ? S3.uploadFile(req.files.licenseFront[0]).then(
                      res => res.Location
                  )
                : undefined,
            req.files.licenseBack
                ? S3.uploadFile(req.files.licenseBack[0]).then(
                      res => res.Location
                  )
                : undefined,
        ]);

        // create user
        let user = new User({
            name: req.body.name,
            email: req.body.email,
            country_code: decoded.country_code,
            phone: decoded.phone,
            city: city?.id,
            country: country?.id,
            profile,
            licenseFront,
            licenseBack,
            fcmToken: req.body.fcmToken,
        });

        // create address
        const address = new Address({
            userId: user.id,
            address: req.body.address,
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            selected: true,
        });

        // validate
        await user.validate();
        await address.validate();

        user.address = address.id;
        await Promise.all([user.save(), address.save()]);

        const token = await user.generateAuthToken();

        await user.populate('city country address');
        user = multilingualUser(user, req);
        user.latitude = user.address.latitude;
        user.longitude = user.address.longitude;
        user.address = user.address.address;

        // hide fields
        user.password = undefined;
        user.__v = undefined;

        res.status(201).json({
            code: '1',
            message: req.t('profile'),
            token,
            user,
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

        let user = await User.findOne({ email }).populate(
            'city country address'
        );

        // if user exists, redirect to create profile screen
        if (!user) {
            return res.json({
                code: '001',
                message: req.t('success'),
                user: { email, googleId, facebookId, appleId },
            });
        }

        if (googleId) {
            if (!user.googleId) {
                const errorMessage = user.facebookId
                    ? 'social.facebook'
                    : user.appleId
                    ? 'social.apple'
                    : 'social.phone';
                return next(createError.BadRequest(errorMessage));
            }
            if (googleId !== user.googleId) {
                return next(createError.BadRequest('social.invalidGoogle'));
            }
        }

        if (facebookId) {
            if (!user.facebookId) {
                const errorMessage = user.googleId
                    ? 'social.google'
                    : user.appleId
                    ? 'social.apple'
                    : 'social.phone';
                return next(createError.BadRequest(errorMessage));
            }
            if (facebookId !== user.facebookId) {
                return next(createError.BadRequest('social.invalidFacebook'));
            }
        }

        if (appleId) {
            if (!user.appleId) {
                const errorMessage = user.googleId
                    ? 'social.google'
                    : user.facebookId
                    ? 'social.facebook'
                    : 'social.phone';
                return next(createError.BadRequest(errorMessage));
            }
            if (appleId !== user.appleId) {
                return next(createError.BadRequest('social.invalidApple'));
            }
        }

        user.fcmToken = req.body.fcmToken;
        await user.save();
        const token = await user.generateAuthToken();

        user = multilingualUser(user, req);
        user.latitude = user.address.latitude;
        user.longitude = user.address.longitude;
        user.address = user.address.address;

        return res.json({
            code: '1',
            message: req.t('loggedIn'),
            token,
            user,
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
        // if (!city) return next(createError.BadRequest('Invalid city_id'));
        // if (!country) return next(createError.BadRequest('Invalid country_id'));

        // images validation
        // if (!req.files.licenseFront)
        //     throw createError.BadRequest('licenseFront is required.');
        // if (!req.files.licenseBack)
        //     throw createError.BadRequest('licenseBack is required.');

        // if (!req.body.latitude || !req.body.longitude)
        //     throw createError.BadRequest('Please select valid address.');

        // images
        const [profile, licenseFront, licenseBack] = await Promise.all([
            req.files.profile
                ? S3.uploadFile(req.files.profile[0]).then(res => res.Location)
                : undefined,
            S3.uploadFile(req.files.licenseFront[0]).then(res => res.Location),
            S3.uploadFile(req.files.licenseBack[0]).then(res => res.Location),
        ]);

        // create user
        let user = new User({
            name: req.body.name,
            email: req.body.email,
            country_code: req.body.country_code,
            phone: req.body.phone,
            city: city?.id,
            country: country?.id,
            googleId: req.body.googleId,
            facebookId: req.body.facebookId,
            appleId: req.body.appleId,
            profile,
            licenseFront,
            licenseBack,
            fcmToken: req.body.fcmToken,
        });

        // create address
        const address = new Address({
            userId: user.id,
            address: req.body.address,
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            selected: true,
        });

        // validate
        await user.validate();
        await address.validate();

        user.address = address.id;
        await Promise.all([user.save(), address.save()]);

        const token = await user.generateAuthToken();

        await user.populate('city country address');
        user = multilingualUser(user, req);
        user.latitude = user.address.latitude;
        user.longitude = user.address.longitude;
        user.address = user.address.address;

        // hide fields
        user.password = undefined;
        user.__v = undefined;

        res.status(201).json({
            code: '1',
            message: req.t('profile'),
            token,
            user,
        });
    } catch (error) {
        // remove files
        if (req.files.profile)
            deleteFile(`/uploads/${req.files.profile[0].filename}`);
        if (req.files.licenseFront)
            deleteFile(`/uploads/${req.files.licenseFront[0].filename}`);
        if (req.files.licenseBack)
            deleteFile(`/uploads/${req.files.licenseBack[0].filename}`);

        if (error.name == 'JsonWebTokenError')
            return next(createError.BadRequest('token.invalid'));
        if (error.name == 'TokenExpiredError')
            return next(createError.BadRequest('token.expired'));

        next(error);
    }
};
