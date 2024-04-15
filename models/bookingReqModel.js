const mongoose = require('mongoose');

const bookingReqSchema = new mongoose.Schema({
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
    pickupTime: { type: String, required: [true, 'validation.pickupTime'] },
    returnTime: { type: String, required: [true, 'validation.returnTime'] },

    status: {
        type: String,
        default: 'requested',
        enum: [
            'requested',
            'accepted',
            'rejected',
            'completed',
            'expired',
            'cancelled',
        ],
    },
});

module.exports = mongoose.model('Booking Request', bookingReqSchema);
