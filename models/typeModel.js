const mongoose = require('mongoose');

const typeSchema = new mongoose.Schema({
    en: {
        name: {
            type: String,
            required: [true, 'Name is required.'],
            trim: true,
        },
    },
    fr: {
        name: {
            type: String,
            required: [true, 'Name is required.'],
            trim: true,
        },
    },
    ar: {
        name: {
            type: String,
            required: [true, 'Name is required.'],
            trim: true,
        },
    },
    typeFor: {
        type: String,
        enum: ['Taxi', 'Bike', 'Delivery'],
        required: [true, 'Please specify the type of vehicle.'],
    },
    image: { type: String, required: true },
});

module.exports = new mongoose.model('Type', typeSchema);
