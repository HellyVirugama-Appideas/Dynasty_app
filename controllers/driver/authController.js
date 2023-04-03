const createError = require('http-errors');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const Driver = require('../../models/driverModel');
const OTP = require('../../models/otpModel');

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
        const driver = await Driver.findOne({ country_code, phone }).select(
            '-__v'
        );
        if (driver) {
            const token = await driver.generateAuthToken();
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

// generate random code
const generateCode = length => {
    const digits = '0123456789';
    let generated = '';
    for (let i = 0; i < length; i++)
        generated += digits[Math.floor(Math.random() * 10)];
    return generated;
};
