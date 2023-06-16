const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
        message: String,
        createdAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
