// const mongoose = require('mongoose');

// const chatMessageSchema = new mongoose.Schema({
//     bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },

//     rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },

//     sender: { type: String, required: [true, 'sender is required.'] },
//     receiver: { type: String, required: [true, 'receiver is required.'] },
//     message: {
//         type: String,
//         trim: true,
//         required: [true, 'Message is required.'],
//     },

//     createdAt: { type: Date, default: Date.now },
//     updatedAt: { type: Date, default: Date.now },

// // Soft Delete for Booking-based Chat
//     isDeletedByUser: { 
//         type: Boolean, 
//         default: false 
//     },
//     isDeletedByDriver: { 
//         type: Boolean, 
//         default: false 
//     },

//     deletedByUserAt: { type: Date },
//     deletedByDriverAt: { type: Date },
// });

// chatMessageSchema.pre('save', function (next) {
//     this.updatedAt = Date.now();
//     next();
// });

// module.exports = mongoose.model('Chat Message', chatMessageSchema);


// models/chatMessageModel.js
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },

    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    message: { type: String, trim: true, required: true },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },

    // Soft Delete
    isDeletedByUser: { type: Boolean, default: false },
    isDeletedByDriver: { type: Boolean, default: false },
    deletedByUserAt: { type: Date },
    deletedByDriverAt: { type: Date },

    // Extra fields (optional but useful)
    isRead: { type: Boolean, default: false },
    edited: { type: Boolean, default: false },
    originalMessage: String,
});

chatMessageSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);

