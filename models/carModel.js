const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true,
    },
    type: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Type',
        required: [true, 'Car type is required.'],
    },
    name: { type: String, required: [true, 'car.name'], trim: true },
    condition: { type: String, required: [true, 'car.condition'] },
    company: { type: String, required: [true, 'car.company'] },
    model: { type: String, required: [true, 'car.model'] },
    purchaseDate: { type: String, required: [true, 'car.purchaseDate'] },
    kmsDriven: { type: String, required: [true, 'car.kmsDriven'], trim: true },
    carNumber: { type: String, required: [true, 'car.carNumber'], trim: true },
    price: { type: String, required: [true, 'car.price'], trim: true },

    pics: [String],
    purchaseBill: String,
    insurance: String,
    rc: String,
});

module.exports = mongoose.model('Car', carSchema);
