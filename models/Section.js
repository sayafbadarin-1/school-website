const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    book: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Book', // تابع لأي كتاب
        required: true
    },
    // قائمة الملفات داخل هذا القسم
    files: [
        {
            fileName: String,       // اسم الملف الظاهر
            filePath: String,       // مسار الملف للتحميل
            description: String     // وصف الملف (اختياري)
        }
    ]
});

module.exports = mongoose.model('Section', sectionSchema);