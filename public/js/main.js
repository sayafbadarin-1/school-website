// الوضع الليلي
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const icon = document.getElementById('modeIcon');
    if (document.body.classList.contains('dark-mode')) {
        icon.classList.replace('fa-moon', 'fa-sun');
        icon.classList.replace('text-primary', 'text-warning');
        localStorage.setItem('theme', 'dark');
    } else {
        icon.classList.replace('fa-sun', 'fa-moon');
        icon.classList.replace('text-warning', 'text-primary');
        localStorage.setItem('theme', 'light');
    }
}

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    const icon = document.getElementById('modeIcon');
    if(icon) {
        icon.classList.replace('fa-moon', 'fa-sun');
        icon.classList.replace('text-primary', 'text-warning');
    }
}

// ============= نظام المفضلة (LocalStorage) =============

function addToFavorites(id, fileName, fileUrl, description) {
    let favorites = JSON.parse(localStorage.getItem('myFavorites')) || [];
    
    // فحص إذا الملف موجود مسبقاً
    const exists = favorites.some(file => file.id === id);
    if(exists) {
        alert('هذا الملف موجود في المفضلة بالفعل!');
        return;
    }

    favorites.push({ id, fileName, fileUrl, description });
    localStorage.setItem('myFavorites', JSON.stringify(favorites));
    
    // تغيير شكل الأيقونة لتأكيد الإضافة
    const btn = document.getElementById(`fav-btn-${id}`);
    if(btn) {
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.classList.remove('btn-outline-danger');
        btn.classList.add('btn-danger');
    }
}

function removeFromFavorites(id) {
    let favorites = JSON.parse(localStorage.getItem('myFavorites')) || [];
    favorites = favorites.filter(file => file.id !== id);
    localStorage.setItem('myFavorites', JSON.stringify(favorites));
    loadFavoritesPage(); // إعادة تحميل الصفحة لتحديث القائمة
}

// دالة لعرض المفضلة في صفحة favorites.ejs
function loadFavoritesPage() {
    const container = document.getElementById('favorites-container');
    if(!container) return; // إحنا مش في صفحة المفضلة

    let favorites = JSON.parse(localStorage.getItem('myFavorites')) || [];
    container.innerHTML = '';

    if(favorites.length === 0) {
        container.innerHTML = '<div class="alert alert-info text-center">لا يوجد ملفات في المفضلة حالياً</div>';
        return;
    }

    favorites.forEach(file => {
        // تجهيز روابط المعاينة والتحميل
        let previewUrl = file.fileUrl;
        if(previewUrl.includes('drive.google.com') && previewUrl.includes('/view')) {
            previewUrl = previewUrl.replace('/view', '/preview');
        }
        let downloadUrl = file.fileUrl;
        const idMatch = downloadUrl.match(/\/d\/(.+?)(\/|$)/);
        if (idMatch && idMatch[1]) {
            downloadUrl = 'https://drive.google.com/uc?export=download&id=' + idMatch[1];
        }

        const html = `
        <div class="list-group-item d-flex justify-content-between align-items-center mb-2 shadow-sm border rounded">
            <div class="d-flex align-items-center">
                <i class="fas fa-heart text-danger fs-4 me-3"></i>
                <div>
                    <h6 class="mb-0 fw-bold">${file.fileName}</h6>
                    ${file.description ? `<small class="text-muted">${file.description}</small>` : ''}
                </div>
            </div>
            <div>
                <a href="${file.fileUrl}" target="_blank" class="btn btn-sm btn-outline-primary">
                    <i class="fas fa-eye"></i>
                </a>
                <a href="${downloadUrl}" class="btn btn-sm btn-outline-success">
                    <i class="fas fa-download"></i>
                </a>
                <button onclick="removeFromFavorites('${file.id}')" class="btn btn-sm btn-danger">
                    <i class="fas fa-trash-alt"></i> إزالة
                </button>
            </div>
        </div>
        `;
        container.innerHTML += html;
    });
}

// تشغيل تحميل المفضلة عند فتح الصفحة
document.addEventListener('DOMContentLoaded', loadFavoritesPage);