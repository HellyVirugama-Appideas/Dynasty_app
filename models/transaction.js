const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    amount: { type: Number, required: true },

    // Admin commission details
    commissionType: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage',
    },
    commissionRate: {
        type: Number,
        default: 0, // e.g. 10 means 10%
    },
    adminCommission: {
        type: Number,
        default: 0, // Admin ka hissa (same unit as amount)
    },
    driverAmount: {
        type: Number,
        default: 0, // Driver ko milne wala amount after commission
    },

    paymentMethod: {
        type: String,
        enum: ['wallet', 'cash', 'card'],
        required: true,
    },

    type: {
        type: String,
        enum: ['ride_payment', 'bike', 'rent car'],
        // required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },


    rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' }, // if related to ride
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    stripePaymentId: String, // for Stripe transactions

    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Transaction', transactionSchema);
