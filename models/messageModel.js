const mongoose = require('mongoose');
const validator = require('validator');

const messageSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        validate(value) {
            if (!validator.isEmail(value)) throw new Error('Invalid email.');
        },
        trim: true,
    },
    message: { type: String, required: true, trim: true },
    date: { type: Date, default: Date.now },
});

module.exports = new mongoose.model('Message', messageSchema);
