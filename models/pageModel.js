const mongoose = require('mongoose');

const pageSchema = mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            unique: true,
        },
        en: { content: String },
        ar: { content: String },
    },
    {
        timestamps: true,
    }
);

module.exports = new mongoose.model('Page', pageSchema);
