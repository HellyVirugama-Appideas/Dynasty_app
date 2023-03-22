const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

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

countrySchema.plugin(AutoIncrement, { inc_field: 'country_id' });

module.exports = new mongoose.model('Country', countrySchema);
