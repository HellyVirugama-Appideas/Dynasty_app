const mongoose = require('mongoose');
const validator = require('validator');
const createError = require('http-errors');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'validation.name'],
    },
    mobile: {
        type: String,
        required: [true, 'validation.mobile'],
        unique: true,
        validate(value) {
            if (!validator.isMobilePhone(value, 'any', { strictMode: true }))
                throw new Error('validation.mobileInvalid');
        },
    },
    email: {
        type: String,
        unique: true,
        required: [true, 'validation.email'],
        lowercase: true,
        validate: [validator.isEmail, 'validation.emailInvalid'],
    },
    address: {
        type: String,
        required: [true, 'validation.address'],
    },
    city: {
        type: String,
        required: [true, 'validation.city'],
    },
    country: {
        type: String,
        required: [true, 'validation.country'],
    },
    blocked: {
        type: Boolean,
        default: false,
        select: false,
        immutable: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

// generating tokens
userSchema.methods.generateAuthToken = async function () {
    try {
        return jwt.sign({ _id: this._id.toString() }, process.env.JWT_SECRET, {
            expiresIn: '90d',
        });
    } catch (error) {
        throw createError.BadRequest(error);
    }
};

module.exports = new mongoose.model('User', userSchema);
