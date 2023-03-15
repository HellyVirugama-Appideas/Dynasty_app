const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    mobile: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        required: true,
    },
    expireAt: {
        type: Date,
        expires: 0,
    },
});

otpSchema.index({ mobile: 1 });
otpSchema.index({ mobile: 1, otp: 1 });

module.exports = new mongoose.model('OTP', otpSchema);
