import { db } from './firebase-config.js';
import { 
    doc, updateDoc, collection, onSnapshot, query, orderBy, getDoc 
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
    }

    // Render Form Input Kosong Dulu
    renderInputs(7);

    // JALANKAN LISTENER DATA (Ganti getDoc jadi onSnapshot biar Realtime)
    listenMentorProfile(MENTOR_ID);
    listenStudents(MENTOR_ID);
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

            const imgUrl = s.img || "https://via.placeholder.com/150";

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
            thumb = "https://via.placeholder.com/400x225?text=SMIPRO+Media";
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
window.saveGalleryItem = async function() {
    const title = document.getElementById('gal-title').value;
    const type = document.getElementById('gal-type').value;
    let url = document.getElementById('gal-url').value;

    if(!title || !url) return alert("Mohon isi judul dan link!");

    let ytId = "";
    if(type === 'video') {
        if(url.includes('watch?v=')) ytId = url.split('watch?v=')[1].split('&')[0];
        else if (url.includes('youtu.be/')) ytId = url.split('youtu.be/')[1];
        url = `https://www.youtube.com/embed/${ytId}`;
    }

    const newItem = { 
        title: title || "", 
        type: type || "video", 
        url: url || "", 
        cover: currentGalleryBase64 || "", 
        youtubeId: ytId || "" 
    };

    // Mencegah error jika mentorGalleryData belum ada
    const newGallery = [...(mentorGalleryData || []), newItem];

    try {
        await updateDoc(doc(db, "mentors", MENTOR_ID), { gallery: newGallery });
        alert("✅ Karya Berhasil Ditambahkan!");
        
        // Reset Modal & Form
        document.getElementById('modal-add-gallery').style.display = 'none';
        document.getElementById('gal-title').value = '';
        document.getElementById('gal-url').value = '';
        document.getElementById('gal-preview-img').style.display = 'none';
        document.getElementById('gal-placeholder-icon').style.display = 'block';
        currentGalleryBase64 = null;
        
    } catch (e) { 
        console.error("Firebase Error:", e);
        alert("Gagal: " + e.message); 
    }
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
