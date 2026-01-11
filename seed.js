const mongoose = require('mongoose');
const Admin = require('./models/Admin'); // استدعاء جدول الأدمن
const bcrypt = require('bcryptjs'); // للتشفير (تأكد إنك نزلتها)

// الاتصال بقاعدة البيانات
mongoose.connect('mongodb://127.0.0.1:27017/school_website')
    .then(() => console.log('Database Connected'))
    .catch(err => console.log(err));

const createAdmin = async () => {
    // 1. تشفير كلمة السر (عشان الأمان)
    // كلمة السر هي: sayaf95
    const hashedPassword = await bcrypt.hash('sayaf95', 10);

    // 2. إنشاء الحساب
    const newAdmin = new Admin({
        username: 'sayaf',
        password: hashedPassword,
        role: 'superadmin'
    });

    // 3. الحفظ
    try {
        await newAdmin.save();
        console.log('✅ تم إنشاء حساب الأدمن sayaf بنجاح!');
    } catch (error) {
        console.log('❌ خطأ: ربما الاسم موجود مسبقاً', error.message);
    } finally {
        mongoose.connection.close(); // إغلاق الاتصال
    }
};

createAdmin();