const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    flatNo: {
        type: String,
        required: [true, 'validation.flatNo'],
    },
    flat: {
        type: String,
        required: [true, 'validation.flat'],
    },
    street: {
        type: String,
        required: [true, 'validation.street'],
    },
    area: {
        type: String,
        required: [true, 'validation.area'],
    },
    selected: {
        type: Boolean,
        default: false,
    },
});

// Set isSelected to false for all other addresses belonging to the same user
addressSchema.pre('save', async function () {
    if (this.isSelected) {
        await this.constructor.updateMany(
            { userId: this.userId, _id: { $ne: this._id } },
            { $set: { isSelected: false } }
        );
    }
});

module.exports = mongoose.model('Address', addressSchema);
