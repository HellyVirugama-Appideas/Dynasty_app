const { promisify } = require('util');
const createError = require('http-errors');
const validator = require('validator');
const jwt = require('jsonwebtoken');
// const { sendOTP } = require('../../utils/sendSMS');

const User = require('../../models/userModel');
const OTP = require('../../models/otpModel');

exports.checkUser = async (req, res, next) => {
    try {
        let token;
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) return next(createError.BadRequest('auth.provideToken'));

        const decoded = await promisify(jwt.verify)(
            token,
            process.env.JWT_SECRET
        );

        const user = await User.findById(decoded._id).select(
            '+blocked +password -__v'
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

        // if userExists, login else send verifyToken
        const userExists = await User.findOne({ country_code, phone }).select(
            '-__v'
        );
        if (userExists) {
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
            code: '1',
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

        // create user
        const user = await User.create({
            name: req.body.name,
            email: req.body.email,
            country_code: decoded.country_code,
            phone: decoded.phone,
            address: req.body.address,
            city: req.body.city,
            country: req.body.country,
        });

        // hide fields
        user.password = undefined;
        user.__v = undefined;

        const token = await user.generateAuthToken();

        res.status(201).json({ code: '1', token, user });
    } catch (error) {
        if (error.name == 'JsonWebTokenError')
            return next(createError.BadRequest('token.invalid'));
        if (error.name == 'TokenExpiredError')
            return next(createError.BadRequest('token.expired'));
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
