const mongoose = require('mongoose');

const tickerSchema = new mongoose.Schema({
    content: { 
        type: String, 
        required: true,
        default: "أهلاً بكم في موقع الصف الحادي عشر" 
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Ticker', tickerSchema);
