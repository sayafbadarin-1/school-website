const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    image: { 
        type: String, // هنا بنخزن اسم الصورة
        required: true 
    },
    branch: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Branch', // هذا السطر يربط الكتاب بجدول الفروع
        required: true
    }
});

module.exports = mongoose.model('Book', bookSchema);