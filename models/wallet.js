const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: function () {
                return !this.driverId;
            },
        },
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Driver',
            required: function () {
                return !this.userId;
            },
        },
        balance: { type: Number, default: 0 }, // in cents or paise for accuracy

        type: {
            type: String,
            enum: ['add', 'use', 'withdrawal', 'withdrawal_fee'],
            required: true,
        },
        amount: { type: Number, required: true },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'processing', 'cancelled'],
            default: 'pending',
        },

        // Stripe payment intent or transfer ID
        stripePaymentIntentId: String,
        stripeTransferId: String,
        stripeConnectAccountId: String,
        stripeCustomerId: String,

        // For withdrawal transactions
        withdrawalMethod: {
            type: String,
            enum: ['bank_transfer', 'stripe_express'],
        },
        bankDetails: {
            accountNumber: String,
            routingNumber: String,
            bankName: String,
            accountHolderName: String,
            swiftCode: String,
            iban: String,
        },

        // Reference to ride or booking for driver earnings
        rideId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Ride',
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
        },

        // Transaction metadata
        description: String,
        failureReason: String,
        processingFee: Number, // in cents
        netAmount: Number, // amount after fees, in cents

        // Audit trail
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
        },
        approvedAt: Date,

        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: true,
    }
);

// Validation: Ensure either userId or driverId is provided
walletSchema.pre('validate', function (next) {
    if (!this.userId && !this.driverId) {
        return next(new Error('Either userId or driverId must be provided'));
    }
    if (this.userId && this.driverId) {
        return next(new Error('Cannot have both userId and driverId'));
    }
    next();
});

// Index for efficient queries
walletSchema.index({ driverId: 1, type: 1, status: 1 });
walletSchema.index({ userId: 1, type: 1, status: 1 });
walletSchema.index({ stripeTransferId: 1 });
walletSchema.index({ stripePaymentIntentId: 1 });
walletSchema.index({ createdAt: -1 });

// Virtual for formatted amount
walletSchema.virtual('formattedAmount').get(function () {
    return this.amount / 100; // Convert cents to currency
});

// Static method to calculate available balance for withdrawal
walletSchema.statics.calculateAvailableBalance = async function (driverId) {
    const transactions = await this.find({
        driverId: driverId,
        status: 'completed',
    });

    let balance = 0;
    transactions.forEach(transaction => {
        if (transaction.type === 'add') {
            balance += transaction.amount;
        } else if (
            ['use', 'withdrawal', 'withdrawal_fee'].includes(transaction.type)
        ) {
            balance -= transaction.amount;
        }
    });

    return Math.max(0, balance); // Ensure non-negative balance
};

// Static method to get pending withdrawals
walletSchema.statics.getPendingWithdrawals = async function (driverId) {
    return await this.find({
        driverId: driverId,
        type: 'withdrawal',
        status: { $in: ['pending', 'processing'] },
    });
};

module.exports = mongoose.model('Wallet', walletSchema);
