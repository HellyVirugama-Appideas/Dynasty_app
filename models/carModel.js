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
        required: [true, 'car.type'],
    },
    name: { type: String, required: [true, 'car.name'], trim: true },
    condition: { type: String, required: [true, 'car.condition'] },
    company: { type: String, required: [true, 'car.company'] },
    model: { type: String, required: [true, 'car.model'] },
    purchaseDate: { type: String, required: [true, 'car.purchaseDate'] },
    kmsDriven: { type: String, required: [true, 'car.kmsDriven'], trim: true },
    carNumber: { type: String, required: [true, 'car.carNumber'], trim: true },
    price: { type: String, required: [true, 'car.price'], trim: true },
    description: {
        type: String,
        required: [true, 'car.description'],
        trim: true,
    },

    address: { type: String, required: [true, 'car.address'], trim: true },
    location: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] },
    },

    pics: [String],
    purchaseBill: String,
    insurance: String,
    rc: String,

    rating: { type: Number, default: 0 },

    isDeleted: { type: Boolean, default: false, select: false },
});

carSchema.index({ location: '2dsphere' });

carSchema.post('findOneAndUpdate', async function (doc) {
    if (doc) {
        if (doc.pics.length > 1 && doc.pics.includes('/uploads/car_404.jpg'))
            doc.pics.pull('/uploads/car_404.jpg');
        if (doc.pics.length === 0) doc.pics.push('/uploads/car_404.jpg');
        await doc.save();
    }
});

module.exports = mongoose.model('Car', carSchema);
