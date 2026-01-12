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
const Tip = require('./models/Tip'); // جديد

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

app.use((req, res, next) => {
    res.locals.user = req.session.username || null;
    res.locals.isAdmin = req.session.adminId ? true : false;
    res.locals.isSuperAdmin = req.session.username === 'sayaf';
    next();
});

// حماية الروابط
function checkAdmin(req, res, next) {
    if (req.session.adminId) return next();
    res.redirect('/admin/login');
}

function checkSuperAdmin(req, res, next) {
    if (req.session.username === 'sayaf') return next();
    res.redirect('/admin/dashboard');
}

// ================== الروابط (Routes) ==================

// الرئيسية
app.get('/', async (req, res) => {
    const branches = await Branch.find();
    res.render('index', { branches });
});

// صفحة المفضلة (جديد)
app.get('/favorites', (req, res) => {
    res.render('favorites');
});

// صفحة النصائح والإرشادات (جديد)
app.get('/tips', async (req, res) => {
    const tips = await Tip.find().sort({ createdAt: -1 });
    res.render('tips', { tips });
});

// إدارة النصائح (للأدمن فقط)
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

// تسجيل الدخول
app.get('/admin/login', (req, res) => {
    res.render('login');
});

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) return res.send('<script>alert("خطأ في الاسم"); window.location="/admin/login";</script>');
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.send('<script>alert("كلمة المرور خطأ"); window.location="/admin/login";</script>');
    req.session.adminId = admin._id;
    req.session.username = admin.username;
    res.redirect('/admin/dashboard');
});

app.get('/admin/dashboard', checkAdmin, async (req, res) => {
    const branches = await Branch.find();
    let admins = [];
    if (req.session.username === 'sayaf') admins = await Admin.find();
    res.render('dashboard', { branches, admins, username: req.session.username });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => { res.redirect('/'); });
});

// إدارة المشرفين
app.post('/admin/change-password', checkAdmin, async (req, res) => {
    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);
    await Admin.findByIdAndUpdate(req.session.adminId, { password: hashedPassword });
    res.send('<script>alert("تم"); window.location="/admin/dashboard";</script>');
});

app.post('/admin/create-admin', checkSuperAdmin, async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        await Admin.create({ username: req.body.username, password: hashedPassword });
        res.redirect('/admin/dashboard');
    } catch (e) { res.send("خطأ"); }
});

app.post('/admin/reset-password/:id', checkSuperAdmin, async (req, res) => {
    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);
    await Admin.findByIdAndUpdate(req.params.id, { password: hashedPassword });
    res.redirect('/admin/dashboard');
});

app.get('/admin/delete-admin/:id', checkSuperAdmin, async (req, res) => {
    const adminToDelete = await Admin.findById(req.params.id);
    if (adminToDelete.username === 'sayaf') return res.send("لا يمكن حذف الأدمن الرئيسي");
    await Admin.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard');
});

// إدارة الفروع والكتب
app.post('/admin/add-branch', checkAdmin, async (req, res) => {
    await Branch.create({ name: req.body.name });
    res.redirect('/admin/dashboard');
});

app.post('/admin/edit-branch/:id', checkAdmin, async (req, res) => {
    await Branch.findByIdAndUpdate(req.params.id, { name: req.body.name });
    res.redirect('/admin/dashboard');
});

app.post('/admin/delete-branch/:id', checkAdmin, async (req, res) => {
    const books = await Book.find({ branch: req.params.id });
    for (let book of books) await Section.deleteMany({ book: book._id });
    await Book.deleteMany({ branch: req.params.id });
    await Branch.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard');
});

app.get('/branch/:id', async (req, res) => {
    try {
        const branch = await Branch.findById(req.params.id);
        const books = await Book.find({ branch: req.params.id });
        res.render('branch', { branch, books });
    } catch (err) { res.redirect('/'); }
});

app.post('/admin/add-book', checkAdmin, async (req, res) => {
    await Book.create({ name: req.body.name, image: req.body.coverImage, branch: req.body.branchId });
    res.redirect('/branch/' + req.body.branchId);
});

app.post('/admin/edit-book/:id', checkAdmin, async (req, res) => {
    await Book.findByIdAndUpdate(req.params.id, { name: req.body.name, image: req.body.coverImage });
    res.redirect(req.get('referer'));
});

app.get('/admin/delete-book/:id', checkAdmin, async (req, res) => {
    const book = await Book.findById(req.params.id);
    await Section.deleteMany({ book: req.params.id });
    const branchId = book.branch;
    await Book.findByIdAndDelete(req.params.id);
    res.redirect('/branch/' + branchId);
});

// إدارة الأقسام والملفات
app.get('/book/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id).populate('branch');
        const sections = await Section.find({ book: req.params.id });
        res.render('book', { book, sections });
    } catch (err) { res.redirect('/'); }
});

app.post('/admin/add-section', checkAdmin, async (req, res) => {
    await Section.create({ name: req.body.name, book: req.body.bookId });
    res.redirect('/book/' + req.body.bookId);
});

app.post('/admin/edit-section/:id', checkAdmin, async (req, res) => {
    await Section.findByIdAndUpdate(req.params.id, { name: req.body.name });
    res.redirect(req.get('referer'));
});

app.get('/admin/delete-section/:id', checkAdmin, async (req, res) => {
    const section = await Section.findById(req.params.id);
    res.redirect(req.get('referer')); // للتسهيل
    await Section.findByIdAndDelete(req.params.id);
});

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
    const section = await Section.findById(req.params.sectionId);
    section.files.splice(req.params.fileIndex, 1);
    await section.save();
    res.redirect('/book/' + section.book);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
