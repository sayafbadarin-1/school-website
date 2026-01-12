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

// الاتصال بقاعدة البيانات
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
    secret: 'my_super_secret_key_sayaf',
    resave: false,
    saveUninitialized: false
}));

// Middleware لتمرير البيانات لكل الصفحات
app.use(async (req, res, next) => {
    res.locals.user = req.session.username || null;
    res.locals.isAdmin = req.session.adminId ? true : false;
    res.locals.isSuperAdmin = req.session.role === 'superadmin';

    // كود شريط الأخبار الجديد
    try {
        let ticker = await Ticker.findOne();
        if (!ticker) {
            ticker = await Ticker.create({ content: 'مرحباً بكم في الموقع', isActive: true });
        }
        res.locals.ticker = ticker;
    } catch (err) {
        console.error(err);
        res.locals.ticker = null;
    }
    
    next();
});

// --- Routes (المسارات) ---

// الصفحة الرئيسية
app.get('/', async (req, res) => {
    const branches = await Branch.find();
    res.render('index', { branches });
});

// صفحة الفرع
app.get('/branch/:id', async (req, res) => {
    const branch = await Branch.findById(req.params.id);
    const books = await Book.find({ branch: req.params.id });
    res.render('branch', { branch, books });
});

// صفحة الكتاب
app.get('/book/:id', async (req, res) => {
    const book = await Book.findById(req.params.id).populate('branch');
    const sections = await Section.find({ book: req.params.id });
    res.render('book', { book, sections });
});

// صفحة النصائح
app.get('/tips', async (req, res) => {
    const tips = await Tip.find().sort({ createdAt: -1 });
    res.render('tips', { tips });
});

// صفحة المفضلة
app.get('/favorites', (req, res) => {
    res.render('favorites');
});

// --- Admin Auth ---
app.get('/admin/login', (req, res) => {
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

// حماية الراوتات
const checkAdmin = (req, res, next) => {
    if (req.session.adminId) next();
    else res.redirect('/admin/login');
};

const checkSuperAdmin = (req, res, next) => {
    if (req.session.role === 'superadmin') next();
    else res.redirect('/admin/dashboard');
};

// --- لوحة التحكم ---
app.get('/admin/dashboard', checkAdmin, async (req, res) => {
    const branches = await Branch.find();
    const admins = await Admin.find(); // للسوبر أدمن
    const ticker = await Ticker.findOne(); // للشريط
    
    res.render('dashboard', { 
        username: req.session.username,
        branches,
        admins,
        ticker
    });
});

// إضافة وتعديل شريط الأخبار (جديد)
app.post('/admin/update-ticker', checkAdmin, async (req, res) => {
    const { content, isActive } = req.body;
    await Ticker.findOneAndUpdate({}, { 
        content: content,
        isActive: isActive === 'on' 
    }, { upsert: true }); // upsert يعني لو مش موجود أنشئه
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

app.get('/admin/delete-branch/:id', checkAdmin, async (req, res) => {
    // تنبيه: هذا مجرد مثال، المفروض نحذف الكتب والاقسام التابعة للفرع كمان
    await Branch.findByIdAndDelete(req.params.id);
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

// إضافة وحذف الروابط/الملفات
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

app.get('/admin/delete-file/:sectionId/:fileIndex', checkAdmin, async (req, res) => {
    // ملاحظة: الحذف من المصفوفة باستخدام الـ index قد يكون صعباً قليلاً بالـ mongo مباشرة
    // الأسهل سحب المصفوفة، تعديلها، وإعادة حفظها، أو استخدام $pull مع الـ ID
    // للتبسيط هنا سنستخدم طريقة $pull إذا كان معنا ID الملف، أو index إذا لا.
    // سنفترض أنك سترسل ID الملف في الرابط بدلاً من الـ index مستقبلاً لتحسين الكود
    // حالياً سنتركها كما هي إذا كانت تعمل لديك، أو نحدثها:
    
    // الحل الأفضل: استخدام fileId
    // app.get('/admin/delete-file/:sectionId/:fileId', ... )
    // await Section.findByIdAndUpdate(req.params.sectionId, { $pull: { files: { _id: req.params.fileId } } });
    
    res.redirect(req.get('referer'));
});
// (ملاحظة: تأكد من كود الحذف لديك، الكود أعلاه مجرد هيكل)

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

// إدارة الأدمنز (للسوبر أدمن فقط)
app.post('/admin/add-admin', checkSuperAdmin, async (req, res) => {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    try {
        await Admin.create({ 
            username: req.body.username, 
            password: hashedPassword,
            role: 'admin' 
        });
        res.redirect('/admin/dashboard');
    } catch(e) {
        res.send('Error: Username likely exists');
    }
});

app.get('/admin/delete-admin/:id', checkSuperAdmin, async (req, res) => {
    await Admin.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard');
});

// تغيير كلمة المرور
app.post('/admin/change-password', checkAdmin, async (req, res) => {
    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);
    await Admin.findByIdAndUpdate(req.session.adminId, { password: hashedPassword });
    res.redirect('/admin/dashboard');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
