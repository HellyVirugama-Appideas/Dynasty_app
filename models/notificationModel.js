const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
        message: { type: String, required: true },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking Request',
        },
        paymentRequired: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
