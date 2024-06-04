const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    car: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Car',
        required: true,
    },
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true,
    },
    deliveryOption: {
        type: String,
        required: [true, 'validation.deliveryOption'],
        enum: ['delivery', 'pickup'],
    },
    address: { type: String, required: [true, 'validation.address'] },
    bookedFrom: { type: Date, required: true },
    bookedTo: { type: Date, required: true },
    pickupTime: { type: String, require: true },
    returnTime: { type: String, require: true },
    price: { type: Number, default: 10 },

    pickupCheck: { type: Boolean, default: false },
    pickupSign: {
        type: String,
        required: function () {
            return this.pickupCheck;
        },
    },
    returnCheck: { type: Boolean, default: false },
    returnSign: {
        type: String,
        required: function () {
            return this.returnCheck;
        },
    },

    status: {
        type: String,
        default: 'accepted',
        enum: ['accepted', 'cancelled'],
    },
    reason: {
        type: String,
        required: function () {
            return this.status === 'cancelled';
        },
    },
    bookingReq: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking Request',
        required: true,
    },
});

module.exports = mongoose.model('Booking', bookingSchema);
