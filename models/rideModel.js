const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true,
    },

    type: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Type',
    },

    pickupAddress: { type: String, required: true },
    pickupLat: { type: String, required: true },
    pickupLng: { type: String, required: true },

    endAddress: { type: String, required: true },
    endLat: { type: String, required: true },
    endLng: { type: String, required: true },

    time: String,
    distance: String,

    otp: { type: Number, required: true },
    status: {
        type: String,
        enum: ['Ongoing', 'Upcoming', 'Completed', 'Cancelled', 'Expired'],
        required: true,
    },
    rideStatus: {
        type: String,
        enum: ['start', 'wayToPickup','tripStarted', 'wayToDone', 'complete'],
        default: 'start',
    }, 
    paymentStatus: String,
    paymentMethod: String,
    cancellationReason: String,
    price: { type: Number },

    isSchedule: { type: Boolean, default: false },
    scheduleTime: Date,
    createdAt: { type: Date, default: Date.now },
});

module.exports = new mongoose.model('Ride', rideSchema);
