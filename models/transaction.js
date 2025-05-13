const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    amount: { type: Number, required: true },
    paymentMethod: {
        type: String,
        enum: ['wallet', 'cash'],
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
    stripePaymentId: String, // for Stripe transactions
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Transaction', transactionSchema);
