const mongoose = require('mongoose');
const validator = require('validator');
const createError = require('http-errors');
const jwt = require('jsonwebtoken');

const driverSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'validation.name'],
        },
        country_code: {
            type: String,
            required: [true, 'validation.country_code'],
        },
        phone: {
            type: String,
            required: [true, 'validation.phone'],
            unique: true,
        },
        email: {
            type: String,
            unique: true,
            required: [true, 'validation.email'],
            lowercase: true,
            validate: [validator.isEmail, 'validation.emailInvalid'],
        },
        googleId: String,
        facebookId: String,
        appleId: String,
        address: { type: String, required: [true, 'validation.address'] },
        city: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'City',
        },
        country: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Country',
        },
        type: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Type',
        },
        profile: {
            type: String,
            default:
                'https://dynasty-bucket.s3.ca-central-1.amazonaws.com/default_user.jpg',
        },
        licence: String,
        pan: String,
        rc: String,
        status: {
            type: String,
            enum: ['online', 'offline', 'busy'],
            default: 'offline',
        },
        location: {
            type: { type: String, enum: ['Point'] },
            coordinates: { type: [Number] },
        },
        useFor: { type: String, enum: ['taxi',"bike", 'rental'], default: 'taxi' },
        rating: { type: Number, default: 0 },
        approved: {
            type: Boolean,
            default: false,
            select: false,
            immutable: true,
        },
        blocked: {
            type: Boolean,
            default: false,
            select: false,
            immutable: true,
        },

        // Stripe integration fields
        stripeConnectAccountId: {
            type: String,
            sparse: true,
            unique: true,
        },
        stripeAccountStatus: {
            type: String,
            enum: ['pending', 'restricted', 'enabled', 'disabled'],
            default: 'pending',
        },
        stripeOnboardingCompleted: {
            type: Boolean,
            default: false,
        },
        stripeDetailsSubmitted: {
            type: Boolean,
            default: false,
        },
        stripePayoutsEnabled: {
            type: Boolean,
            default: false,
        },
        stripeChargesEnabled: {
            type: Boolean,
            default: false,
        },

        // Bank account information
        bankAccount: {
            accountNumber: {
                type: String,
                select: false, // Hide by default for security
            },
            routingNumber: {
                type: String,
                select: false,
            },
            bankName: String,
            accountHolderName: String,
            accountType: {
                type: String,
                enum: ['checking', 'savings'],
                default: 'checking',
            },
            currency: {
                type: String,
                default: 'usd',
            },
            verified: {
                type: Boolean,
                default: false,
            },
            verifiedAt: Date,
        },

        // Withdrawal settings
        withdrawalSettings: {
            minimumAmount: {
                type: Number,
                default: 1000, // $10.00 in cents
            },
            autoWithdrawal: {
                type: Boolean,
                default: false,
            },
            autoWithdrawalThreshold: {
                type: Number,
                default: 5000, // $50.00 in cents
            },
            withdrawalDay: {
                type: String,
                enum: [
                    'daily',
                    'monday',
                    'tuesday',
                    'wednesday',
                    'thursday',
                    'friday',
                    'saturday',
                    'sunday',
                ],
                default: 'daily',
            },
        },

        // KYC and compliance
        kycStatus: {
            type: String,
            enum: [
                'pending',
                'submitted',
                'approved',
                'rejected',
                'requires_action',
            ],
            default: 'pending',
        },
        kycDocuments: [
            {
                type: {
                    type: String,
                    enum: [
                        'identity',
                        'address_proof',
                        'bank_statement',
                        'tax_document',
                    ],
                },
                url: String,
                status: {
                    type: String,
                    enum: ['pending', 'approved', 'rejected'],
                    default: 'pending',
                },
                uploadedAt: {
                    type: Date,
                    default: Date.now,
                },
                verifiedAt: Date,
                rejectionReason: String,
            },
        ],

        isHandlingRequest: { type: Boolean, default: false },
        fcmToken: { type: String },
        isDeleted: { type: Boolean, default: false, select: false },
        date: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

driverSchema.index({ location: '2dsphere' });
driverSchema.index({ stripeConnectAccountId: 1 });
driverSchema.index({ email: 1 });
driverSchema.index({ phone: 1 });

// Generate auth token
driverSchema.methods.generateAuthToken = async function () {
    try {
        return jwt.sign({ _id: this._id.toString() }, process.env.JWT_SECRET, {
            expiresIn: '90d',
        });
    } catch (error) {
        throw createError.BadRequest(error);
    }
};

// Check if driver can withdraw funds
// driverSchema.methods.canWithdraw = function () {
//     return (
//         this.approved === true &&
//         this.blocked === false &&
//         this.stripePayoutsEnabled === true

//         // && this.bankAccount?.verified &&
//         // this.kycStatus === 'approved'
//     );
// };

driverSchema.methods.canWithdraw = function () {
    console.log("CAN WITHDRAW CHECK:", {
        approved: this.approved,
        blocked: this.blocked,
        stripePayoutsEnabled: this.stripePayoutsEnabled
    });

    return (
        this.approved === true &&
        this.blocked === false &&
        this.stripePayoutsEnabled === true
    );
};

// Get formatted bank account for display
driverSchema.methods.getFormattedBankAccount = function () {
    if (!this.bankAccount?.accountNumber) return null;

    const masked = this.bankAccount.accountNumber
        .slice(-4)
        .padStart(this.bankAccount.accountNumber.length, '*');

    return {
        bankName: this.bankAccount.bankName,
        accountNumber: masked,
        accountType: this.bankAccount.accountType,
        verified: this.bankAccount.verified,
    };
};

module.exports = mongoose.model('Driver', driverSchema);
