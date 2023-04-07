const mongoose = require('mongoose');
const validator = require('validator');
const createError = require('http-errors');
const jwt = require('jsonwebtoken');

const driverSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'validation.name'],
    },
    country_code: {
        type: String,
        required: [true, 'validation.country_code'],
    },
    phone: {
        type: String,
        required: [true, 'validation.phone'],
        unique: true,
    },
    email: {
        type: String,
        unique: true,
        required: [true, 'validation.email'],
        lowercase: true,
        validate: [validator.isEmail, 'validation.emailInvalid'],
    },
    googleId: String,
    facebookId: String,
    appleId: String,
    address: String,
    city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'City',
        required: [true, 'validation.city'],
    },
    country: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Country',
        required: [true, 'validation.country'],
    },
    type: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Type',
    },
    profile: String,
    licence: String,
    pan: String,
    rc: String,
    location: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] },
    },
    approved: {
        type: Boolean,
        default: false,
        select: false,
        immutable: true,
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

driverSchema.index({ location: '2dsphere' });

// generating tokens
driverSchema.methods.generateAuthToken = async function () {
    try {
        return jwt.sign({ _id: this._id.toString() }, process.env.JWT_SECRET, {
            expiresIn: '90d',
        });
    } catch (error) {
        throw createError.BadRequest(error);
    }
};

module.exports = new mongoose.model('Driver', driverSchema);
