const mongoose = require('mongoose');

const tipSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    image: { type: String }, // اختياري
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tip', tipSchema);
