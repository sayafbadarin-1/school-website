const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

// استدعاء المودلز
const Admin = require('./models/Admin');
const Branch = require('./models/Branch');
const Book = require('./models/Book');
const Section = require('./models/Section');
const Tip = require('./models/Tip');
const Ticker = require('./models/Ticker'); // المودل الجديد

const app = express();

// الاتصال بقاعدة البيانات (يفضل نقل الرابط لملف .env مستقبلاً للأمان)
mongoose.connect('mongodb+srv://sayaf:sayaf123@cluster0.ysr17vy.mongodb.net/?appName=Cluster0')
    .then(() => console.log('✅ Database Connected'))
    .catch(err => console.log('❌ DB Error:', err));

// الإعدادات العامة
app.use(expressLayouts);
app.set('layout', './layout');
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'my_super_secret_key_sayaf', // يفضل تغييره لكلمة أصعب
    resave: false,
    saveUninitialized: false
}));

// Middleware: تمرير البيانات لكل الصفحات (User, Admin, Ticker)
app.use(async (req, res, next) => {
    res.locals.user = req.session.username || null;
    res.locals.isAdmin = !!req.session.adminId;
    res.locals.isSuperAdmin = req.session.role === 'superadmin';

    // جلب شريط الأخبار
    try {
        let ticker = await Ticker.findOne();
        if (!ticker) {
            // إنشاء شريط افتراضي إذا لم يوجد
            ticker = await Ticker.create({ content: 'مرحباً بكم في الموقع', isActive: true });
        }
        res.locals.ticker = ticker;
    } catch (err) {
        console.error("Ticker Error:", err);
        res.locals.ticker = null;
    }
    
    next();
});

// --- Routes (المسارات العامة) ---

app.get('/', async (req, res) => {
    const branches = await Branch.find();
    res.render('index', { branches });
});

app.get('/branch/:id', async (req, res) => {
    try {
        const branch = await Branch.findById(req.params.id);
        const books = await Book.find({ branch: req.params.id });
        res.render('branch', { branch, books });
    } catch (e) { res.redirect('/'); }
});

app.get('/book/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id).populate('branch');
        const sections = await Section.find({ book: req.params.id });
        res.render('book', { book, sections });
    } catch (e) { res.redirect('/'); }
});

app.get('/tips', async (req, res) => {
    const tips = await Tip.find().sort({ createdAt: -1 });
    res.render('tips', { tips });
});

app.get('/favorites', (req, res) => {
    res.render('favorites');
});

// --- Authentication (تسجيل الدخول) ---

app.get('/admin/login', (req, res) => {
    if (req.session.adminId) return res.redirect('/admin/dashboard');
    res.render('login');
});

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (admin && await bcrypt.compare(password, admin.password)) {
        req.session.adminId = admin._id;
        req.session.username = admin.username;
        req.session.role = admin.role || 'admin';
        res.redirect('/admin/dashboard');
    } else {
        res.send('<script>alert("خطأ في البيانات"); window.location.href="/admin/login";</script>');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// --- Middlewares للحماية ---
const checkAdmin = (req, res, next) => {
    if (req.session.adminId) next();
    else res.redirect('/admin/login');
};

const checkSuperAdmin = (req, res, next) => {
    if (req.session.role === 'superadmin') next();
    else res.redirect('/admin/dashboard');
};

// --- لوحة التحكم (Dashboard) ---

app.get('/admin/dashboard', checkAdmin, async (req, res) => {
    const branches = await Branch.find();
    const admins = await Admin.find();
    const ticker = await Ticker.findOne();
    
    res.render('dashboard', { 
        username: req.session.username,
        branches,
        admins,
        ticker
    });
});

// تحديث شريط الأخبار
app.post('/admin/update-ticker', checkAdmin, async (req, res) => {
    const { content, isActive } = req.body;
    await Ticker.findOneAndUpdate({}, { 
        content: content,
        isActive: isActive === 'on' 
    }, { upsert: true });
    res.redirect('/admin/dashboard');
});

// إدارة الفروع
app.post('/admin/add-branch', checkAdmin, async (req, res) => {
    await Branch.create({ name: req.body.name });
    res.redirect('/admin/dashboard');
});

app.post('/admin/edit-branch/:id', checkAdmin, async (req, res) => {
    await Branch.findByIdAndUpdate(req.params.id, { name: req.body.name });
    res.redirect('/admin/dashboard');
});

// إدارة الكتب
app.post('/admin/add-book', checkAdmin, async (req, res) => {
    await Book.create({ 
        name: req.body.name, 
        image: req.body.coverImage,
        branch: req.body.branchId
    });
    res.redirect('/branch/' + req.body.branchId);
});

app.post('/admin/edit-book/:id', checkAdmin, async (req, res) => {
    await Book.findByIdAndUpdate(req.params.id, { 
        name: req.body.name, 
        image: req.body.coverImage 
    });
    res.redirect(req.get('referer'));
});

// إدارة الأقسام
app.post('/admin/add-section', checkAdmin, async (req, res) => {
    await Section.create({ 
        name: req.body.name, 
        book: req.body.bookId,
        files: []
    });
    res.redirect('/book/' + req.body.bookId);
});

app.post('/admin/edit-section/:id', checkAdmin, async (req, res) => {
    await Section.findByIdAndUpdate(req.params.id, { name: req.body.name });
    res.redirect(req.get('referer'));
});

app.get('/admin/delete-section/:id', checkAdmin, async (req, res) => {
    await Section.findByIdAndDelete(req.params.id);
    res.redirect(req.get('referer'));
});

// إدارة الملفات (إضافة / تعديل / حذف)
app.post('/admin/add-link', checkAdmin, async (req, res) => {
    const { sectionId, bookId, fileName, fileUrl, description } = req.body;
    await Section.findByIdAndUpdate(sectionId, {
        $push: { files: { fileName, filePath: fileUrl, description: description || '' } }
    });
    res.redirect('/book/' + bookId);
});

app.post('/admin/edit-file', checkAdmin, async (req, res) => {
    const { sectionId, bookId, fileId, fileName, fileUrl, description } = req.body;
    await Section.findOneAndUpdate(
        { "_id": sectionId, "files._id": fileId },
        { "$set": { "files.$.fileName": fileName, "files.$.filePath": fileUrl, "files.$.description": description } }
    );
    res.redirect('/book/' + bookId);
});

// (تم التعديل) الحذف الآن يعتمد على ID الملف وليس الـ Index لضمان الدقة
app.get('/admin/delete-file/:sectionId/:fileId', checkAdmin, async (req, res) => {
    try {
        await Section.findByIdAndUpdate(req.params.sectionId, {
            $pull: { files: { _id: req.params.fileId } }
        });
    } catch (error) {
        console.error("Delete File Error:", error);
    }
    res.redirect(req.get('referer'));
});

// إدارة النصائح
app.post('/admin/add-tip', checkAdmin, async (req, res) => {
    await Tip.create(req.body);
    res.redirect('/tips');
});

app.post('/admin/edit-tip/:id', checkAdmin, async (req, res) => {
    await Tip.findByIdAndUpdate(req.params.id, req.body);
    res.redirect('/tips');
});

app.get('/admin/delete-tip/:id', checkAdmin, async (req, res) => {
    await Tip.findByIdAndDelete(req.params.id);
    res.redirect('/tips');
});

// إدارة الأدمنز (Super Admin Only)
app.post('/admin/add-admin', checkSuperAdmin, async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        await Admin.create({ 
            username: req.body.username, 
            password: hashedPassword,
            role: 'admin' 
        });
        res.redirect('/admin/dashboard');
    } catch(e) {
        res.send('<script>alert("اسم المستخدم موجود مسبقاً"); window.history.back();</script>');
    }
});

app.get('/admin/delete-admin/:id', checkSuperAdmin, async (req, res) => {
    await Admin.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard');
});

app.post('/admin/change-password', checkAdmin, async (req, res) => {
    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);
    await Admin.findByIdAndUpdate(req.session.adminId, { password: hashedPassword });
    res.send('<script>alert("تم تغيير كلمة المرور بنجاح"); window.location.href="/admin/dashboard";</script>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
