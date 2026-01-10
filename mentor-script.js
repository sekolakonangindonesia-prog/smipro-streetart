import { db } from './firebase-config.js';
import { 
    doc, getDoc, updateDoc, collection, onSnapshot, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// AMBIL ID (KUNCI UTAMA)
const MENTOR_ID = localStorage.getItem('mentorId');

// VARIABLE GLOBAL
let unsubscribeMentor = null;

// --- 1. INISIALISASI ---
window.onload = function() {
    console.log("Mentor Init. ID:", MENTOR_ID);

    // Cek Login
    if(!localStorage.getItem('userLoggedIn')) {
        window.location.href = 'index.html';
        return;
    }

    // Cek ID (Wajib Ada)
    if(!MENTOR_ID) {
        alert("ID Mentor Hilang. Silakan Login Ulang dari Admin.");
        window.location.href = 'admin-dashboard.html';
        return;
    }

    // Cek Admin Mode
    if(localStorage.getItem('adminOrigin') === 'true') {
        const floatBtn = document.getElementById('admin-floating-btn');
        if(floatBtn) floatBtn.style.display = 'block';
        setupAdminHome();
    }

    // RENDER KOTAK KOSONG DULU (Agar tidak blank saat loading)
    renderInputs(7);

    // JALANKAN LISTENER REALTIME (Sama seperti Mitra)
    setupMentorListener();
    loadStudents();
};

// --- 2. LISTENER DATA MENTOR (REALTIME) ---
function setupMentorListener() {
    if (unsubscribeMentor) unsubscribeMentor();

    // DENGARKAN PERUBAHAN DI DOKUMEN MENTOR
    unsubscribeMentor = onSnapshot(doc(db, "mentors", MENTOR_ID), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Data Mentor Masuk:", data);

            // 1. UPDATE HEADER
            document.getElementById('m-name').innerText = data.name;
            document.getElementById('m-spec').innerText = data.specialist || "MENTOR";
            document.getElementById('m-email').innerText = data.email;
            if(data.img) document.getElementById('header-profile-img').src = data.img;

            // 2. UPDATE FORM EDIT
            document.getElementById('edit-name').value = data.name;
            document.getElementById('edit-spec').value = data.specialist;
            document.getElementById('edit-email').value = data.email;
            document.getElementById('edit-phone').value = data.phone;

            // 3. UPDATE 7 KOTAK PORTOFOLIO
            if(data.portfolio && Array.isArray(data.portfolio)) {
                data.portfolio.forEach((txt, i) => {
                    const el = document.getElementById(`porto-${i}`);
                    if(el) el.value = txt;
                });
            }

            // 4. UPDATE 7 KOTAK PROFESI
            if(data.profession && Array.isArray(data.profession)) {
                data.profession.forEach((txt, i) => {
                    const el = document.getElementById(`prof-${i}`);
                    if(el) el.value = txt;
                });
            }
        } else {
            console.log("Dokumen Mentor Tidak Ditemukan di Database!");
        }
    });
}

// --- 3. FUNGSI RENDER INPUT (Dipanggil di Awal) ---
function renderInputs(n) {
    const pContainer = document.getElementById('porto-inputs');
    const fContainer = document.getElementById('prof-inputs');
    
    if(pContainer && fContainer) {
        pContainer.innerHTML = ''; fContainer.innerHTML = '';
        for(let i=0; i<n; i++) {
            pContainer.innerHTML += `<input type="text" id="porto-${i}" class="input-mentor" placeholder="Isi Portofolio ${i+1}..." style="margin-bottom:8px;">`;
            fContainer.innerHTML += `<input type="text" id="prof-${i}" class="input-mentor" placeholder="Isi Profesi ${i+1}..." style="margin-bottom:8px;">`;
        }
    }
}

// --- 4. SIMPAN DATA ---
window.saveMentorProfile = async function() {
    const name = document.getElementById('edit-name').value;
    const spec = document.getElementById('edit-spec').value;
    const phone = document.getElementById('edit-phone').value;
    
    let newPorto = [];
    let newProf = [];

    // Ambil isi dari 7 kotak
    for(let i=0; i<7; i++) {
        const pVal = document.getElementById(`porto-${i}`).value;
        const fVal = document.getElementById(`prof-${i}`).value;
        // Simpan string kosong juga, agar urutan index tetap (0-6)
        newPorto.push(pVal); 
        newProf.push(fVal);
    }

    try {
        await updateDoc(doc(db, "mentors", MENTOR_ID), {
            name: name,
            specialist: spec,
            phone: phone,
            portfolio: newPorto,
            profession: newProf
        });
        alert("Profil Berhasil Diupdate!");
        // Tidak perlu reload, karena onSnapshot akan otomatis mengupdate tampilan jika perlu
    } catch(e) {
        alert("Gagal menyimpan: " + e.message);
    }
}

// --- 5. BENGKEL SISWA (SAMA SEPERTI SEBELUMNYA) ---
function loadStudents() {
    const container = document.getElementById('student-list-container');
    const q = query(collection(db, "students"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align:center; color:#666;">Belum ada siswa.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const s = docSnap.data();
            const sID = docSnap.id;
            const myScore = (s.scores && s.scores[MENTOR_ID]) ? s.scores[MENTOR_ID] : null;

            let actionHTML = '';
            if (myScore !== null) {
                actionHTML = `<div style="text-align:right;"><span style="color:#888; font-size:0.8rem;">Nilai:</span><br><b style="color:#00ff00; font-size:1.5rem;">${myScore}</b></div>`;
            } else {
                actionHTML = `<div style="display:flex; gap:5px;"><input type="number" id="score-${sID}" placeholder="0-100" style="width:60px; padding:5px; border-radius:5px;"><button onclick="window.submitScore('${sID}')" style="background:var(--primary); color:white; border:none; border-radius:5px; cursor:pointer;">Kirim</button></div>`;
            }

            container.innerHTML += `
            <div style="background:#222; padding:15px; border-radius:10px; border:1px solid #333; display:flex; align-items:center; gap:15px;">
                <img src="${s.img || 'https://via.placeholder.com/150'}" style="width:60px; height:60px; border-radius:50%; object-fit:cover;">
                <div style="flex:1;"><h4 style="margin:0; color:white;">${s.name}</h4><span style="color:var(--accent); font-size:0.8rem;">${s.genre}</span></div>
                ${actionHTML}
            </div>`;
        });
    });
}

window.submitScore = async function(studentId) {
    const input = document.getElementById(`score-${studentId}`);
    const nilai = parseInt(input.value);
    if (!input.value || isNaN(nilai) || nilai < 0 || nilai > 100) return alert("Nilai 0-100!");
    if (confirm(`Kirim nilai ${nilai}?`)) {
        const updateData = {};
        updateData[`scores.${MENTOR_ID}`] = nilai;
        await updateDoc(doc(db, "students", studentId), updateData);
    }
}

// --- 6. UTILS (UPLOAD, TAB, LOGOUT, ADMIN) ---
window.triggerUpload = function() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = e => {
        if(e.target.files[0]) {
            const r = new FileReader();
            r.onload = async (ev) => {
                if(confirm("Simpan Foto?")) {
                    await updateDoc(doc(db, "mentors", MENTOR_ID), { img: ev.target.result });
                }
            };
            r.readAsDataURL(e.target.files[0]);
        }
    };
    input.click();
}

window.switchTab = function(t) {
    document.querySelectorAll('.tab-content').forEach(e => e.style.display='none');
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    document.getElementById('tab-'+t).style.display='block';
    event.currentTarget.classList.add('active');
}
window.prosesLogout = function() { if(confirm("Logout?")) { localStorage.clear(); window.location.href = 'index.html'; } }

function setupAdminHome() {
    setTimeout(() => {
        const b = document.getElementById('nav-home-btn');
        if(b) {
            const n = b.cloneNode(true);
            n.innerHTML = '<i class="fa-solid fa-house"></i> Home (Super Admin)';
            n.onclick = e => { e.preventDefault(); if(confirm("Ke Home Admin?")) { localStorage.setItem('userRole','admin'); localStorage.setItem('userName','Super Admin'); window.location.href='index.html'; } };
            b.parentNode.replaceChild(n, b);
        }
    }, 500);
}
window.backToAdminDashboard = function() { if(confirm("Kembali?")) { localStorage.setItem('userRole','admin'); localStorage.setItem('userName','Super Admin'); window.location.href='admin-dashboard.html'; } }
