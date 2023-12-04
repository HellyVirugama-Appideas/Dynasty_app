const mongoose = require('mongoose');

const driverRatingSchema = new mongoose.Schema({
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    rating: { type: Number, required: [true, 'rating.rating'] },
    comment: String,
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Driver Rating', driverRatingSchema);
