import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, orderBy, doc, updateDoc, addDoc, deleteDoc, onSnapshot, where, limit, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================
   0. LOGIKA NAVIGASI (SIDEBAR & TABS)
   ========================================= */

window.showView = function(viewId, btn) {
    document.querySelectorAll('.admin-view').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('view-' + viewId);
    if(target) target.classList.remove('hidden');
    // if(viewId === 'cms') renderRadioForm(); // Opsional jika belum ada fungsinya
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    if(btn) btn.classList.add('active');
}

window.switchCmsTab = function(tabId, btn) {
    document.querySelectorAll('.cms-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
}

window.adminLogout = function() {
    if(confirm("Keluar dari Panel Admin?")) {
        localStorage.removeItem('userLoggedIn');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('adminOrigin'); 
        window.location.href = 'index.html';
    }
}

/* =========================================
   1. MANAJEMEN MITRA
   ========================================= */
async function loadMitraData() {
    const tbody = document.getElementById('mitra-table-body');
    if(!tbody) return;
    const q = query(collection(db, "warungs"));
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            let statusBadge = `<span style="color:#00ff00;">Verified</span>`;
            let actionBtn = '';
            if (data.totalTables > 15 && !data.adminApproved) {
                statusBadge = `<span style="color:orange;">Butuh Approval</span>`;
                actionBtn = `<button class="btn-action btn-edit" onclick="approveTable('${id}')">Approve</button>`;
            }
            
            // TOMBOL MASUK DENGAN KLASIFIKASI TAB 'mitra'
            const impersonateBtn = `<button class="btn-action btn-view" onclick="loginAsMitra('${id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            
            tbody.innerHTML += `<tr><td><b>${data.name}</b></td><td>${data.owner||'-'}</td><td>${data.totalTables}</td><td>${statusBadge}</td><td>${impersonateBtn} ${actionBtn} <button class="btn-action btn-delete" onclick="deleteMitra('${id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        });
    });
}

// --- UPDATE: Login Mitra (Catat Jejak 'mitra') ---
window.loginAsMitra = function(id, name) {
    if(confirm(`Masuk ke Dashboard ${name}?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'mitra');
        localStorage.setItem('userName', name + " (Mode Admin)");
        localStorage.setItem('userLink', 'mitra-dashboard.html');
        localStorage.setItem('adminOrigin', 'true'); 
        
        // CATAT JEJAK TAB
        localStorage.setItem('adminReturnTab', 'mitra'); 
        
        window.location.href = 'mitra-dashboard.html';
    }
}

window.approveTable = async function(id) { if(confirm("Setujui?")) await updateDoc(doc(db, "warungs", id), { adminApproved: true }); }
window.deleteMitra = async function(id) { if(confirm("Hapus?")) await deleteDoc(doc(db, "warungs", id)); }

/* =========================================
   2. MANAJEMEN PERFORMER (PENTING)
   ========================================= */
async function loadPerformerData() {
    const tbody = document.getElementById('perf-table-body');
    if(!tbody) return;

    onSnapshot(collection(db, "performers"), (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;">Belum ada performer.<br><button class="btn-action btn-edit" onclick="seedPerformer()">+ Buat Performer Test</button></td></tr>`;
            return;
        }
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // TOMBOL MASUK DENGAN KLASIFIKASI TAB 'performer'
            const btnLogin = `<button class="btn-action btn-view" onclick="loginAsPerf('${id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            const btnDel = `<button class="btn-action btn-delete" onclick="deletePerf('${id}')"><i class="fa-solid fa-trash"></i></button>`;
            
            tbody.innerHTML += `<tr><td><b>${data.name}</b></td><td>${data.genre}</td><td><span style="color:#00ff00;">Verified</span></td><td>${btnLogin} ${btnDel}</td></tr>`;
        });
    });
}

window.seedPerformer = async function() {
    await addDoc(collection(db, "performers"), {
        name: "The Acoustic Boys",
        genre: "Pop Jawa",
        verified: true,
        img: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=100",
        rating: 4.8
    });
    alert("Performer Dibuat! Silakan klik 'Masuk'.");
}

// --- UPDATE: Login Performer (Catat Jejak 'performer') ---
window.loginAsPerf = function(id, name) {
    if(confirm(`Masuk ke Studio ${name}?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'performer');
        localStorage.setItem('userName', name + " (Admin)");
        localStorage.setItem('userLink', 'performer-dashboard.html');
        localStorage.setItem('adminOrigin', 'true');
        
        // CATAT JEJAK TAB
        localStorage.setItem('adminReturnTab', 'performer');
        
        window.location.href = 'performer-dashboard.html';
    }
}
window.deletePerf = async function(id) { if(confirm("Hapus?")) await deleteDoc(doc(db, "performers", id)); }

/* =========================================
   3. MANAJEMEN MENTOR
   ========================================= */
async function loadMentorData() {
    const tbody = document.getElementById('mentor-table-body');
    if(!tbody) return;
    onSnapshot(collection(db, "mentors"), (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Klik Generate.</td></tr>'; return; }
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            
            // TOMBOL MASUK DENGAN KLASIFIKASI TAB 'mentor'
            const btnLogin = `<button class="btn-action btn-view" onclick="loginAsMentor('${docSnap.id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            const btnDel = `<button class="btn-action btn-delete" onclick="deleteMentor('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>`;
            
            tbody.innerHTML += `<tr><td>${data.name}</td><td>${data.specialist}</td><td>Aktif</td><td>${btnLogin} ${btnDel}</td></tr>`;
        });
    });
}

// --- FUNGSI SEED MENTOR YANG SUDAH BENAR ---
window.seedMentors = async function() {
    const mentorsData = [
        {
            name: "Bpk. Andigo",
            specialist: "Musik Management",
            img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200",
            portfolio: ["Manajer Band Indie 2010-2020", "Promotor Festival Jazz Jatim"],
            profession: ["Dosen Musik", "Event Organizer"]
        },
        {
            name: "Ibu Putri",
            specialist: "Stage Act & Koreo",
            img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200",
            portfolio: ["Koreografer Tari Nasional", "Mentor Idol 2019"],
            profession: ["Penari Profesional", "Guru Seni"]
        },
        {
            name: "Bpk. Ervan",
            specialist: "Visual Management",
            img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200",
            portfolio: ["Stage Designer Konser Amal", "Fotografer Event"],
            profession: ["Desainer Grafis", "Art Director"]
        }
    ];

    if(confirm("Generate 3 Data Mentor Dummy ke Database?")) {
        try {
            for (const m of mentorsData) {
                await addDoc(collection(db, "mentors"), m);
            }
            alert("Sukses! 3 Mentor telah ditambahkan.");
            loadMentorData(); 
        } catch (e) {
            alert("Gagal menambahkan data: " + e.message);
        }
    }
}

// --- UPDATE: Login Mentor (Catat Jejak 'mentor') ---
window.loginAsMentor = function(id, name) {
    if(confirm(`Masuk ke Dashboard ${name}?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'mentor');
        localStorage.setItem('userName', name);
        localStorage.setItem('userLink', 'mentor-dashboard.html'); 
        localStorage.setItem('mentorId', id);
        localStorage.setItem('adminOrigin', 'true');
        
        // CATAT JEJAK TAB
        localStorage.setItem('adminReturnTab', 'mentor');
        
        window.location.href = 'mentor-dashboard.html';
    }
}
window.deleteMentor = async function(id) { if(confirm("Hapus?")) await deleteDoc(doc(db, "mentors", id)); }

// INIT
loadMitraData();
loadPerformerData();
loadMentorData();

/* =========================================
   4. FITUR TAMBAHAN: AUTO-RETURN TAB
   (Letakkan di paling bawah)
   ========================================= */
setTimeout(() => {
    // 1. Cek apakah ada catatan tab terakhir?
    const lastTab = localStorage.getItem('adminReturnTab');

    if (lastTab) {
        console.log("Mencoba kembali ke tab:", lastTab);

        // 2. Cari semua tombol menu di sidebar
        const allMenus = document.querySelectorAll('.menu-item');
        
        // 3. Loop cari tombol yang cocok dengan kata kunci
        allMenus.forEach(btn => {
            const clickAttr = btn.getAttribute('onclick');
            // Jika onclick mengandung kata kunci (misal 'mitra', 'performer', 'mentor')
            if (clickAttr && clickAttr.includes(lastTab)) {
                // KLIK TOMBOLNYA SECARA OTOMATIS
                btn.click();
            }
        });

        // 4. Hapus catatan
        localStorage.removeItem('adminReturnTab');
    }
}, 500); // Jeda 0.5 detik
