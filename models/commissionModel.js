const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema(
    {
        rideCommission: {
            type: Number,
            required: true,
            default: 10,
            min: 0,
            max: 100,
        },
        rentCommission: {
            type: Number,
            required: true,
            default: 15,
            min: 0,
            max: 100,
        },
        commissionType: {
            type: String,
            enum: ['percentage', 'fixed'],
            default: 'percentage',
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Commission', commissionSchema);
