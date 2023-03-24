const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    address: {
        type: String,
        required: [true, 'validation.address'],
    },
    selected: {
        type: Boolean,
        default: false,
    },
});

// Set isSelected to false for all other addresses belonging to the same user
addressSchema.pre('save', async function () {
    if (this.selected) {
        await this.constructor.updateMany(
            { userId: this.userId, _id: { $ne: this._id } },
            { $set: { selected: false } }
        );
    }
});

module.exports = mongoose.model('Address', addressSchema);
