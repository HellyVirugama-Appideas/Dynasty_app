const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    balance: { type: Number, default: 0 }, // in cents or paise for accuracy

    type: { type: String, enum: ['add', 'use'], required: true },
    amount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    stripeCustomerId: String, // could be Stripe session ID, etc.
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Wallet', walletSchema);
