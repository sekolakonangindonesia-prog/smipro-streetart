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
    if(viewId === 'cms') renderRadioForm();
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
            // PERBAIKAN: window.location.href (Tab Sama)
            const impersonateBtn = `<button class="btn-action btn-view" onclick="loginAsMitra('${id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            
            tbody.innerHTML += `<tr><td><b>${data.name}</b></td><td>${data.owner||'-'}</td><td>${data.totalTables}</td><td>${statusBadge}</td><td>${impersonateBtn} ${actionBtn} <button class="btn-action btn-delete" onclick="deleteMitra('${id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        });
    });
}

window.loginAsMitra = function(id, name) {
    if(confirm(`Masuk ke Dashboard ${name}?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'mitra');
        localStorage.setItem('userName', name + " (Mode Admin)");
        localStorage.setItem('userLink', 'mitra-dashboard.html');
        localStorage.setItem('adminOrigin', 'true'); // Flag Admin
        window.location.href = 'mitra-dashboard.html'; // TAB SAMA
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
            // PERBAIKAN: window.location.href (Tab Sama)
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

window.loginAsPerf = function(id, name) {
    if(confirm(`Masuk ke Studio ${name}?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'performer');
        localStorage.setItem('userName', name + " (Admin)");
        localStorage.setItem('userLink', 'performer-dashboard.html');
        localStorage.setItem('adminOrigin', 'true'); // Flag Admin
        window.location.href = 'performer-dashboard.html'; // TAB SAMA
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
            const btnLogin = `<button class="btn-action btn-view" onclick="loginAsMentor('${docSnap.id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            const btnDel = `<button class="btn-action btn-delete" onclick="deleteMentor('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>`;
            tbody.innerHTML += `<tr><td>${data.name}</td><td>${data.specialist}</td><td>Aktif</td><td>${btnLogin} ${btnDel}</td></tr>`;
        });
    });
}
window.seedMentors = async function() { /* Kode sama seperti sebelumnya (Andik, Ervan, Anton) */ }
window.loginAsMentor = function(id, name) {
    if(confirm(`Masuk ke Dashboard ${name}?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'mentor');
        localStorage.setItem('userName', name);
        localStorage.setItem('userLink', 'mentor-dashboard.html'); 
        localStorage.setItem('mentorId', id);
        localStorage.setItem('adminOrigin', 'true'); // Flag Admin
        window.location.href = 'mentor-dashboard.html'; // TAB SAMA
    }
}
window.deleteMentor = async function(id) { if(confirm("Hapus?")) await deleteDoc(doc(db, "mentors", id)); }

// INIT
loadMitraData();
loadPerformerData();
loadMentorData();
