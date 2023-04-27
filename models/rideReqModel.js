const mongoose = require('mongoose');

const rideReqSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    pickupLocation: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] },
    },
    pickupAddress: {
        type: String,
        required: [true, 'pickupAddress is required.'],
    },
    pickupLat: { type: String, required: [true, 'pickupLat is required.'] },
    pickupLng: { type: String, required: [true, 'pickupLng is required.'] },
    endAddress: { type: String, required: [true, 'endAddress is required.'] },
    endLat: { type: String, required: [true, 'endLat is required.'] },
    endLng: { type: String, required: [true, 'endLng is required.'] },
    type: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Type',
        required: [true, 'type is required.'],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

rideReqSchema.index({ pickupLocation: '2dsphere' });

module.exports = new mongoose.model('Ride request', rideReqSchema);
