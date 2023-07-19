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
    },
    address: { type: String, required: [true, 'validation.address'] },
    bookedFrom: { type: Date, required: true },
    bookedTo: { type: Date, required: true },
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
});

module.exports = mongoose.model('Booking', bookingSchema);
