const mongoose = require('mongoose');

const chargesSchema = new mongoose.Schema({
    baseFare: { type: Number, required: true },
    minimumFare: { type: Number, required: true },
    bookingFee: { type: Number, required: true },
    carDeliveringFee: { type: Number, required: true },
});

module.exports = new mongoose.model('Charge', chargesSchema);
