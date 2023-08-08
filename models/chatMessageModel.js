const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: [true, 'bookingId is required.'],
    },

    sender: { type: String, required: [true, 'sender is required.'] },
    receiver: { type: String, required: [true, 'receiver is required.'] },
    message: {
        type: String,
        trim: true,
        required: [true, 'Message is required.'],
    },

    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Chat Message', chatMessageSchema);
