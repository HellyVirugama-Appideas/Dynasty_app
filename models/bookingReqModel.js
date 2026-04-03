// const mongoose = require('mongoose');

// const bookingReqSchema = new mongoose.Schema({
//     user: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true,
//     },
//     car: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Car',
//         required: true,
//     },
//     driver: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Driver',
//         required: true,
//     },
//     deliveryOption: {
//         type: String,
//         required: [true, 'validation.deliveryOption'],
//         enum: ['delivery', 'pickup'],
//     },
//     address: { type: String, required: [true, 'validation.address'] },
//     bookedFrom: { type: Date, required: true },
//     bookedTo: { type: Date, required: true },
//     pickupTime: { type: String, required: [true, 'validation.pickupTime'] },
//     returnTime: { type: String, required: [true, 'validation.returnTime'] },
//     pickupCheck: { type: Boolean, default: false },
//     returnCheck: { type: Boolean, default: false },

//     status: {
//         type: String,
//         default: 'requested',
//         enum: [
//             'requested',
//             'accepted',
//             'rejected',
//             'completed',
//             'expired',
//             'cancelled',
//         ],
//     },
// });

// module.exports = mongoose.model('Booking Request', bookingReqSchema);


const mongoose = require('mongoose');

const bookingReqSchema = new mongoose.Schema(
    {
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
        pickupTime: {
            type: String,
            required: [true, 'validation.pickupTime'],
        },
        returnTime: {
            type: String,
            required: [true, 'validation.returnTime'],
        },
        pickupCheck: { type: Boolean, default: false },
        pickupSign: { type: String },
        returnCheck: { type: Boolean, default: false },
        returnSign: { type: String },

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
        reason: {
            type: String,
            required: function () {
                return (
                    this.status === 'cancelled' || this.status === 'rejected'
                );
            },
        },

        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Driver',
            default: null,
        },

        cancelledBy: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'User',   // dynamic ref (optional but good)
            default: null,
        },

        // NEW PAYMENT TRACKING FIELDS
        paymentStatus: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending',
        },
        paymentMethod: {
            type: String,
            enum: ['wallet', 'card', 'cash'],
        },
        paidAt: {
            type: Date,
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt
    }
);

// Add indexes for efficient queries
bookingReqSchema.index({
    driver: 1,
    status: 1,
    paymentStatus: 1,
    bookedTo: 1,
});
bookingReqSchema.index({ user: 1, status: 1, paymentStatus: 1, bookedTo: 1 });

module.exports = mongoose.model('Booking Request', bookingReqSchema);