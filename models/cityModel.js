const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const citySchema = new mongoose.Schema({
    en: {
        name: {
            type: String,
            required: [true, 'City name is required.'],
            trim: true,
        },
    },
    fr: {
        name: {
            type: String,
            required: [true, 'City name is required.'],
            trim: true,
        },
    },
    ar: {
        name: {
            type: String,
            required: [true, 'City name is required.'],
            trim: true,
        },
    },
    country: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Country',
    },
});

citySchema.plugin(AutoIncrement, { inc_field: 'city_id' });

module.exports = new mongoose.model('City', citySchema);
