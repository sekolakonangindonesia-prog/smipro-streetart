import { db } from './firebase-config.js';
import { 
    doc, updateDoc, collection, onSnapshot, query, orderBy, getDoc, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GLOBAL VARIABLES ---
const MENTOR_ID = localStorage.getItem('mentorId');
let currentGalleryBase64 = null; // Menyimpan sementara gambar yang dipilih
const IS_ADMIN = localStorage.getItem('adminOrigin') === 'true';

// --- 1. INISIALISASI (JALANKAN LANGSUNG) ---
function initMentorDashboard() {
    console.log("Memulai Dashboard Mentor. ID:", MENTOR_ID);

    // Cek Login Dasar
    if(!localStorage.getItem('userLoggedIn')) {
        window.location.href = 'index.html';
        return;
    }

    // Cek ID Mentor (Kritis)
    if(!MENTOR_ID || MENTOR_ID === 'undefined') {
        alert("ID Mentor tidak valid atau sesi habis. Silakan login ulang lewat Admin.");
        window.location.href = 'admin-dashboard.html';
        return;
    }

    // Tampilkan Tombol Admin (Jika Admin)
    if(IS_ADMIN) {
        const floatBtn = document.getElementById('admin-floating-btn');
        if(floatBtn) floatBtn.style.display = 'block';
        setupAdminHome();

        // Galeri Foto: cuma Admin yang boleh isi
        const btnAddPhoto = document.getElementById('btn-add-mentor-photo');
        if(btnAddPhoto) btnAddPhoto.style.display = 'block';
    }

    // Render Form Input Kosong Dulu
    renderInputs(7);

    // JALANKAN LISTENER DATA (Ganti getDoc jadi onSnapshot biar Realtime)
    listenMentorProfile(MENTOR_ID);
    listenStudents(MENTOR_ID);
    listenPerformers();
    loadMentorPhotoGallery();
}

// --- 2. LISTENER PROFIL MENTOR (PENTING: GANTI KE ONSNAPSHOT) ---
function listenMentorProfile(id) {
    // Kita pakai onSnapshot agar data SELALU muncul walau direfresh
    onSnapshot(doc(db, "mentors", id), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();

            // Isi Header
            safeSetText('m-name', data.name);
            safeSetText('m-spec', data.specialist || "MENTOR");
            safeSetText('m-email', data.email);
            
            // Foto Profil
            if(data.img) {
                const imgHeader = document.getElementById('header-profile-img');
                if(imgHeader) imgHeader.src = data.img;
            }

            // Isi Form Edit (Tab Profil)
            setValueIfExists('edit-name', data.name);
            setValueIfExists('edit-spec', data.specialist);
            setValueIfExists('edit-email', data.email);
            setValueIfExists('edit-phone', data.phone);

            if(data.gallery) {
            window.renderGallery(data.gallery);
            } else {
            window.renderGallery([]);
            }

            // Isi Sosmed (Jika ada)
            if (data.socials) {
            setValueIfExists('edit-ig', data.socials.ig);
            setValueIfExists('edit-tiktok', data.socials.tiktok);
            setValueIfExists('edit-yt', data.socials.yt);
            setValueIfExists('edit-fb', data.socials.fb);
            }

            // Isi Portofolio & Profesi (Looping)
            if(data.portfolio) {
                data.portfolio.forEach((txt, i) => setValueIfExists(`porto-${i}`, txt));
            }
            if(data.profession) {
                data.profession.forEach((txt, i) => setValueIfExists(`prof-${i}`, txt));
            }
            
            console.log("Data Mentor Berhasil Dimuat:", data.name);
        } else {
            console.error("Dokumen Mentor Tidak Ditemukan di Database!");
        }
    }, (error) => {
        console.error("Error mengambil data mentor:", error);
    });
}

// --- 3. LISTENER DATA SISWA (BENGKEL) ---
function listenStudents(mentorId) {
    const container = document.getElementById('student-list-container');
    if(!container) return;
    
    const q = query(collection(db, "students"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        container.innerHTML = ''; // Bersihkan dulu
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align:center; color:#666;">Belum ada siswa di bengkel.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const s = docSnap.data();
            const sID = docSnap.id;
            
            // Cek Nilai Mentor Ini
            const myScore = (s.scores && s.scores[mentorId]) ? s.scores[mentorId] : null;

            let actionHTML = '';
            if (myScore !== null && myScore !== undefined) {
                actionHTML = `
                    <div style="text-align:right;">
                        <span style="color:#888; font-size:0.8rem;">Nilai Anda:</span><br>
                        <b style="color:#00ff00; font-size:1.5rem;">${myScore}</b>
                    </div>`;
            } else {
                // Beri ID unik ke input agar mudah diambil valuenya
                actionHTML = `
                    <div style="display:flex; gap:5px; align-items:center;">
                        <input type="number" id="score-in-${sID}" placeholder="0-100" style="width:70px; padding:8px; background:#111; border:1px solid #444; color:white; border-radius:5px;">
                        <button onclick="window.submitScore('${sID}')" style="background:var(--primary); color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold;">Kirim</button>
                    </div>`;
            }

            const imgUrl = s.img || "https://placehold.co/150";

            container.innerHTML += `
            <div style="background:#222; padding:15px; border-radius:10px; border:1px solid #333; display:flex; align-items:center; gap:15px; margin-bottom:10px;">
                <img src="${imgUrl}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid #555;">
                <div style="flex:1;">
                    <h4 style="margin:0; color:white;">${s.name}</h4>
                    <span style="color:var(--accent); font-size:0.8rem;">${s.genre}</span>
                </div>
                ${actionHTML}
            </div>`;
        });
    });
}

// --- 3B. LISTENER DATA PERFORMER (READ-ONLY UNTUK MENTOR) ---
// Simpan salinan lokal biar search/filter gak perlu query ulang ke Firestore.
let allPerformersCache = [];

function listenPerformers() {
    const container = document.getElementById('performer-list-container');
    if (!container) return;

    onSnapshot(collection(db, "performers"), (snapshot) => {
        allPerformersCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPerformerList(allPerformersCache);
    });
}

function renderPerformerList(list) {
    const container = document.getElementById('performer-list-container');
    if (!container) return;

    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#666;">Tidak ada performer ditemukan.</p>';
        return;
    }

    list.forEach(p => {
        const imgUrl = p.img || "https://placehold.co/150";
        const sourceLabel = p.source === 'graduated' || p.studentId ? '🎓 Alumni Bengkel' : '➕ Daftar Manual';

        container.innerHTML += `
        <div style="background:#222; padding:15px; border-radius:10px; border:1px solid #333; display:flex; align-items:center; gap:15px; margin-bottom:10px;">
            <img src="${imgUrl}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid #555;">
            <div style="flex:1;">
                <h4 style="margin:0; color:white;">${p.name || '-'}</h4>
                <span style="color:var(--accent); font-size:0.8rem;">${p.genre || '-'}</span><br>
                <small style="color:#888;">${sourceLabel}</small>
            </div>
            <button onclick="openPerformerProfile('${p.id}')" style="background:#00d2ff; color:black; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold;">Lihat Profil</button>
        </div>`;
    });
}

// Cari berdasarkan nama atau genre (client-side, dari cache)
window.filterPerformerList = function(keyword) {
    const k = (keyword || '').trim().toLowerCase();
    if (!k) return renderPerformerList(allPerformersCache);
    const filtered = allPerformersCache.filter(p =>
        (p.name || '').toLowerCase().includes(k) || (p.genre || '').toLowerCase().includes(k)
    );
    renderPerformerList(filtered);
};

// Modal profil read-only -- sengaja TIDAK menampilkan nilai mentor (lihat spesifikasi:
// nilai cukup ada di tab Bengkel Siswa).
window.openPerformerProfile = function(id) {
    const p = allPerformersCache.find(x => x.id === id);
    if (!p) return alert("Data performer tidak ditemukan.");

    document.getElementById('pp-img').src = p.img || "https://placehold.co/150";
    document.getElementById('pp-name').innerText = p.name || '-';
    document.getElementById('pp-genre').innerText = p.genre || '-';
    document.getElementById('pp-phone').innerText = p.phone || '-';
    document.getElementById('pp-status').innerText = p.verified ? '✅ Verified' : '🔓 Belum verifikasi';
    document.getElementById('pp-source').innerText = (p.source === 'graduated' || p.studentId) ? '🎓 Alumni Bengkel' : '➕ Daftar Manual';

    document.getElementById('modal-performer-profile').style.display = 'flex';
};

// --- 4. FUNGSI GLOBAL (WINDOW) ---

// Kirim Nilai
window.submitScore = async function(studentId) {
    const input = document.getElementById(`score-in-${studentId}`);
    if(!input) return;
    
    const nilai = parseInt(input.value);
    if (!input.value || isNaN(nilai) || nilai < 0 || nilai > 100) return alert("Masukkan nilai 0-100!");

    if (confirm(`Kirim nilai ${nilai} untuk siswa ini?`)) {
        try {
            const updateData = {};
            // Gunakan notasi dot untuk update nested object di Firestore
            updateData[`scores.${MENTOR_ID}`] = nilai;
            
            await updateDoc(doc(db, "students", studentId), updateData);
            // Tidak perlu alert sukses karena onSnapshot akan otomatis update tampilan
        } catch (e) {
            alert("Gagal kirim nilai: " + e.message);
        }
    }
}

// Fungsi untuk menampilkan gambar yang dipilih dari HP/Laptop ke kotak kecil di modal
window.previewGalleryImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentGalleryBase64 = e.target.result; // Simpan data gambar ke variabel tadi
            const img = document.getElementById('gal-preview-img');
            const icon = document.getElementById('gal-placeholder-icon');
            
            if(img) {
                img.src = e.target.result;
                img.style.display = 'block'; // Munculkan gambar
            }
            if(icon) icon.style.display = 'none'; // Sembunyikan ikon gambar abu-abu
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// Simpan Profil
window.saveMentorProfile = async function() {
    const name = document.getElementById('edit-name').value;
    const spec = document.getElementById('edit-spec').value;
    const phone = document.getElementById('edit-phone').value;
    
    let newPorto = [], newProf = [];
    for(let i=0; i<7; i++) {
        const p = document.getElementById(`porto-${i}`).value;
        const f = document.getElementById(`prof-${i}`).value;
        if(p) newPorto.push(p); 
        if(f) newProf.push(f);
    }
// Ambil data sosmed baru
    const ig = document.getElementById('edit-ig').value;
    const tiktok = document.getElementById('edit-tiktok').value;
    const yt = document.getElementById('edit-yt').value;
    const fb = document.getElementById('edit-fb').value;

// Bungkus jadi object
    const socialData = { ig, tiktok, yt, fb };

    try {
        await updateDoc(doc(db, "mentors", MENTOR_ID), {
            name, specialist: spec, phone, portfolio: newPorto, profession: newProf, socials: socialData
        });
        alert("Profil Tersimpan!");
    } catch (e) {
        alert("Gagal simpan: " + e.message);
    }
}

// Upload Foto
window.triggerUpload = function() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = e => {
        if(e.target.files[0]) {
            const r = new FileReader();
            r.onload = async (ev) => {
                if(confirm("Ganti Foto Profil?")) {
                    await updateDoc(doc(db, "mentors", MENTOR_ID), { img: ev.target.result });
                    // onSnapshot akan mengurus update tampilan
                }
            };
            r.readAsDataURL(e.target.files[0]);
        }
    };
    input.click();
}

// Helper Tab
window.switchTab = function(t) {
    document.querySelectorAll('.tab-content').forEach(e => e.style.display='none');
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    
    const target = document.getElementById('tab-'+t);
    if(target) target.style.display='block';
    
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
}

// Helper Logout
window.prosesLogout = function() { 
    if(confirm("Logout dari Mentor?")) { 
        localStorage.clear(); 
        window.location.href='index.html'; 
    } 
}

// Helper Admin Back
window.backToAdminDashboard = function() { 
    if(confirm("Kembali ke Panel Admin?")) { 
        localStorage.setItem('userRole','admin'); 
        localStorage.setItem('userName','Super Admin'); 
        window.location.href='admin-dashboard.html'; 
    } 
}

// --- UTILS INTERNAL ---
function renderInputs(n) {
    const pContainer = document.getElementById('porto-inputs');
    const fContainer = document.getElementById('prof-inputs');
    if (pContainer && fContainer) {
        pContainer.innerHTML = ''; fContainer.innerHTML = '';
        for(let i=0; i<n; i++) {
            pContainer.innerHTML += `<input type="text" id="porto-${i}" class="input-mentor" placeholder="Slot ${i+1}" style="margin-bottom:5px;">`;
            fContainer.innerHTML += `<input type="text" id="prof-${i}" class="input-mentor" placeholder="Slot ${i+1}" style="margin-bottom:5px;">`;
        }
    }
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if(el) el.innerText = text;
}

function setValueIfExists(id, val) {
    const el = document.getElementById(id);
    if(el && val) el.value = val;
}

function setupAdminHome() {
    setTimeout(() => {
        const b = document.getElementById('nav-home-btn');
        if(b) {
            const n = b.cloneNode(true);
            n.innerHTML = '<i class="fa-solid fa-house"></i> Home (Super Admin)';
            n.onclick = e => { 
                e.preventDefault(); 
                if(confirm("Ke Home Admin?")) { 
                    localStorage.setItem('userRole','admin'); 
                    localStorage.setItem('userName','Super Admin'); 
                    window.location.href='index.html'; 
                } 
            };
            b.parentNode.replaceChild(n, b);
        }
    }, 500);
}

// --- JALANKAN SAAT SCRIPT DIMUAT ---
initMentorDashboard();

/* =========================================
   FITUR BARU: GALERI KARYA MENTOR
   ========================================= */

// 1. Variabel Global untuk menyimpan data galeri sementara
let mentorGalleryData = [];

// 2. Load Galeri (Dipanggil saat loadMentorData)
// -> Tambahkan baris ini ke dalam fungsi loadMentorData() yang sudah ada:
//    renderGallery(data.gallery || []);
//    mentorGalleryData = data.gallery || [];

// Tapi agar mudah, kita buat fungsi terpisah yang dipanggil manual di window.onload
function loadGallerySeparate() {
    const MENTOR_ID = localStorage.getItem('mentorId');
    if(!MENTOR_ID) return;

    // Ambil data langsung dari dokumen mentor yang sudah ada
    // Kita gunakan onSnapshot yang sudah ada di listenMentorProfile
    // Jadi kita modifikasi sedikit fungsi listenMentorProfile di bawah
}

// 3. FUNGSI RENDER (TAMPILAN)
window.renderGallery = function(galleryArray) {
    const container = document.getElementById('mentor-gallery-list');
    if(!container) return; 
    
    container.innerHTML = '';
    mentorGalleryData = galleryArray || [];

    if (mentorGalleryData.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#555;">Belum ada karya.</p>';
        return;
    }

    mentorGalleryData.forEach((item, index) => {
        let icon = item.type === 'video' ? 'fa-play' : 'fa-music';
        let color = item.type === 'video' ? '#E50914' : '#00d2ff';
        
        // --- LOGIKA PENENTUAN GAMBAR (PENTING) ---
        let thumb = "";
        
        if (item.type === 'video' && item.url.includes('embed/')) {
            // Jika video, ambil thumbnail YouTube
            const vidId = item.url.split('embed/')[1].split('?')[0];
            thumb = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
        } else if (item.cover && item.cover.length > 10) {
            // Jika ada foto hasil upload dari HP (Base64), pakai itu
            thumb = item.cover;
        } else {
            // Jika tidak ada keduanya, pakai gambar standar
            thumb = "https://placehold.co/400x225?text=STREETART+Media";
        }

        container.innerHTML += `
        <div style="position:relative; background:#111; border-radius:8px; overflow:hidden; border:1px solid #333;">
            <div onclick="previewDashboardMedia('${item.type}', '${item.url}')" style="cursor:pointer; position:relative; height:120px;">
                <img src="${thumb}" style="width:100%; height:100%; object-fit:cover; opacity:0.6;">
                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;">
                    <i class="fa-solid ${icon}" style="font-size:2rem; color:${color}; text-shadow:0 0 10px black;"></i>
                </div>
            </div>
            <div style="padding:10px; border-top:1px solid #333;">
                <b style="color:white; font-size:0.9rem; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:5px;">${item.title}</b>
                <button onclick="window.deleteGalleryItem(${index})" style="width:100%; background:#b71c1c; color:white; border:none; padding:6px; border-radius:3px; cursor:pointer; font-size:0.8rem; font-weight:bold;">
                    <i class="fa-solid fa-trash"></i> Hapus
                </button>
            </div>
        </div>`;
    });
}

// 4. BUKA MODAL
window.openAddGalleryModal = function() {
    document.getElementById('modal-add-gallery').style.display = 'flex';
}


// 5. SIMPAN KARYA BARU
window.saveGalleryItem = async function() {
    const title = document.getElementById('gal-title').value;
    const type = document.getElementById('gal-type').value;
    let url = document.getElementById('gal-url').value;

    if(!title || !url) return alert("Mohon isi judul dan link!");

    // Logika Youtube tetap sama
    let ytId = "";
    if(type === 'video') {
        if(url.includes('watch?v=')) ytId = url.split('watch?v=')[1].split('&')[0];
        else if (url.includes('youtu.be/')) ytId = url.split('youtu.be/')[1];
        url = `https://www.youtube.com/embed/${ytId}`;
    }

    const newItem = { 
        title, 
        type, 
        url, 
        cover: currentGalleryBase64 || "", // Sekarang mengambil dari file upload
        youtubeId: ytId 
    };

    const newGallery = [...mentorGalleryData, newItem];

    try {
        await updateDoc(doc(db, "mentors", MENTOR_ID), { gallery: newGallery });
        alert("Karya Berhasil Ditambahkan!");
        
        // Reset Modal & Form
        document.getElementById('modal-add-gallery').style.display = 'none';
        document.getElementById('gal-title').value = '';
        document.getElementById('gal-url').value = '';
        document.getElementById('gal-preview-img').style.display = 'none';
        document.getElementById('gal-placeholder-icon').style.display = 'block';
        currentGalleryBase64 = null;
        
    } catch (e) { alert("Gagal: " + e.message); }
}


// 6. HAPUS KARYA
window.deleteGalleryItem = async function(index) {
    const MENTOR_ID = localStorage.getItem('mentorId');
    if(!MENTOR_ID) return alert("Sesi error. Silakan refresh.");

    if(confirm("Yakin ingin menghapus karya ini?")) {
        // Hapus item dari array berdasarkan index
        mentorGalleryData.splice(index, 1);

        try {
            // Update Array Baru ke Firebase
            await updateDoc(doc(db, "mentors", MENTOR_ID), {
                gallery: mentorGalleryData
            });
            // Tidak perlu alert, karena onSnapshot akan otomatis merender ulang tampilan
        } catch(e) {
            alert("Gagal menghapus: " + e.message);
            // Kembalikan tampilan jika gagal (reload data)
            location.reload(); 
        }
    }
}

// --- FUNGSI PREVIEW / PLAY DI DASHBOARD (VERSI FIX MP3) ---
window.previewDashboardMedia = function(type, url) {
    const modal = document.getElementById('dashboard-player-modal');
    const content = document.getElementById('dashboard-player-content');
    
    if(!modal || !content) return;

    // === MESIN PENYULAP LINK (Agar MP3 Drive/Dropbox bisa bunyi) ===
    function cleanUrl(rawUrl) {
        if (!rawUrl) return "";
        let finalUrl = rawUrl;
        if (finalUrl.includes('dropbox.com')) {
            finalUrl = finalUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('dl=0', 'raw=1');
        } else if (finalUrl.includes('drive.google.com')) {
            const fileId = finalUrl.includes('/file/d/') ? finalUrl.split('/file/d/')[1].split('/')[0] : finalUrl.split('id=')[1]?.split('&')[0];
            finalUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
        return finalUrl;
    }
    // ==============================================================

    modal.style.display = 'flex';
    
    if(type === 'video') {
        // Untuk video, pastikan URL-nya format EMBED
        content.innerHTML = `<iframe width="100%" height="400" src="${url}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border:none; border-radius:10px;"></iframe>`;
    } else {
        // UNTUK AUDIO (PAKAI LINK YANG SUDAH DISULAP)
        const musicUrl = cleanUrl(url);
        content.innerHTML = `
            <div style="background:#222; padding:40px; border-radius:15px; border:1px solid #444;">
                <i class="fa-solid fa-music" style="font-size:4rem; color:#00d2ff; margin-bottom:20px;"></i>
                <h3 style="color:white; margin:0 0 10px 0;">Audio Preview</h3>
                <audio controls autoplay src="${musicUrl}" style="width:100%"></audio>
                <p style="color:#888; font-size:0.8rem; margin-top:15px;">Jika tidak bunyi, pastikan file di Drive/Dropbox sudah PUBLIC.</p>
            </div>`;
    }
}

// --- FUNGSI TUTUP PLAYER ---
window.closeDashboardPlayer = function() {
    const modal = document.getElementById('dashboard-player-modal');
    const content = document.getElementById('dashboard-player-content');
    modal.style.display = 'none';
    content.innerHTML = ''; // Hentikan suara/video
}

// =========================================================
// GALERI FOTO MENTOR (KHUSUS ADMIN YANG BISA ISI/EDIT/HAPUS)
// =========================================================
let mentorPhotoGalleryData = [];
let editingMentorPhotoIndex = null; // null = mode Tambah, angka = mode Edit
let currentMentorPhotoBase64 = null;

function loadMentorPhotoGallery() {
    getDoc(doc(db, "mentors", MENTOR_ID)).then((snap) => {
        if (snap.exists()) {
            renderMentorPhotoGallery(snap.data().photoGallery || []);
        }
    });
}

function renderMentorPhotoGallery(data) {
    mentorPhotoGalleryData = data;
    const container = document.getElementById('mentor-photo-gallery-container');
    if (!container) return;

    if (mentorPhotoGalleryData.length === 0) {
        container.innerHTML = '<p style="color:#666; text-align:center; grid-column:1/-1; padding:20px;">Belum ada foto di galeri ini.</p>';
        return;
    }

    container.innerHTML = mentorPhotoGalleryData.map((item, index) => {
        const actionBtns = IS_ADMIN ? `
            <div style="display:flex; gap:5px; margin-top:10px;">
                <button onclick="openEditMentorPhotoModal(${index}); event.stopPropagation();" style="flex:1; background:#333; color:white; border:1px solid #555; border-radius:4px; padding:6px; font-weight:bold; cursor:pointer; font-size:0.75rem;">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button onclick="deleteMentorPhoto(${index}); event.stopPropagation();" style="flex:1; background:#b71c1c; color:white; border:none; border-radius:4px; padding:6px; font-weight:bold; cursor:pointer; font-size:0.75rem;">
                    <i class="fa-solid fa-trash"></i> Hapus
                </button>
            </div>` : '';
        return `
        <div style="background:#1a1a1a; border-radius:8px; overflow:hidden; border:1px solid #333;">
            <img src="${item.url}" style="width:100%; aspect-ratio:1/1; object-fit:cover; display:block;">
            <div style="padding:8px;">
                ${item.caption ? `<p style="color:#ccc; font-size:0.78rem; margin:0;">${item.caption}</p>` : ''}
                ${actionBtns}
            </div>
        </div>`;
    }).join('');
}

window.openAddMentorPhotoModal = function() {
    if (!IS_ADMIN) return alert("Akses Ditolak! Hanya Admin yang bisa menambah foto di galeri ini.");
    editingMentorPhotoIndex = null;
    currentMentorPhotoBase64 = null;
    document.getElementById('mentor-photo-modal-title').innerText = 'Tambah Foto';
    document.getElementById('mentor-photo-caption').value = '';
    document.getElementById('mentor-photo-preview-img').style.display = 'none';
    document.getElementById('mentor-photo-placeholder-icon').style.display = 'block';
    document.getElementById('modal-add-mentor-photo').style.display = 'flex';
};

window.openEditMentorPhotoModal = function(index) {
    if (!IS_ADMIN) return alert("Akses Ditolak! Hanya Admin yang bisa mengedit foto di galeri ini.");
    const item = mentorPhotoGalleryData[index];
    if (!item) return;

    editingMentorPhotoIndex = index;
    currentMentorPhotoBase64 = null; // Kosong = kalau disimpan tanpa pilih foto baru, foto lama tetap dipakai
    document.getElementById('mentor-photo-modal-title').innerText = 'Edit Foto';
    document.getElementById('mentor-photo-caption').value = item.caption || '';
    document.getElementById('mentor-photo-preview-img').src = item.url;
    document.getElementById('mentor-photo-preview-img').style.display = 'block';
    document.getElementById('mentor-photo-placeholder-icon').style.display = 'none';
    document.getElementById('modal-add-mentor-photo').style.display = 'flex';
};

window.previewMentorPhotoImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentMentorPhotoBase64 = e.target.result;
            document.getElementById('mentor-photo-preview-img').src = e.target.result;
            document.getElementById('mentor-photo-preview-img').style.display = 'block';
            document.getElementById('mentor-photo-placeholder-icon').style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.saveMentorPhoto = async function() {
    if (!IS_ADMIN) return alert("Akses Ditolak! Hanya Admin yang bisa menambah/mengedit foto di galeri ini.");

    const caption = document.getElementById('mentor-photo-caption').value;
    let newPhotoGallery;

    if (editingMentorPhotoIndex !== null) {
        const existing = mentorPhotoGalleryData[editingMentorPhotoIndex];
        const updatedItem = { ...existing, caption: caption || "", url: currentMentorPhotoBase64 || existing.url };
        newPhotoGallery = mentorPhotoGalleryData.map((item, i) => i === editingMentorPhotoIndex ? updatedItem : item);
    } else {
        if (!currentMentorPhotoBase64) return alert("Mohon pilih foto terlebih dahulu!");
        const newItem = { id: Date.now(), url: currentMentorPhotoBase64, caption: caption || "" };
        newPhotoGallery = [...mentorPhotoGalleryData, newItem];
    }

    try {
        await updateDoc(doc(db, "mentors", MENTOR_ID), { photoGallery: newPhotoGallery });
        alert(editingMentorPhotoIndex !== null ? "✅ Foto Berhasil Diperbarui!" : "✅ Foto Berhasil Ditambahkan!");

        document.getElementById('modal-add-mentor-photo').style.display = 'none';
        document.getElementById('mentor-photo-caption').value = '';
        document.getElementById('mentor-photo-preview-img').style.display = 'none';
        document.getElementById('mentor-photo-placeholder-icon').style.display = 'block';
        currentMentorPhotoBase64 = null;
        editingMentorPhotoIndex = null;

        loadMentorPhotoGallery();
    } catch (e) {
        alert("Gagal menyimpan: " + e.message);
    }
};

window.deleteMentorPhoto = async function(index) {
    if (!IS_ADMIN) return alert("Akses Ditolak! Hanya Admin yang bisa menghapus foto di galeri ini.");
    if (confirm("Hapus foto ini?")) {
        const newPhotoGallery = mentorPhotoGalleryData.filter((_, i) => i !== index);
        await updateDoc(doc(db, "mentors", MENTOR_ID), { photoGallery: newPhotoGallery });
        loadMentorPhotoGallery();
    }
};

// =========================================================
// PILIH DARI GALERI UTAMA (biar admin/mentor gak perlu input ulang video/audio yg sudah ada)
// =========================================================
let allPodcastsCacheMentor = [];

window.openPickPodcastModalMentor = async function() {
    document.getElementById('modal-pick-podcast-mentor').style.display = 'flex';
    document.getElementById('pick-podcast-search-mentor').value = '';

    const listEl = document.getElementById('pick-podcast-list-mentor');
    listEl.innerHTML = '<p style="text-align:center; color:#666;">Memuat...</p>';

    try {
        const snap = await getDocs(query(collection(db, "podcasts"), orderBy("timestamp", "desc")));
        allPodcastsCacheMentor = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPickPodcastListMentor(allPodcastsCacheMentor);
    } catch (e) {
        listEl.innerHTML = '<p style="text-align:center; color:#b71c1c;">Gagal memuat data.</p>';
    }
};

function renderPickPodcastListMentor(list) {
    const listEl = document.getElementById('pick-podcast-list-mentor');
    if (!list.length) {
        listEl.innerHTML = '<p style="text-align:center; color:#666;">Tidak ada konten ditemukan.</p>';
        return;
    }
    listEl.innerHTML = list.map((item, i) => {
        const badge = item.mediaType === 'video' ? '🎬 Video' : '🎵 Audio';
        return `
        <div onclick="selectPickedPodcastMentor(${i})" style="display:flex; align-items:center; gap:10px; background:#111; padding:8px; border-radius:8px; cursor:pointer; border:1px solid #2a2a2a;">
            <img src="${item.thumb || 'https://placehold.co/50'}" style="width:44px; height:44px; border-radius:6px; object-fit:cover; flex-shrink:0;">
            <div style="flex:1; overflow:hidden;">
                <div style="color:white; font-size:0.82rem; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title || 'Untitled'}</div>
                <small style="color:#888;">${badge} · ${item.host || ''}</small>
            </div>
        </div>`;
    }).join('');
}

window.filterPickPodcastMentor = function(keyword) {
    const k = (keyword || '').trim().toLowerCase();
    if (!k) return renderPickPodcastListMentor(allPodcastsCacheMentor);
    renderPickPodcastListMentor(allPodcastsCacheMentor.filter(p => (p.title || '').toLowerCase().includes(k)));
};

window.selectPickedPodcastMentor = function(index) {
    const item = allPodcastsCacheMentor[index];
    if (!item) return;

    document.getElementById('gal-title').value = item.title || '';
    document.getElementById('gal-type').value = item.mediaType || 'video';
    document.getElementById('gal-url').value = item.link || '';

    if (item.thumb) {
        document.getElementById('gal-preview-img').src = item.thumb;
        document.getElementById('gal-preview-img').style.display = 'block';
        document.getElementById('gal-placeholder-icon').style.display = 'none';
        currentGalleryBase64 = item.thumb; // langsung dipakai sebagai cover
    }

    document.getElementById('modal-pick-podcast-mentor').style.display = 'none';
};
