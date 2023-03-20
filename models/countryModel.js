const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
    en: {
        name: {
            type: String,
            required: [true, 'Country name is required.'],
        },
    },
    ar: {
        name: {
            type: String,
            required: [true, 'Country name is required.'],
        },
    },
    image: String,
});

module.exports = new mongoose.model('Country', countrySchema);
