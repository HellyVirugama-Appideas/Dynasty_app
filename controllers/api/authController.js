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

exports.getOTP = async (req, res, next) => {
    try {
        const mobile = req.body.mobile;

        // validate mobile
        if (!mobile) return next(createError.BadRequest('validation.mobile'));
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

        res.json({ status: 'success', message: req.t('otp.sent'), otp });
    } catch (error) {
        next(error);
    }
};

exports.verifyOTP = async (req, res, next) => {
    try {
        const { mobile, otp } = req.body;

        // verify otp
        const otpVerified = await OTP.findOne({ mobile, otp });
        if (!otpVerified) return next(createError.BadRequest('otp.fail'));

        // if userExists, login else send verifyToken
        const userExists = await User.findOne({ mobile });
        if (userExists) {
            const token = await userExists.generateAuthToken();
            return res.json({
                status: 'success',
                token,
                user: userExists,
            });
        }

        // generate verifyToken
        const verifyToken = jwt.sign({ mobile }, process.env.JWT_SECRET, {
            expiresIn: '1d',
        });

        res.json({
            status: 'success',
            message: req.t('otp.verified'),
            verifyToken,
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
        if (!decoded.mobile)
            return next(createError.BadRequest('mobile.verify'));

        // create user
        const user = await User.create({
            name: req.body.name,
            email: req.body.email,
            mobile: decoded.mobile,
            address: req.body.address,
            city: req.body.city,
            country: req.body.country,
        });

        // hide fields
        user.password = undefined;
        user.__v = undefined;

        const token = await user.generateAuthToken();

        res.status(201).json({ status: 'success', token, user });
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
