import { db } from './firebase-config.js';
import {
doc, getDoc, updateDoc, collection, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// --- 1. INISIALISASI (AUTO RUN SAAT HALAMAN DIBUKA/REFRESH) ---
window.onload = function() {
// Ambil ID dari LocalStorage (Inilah kunci agar data tidak hilang saat refresh)
const MENTOR_ID = localStorage.getItem('mentorId');
const IS_ADMIN = localStorage.getItem('adminOrigin') === 'true';
code
Code
console.log("Start Mentor Dashboard. ID:", MENTOR_ID);

// Cek Login
if(!localStorage.getItem('userLoggedIn')) {
    window.location.href = 'index.html';
    return;
}

// Jika ID Hilang (Biasanya kalau clear cache atau salah login)
if(!MENTOR_ID) {
    alert("ID Mentor tidak ditemukan. Silakan masuk ulang dari Admin.");
    window.location.href = 'admin-dashboard.html';
    return;
}

// Tampilkan Tombol Admin (Jika Admin)
if(IS_ADMIN) {
    document.getElementById('admin-floating-btn').style.display = 'block';
    setupAdminHome();
}

// Render Kotak & Load Data
renderInputs(7);
loadMentorData(MENTOR_ID); // Fungsi ini yang akan mengisi data kembali saat refresh
loadStudents(MENTOR_ID);
};
// --- 2. LOAD DATA MENTOR (HEADER & PROFIL) ---
async function loadMentorData(id) {
try {
const docRef = doc(db, "mentors", id);
const docSnap = await getDoc(docRef);
code
Code
if (docSnap.exists()) {
        const data = docSnap.data();

        // Isi Header
        document.getElementById('m-name').innerText = data.name;
        document.getElementById('m-spec').innerText = data.specialist || "MENTOR";
        document.getElementById('m-email').innerText = data.email;
        if(data.img) document.getElementById('header-profile-img').src = data.img;

        // Isi Form Edit
        document.getElementById('edit-name').value = data.name;
        document.getElementById('edit-spec').value = data.specialist;
        document.getElementById('edit-email').value = data.email;
        document.getElementById('edit-phone').value = data.phone;

        // Isi Portofolio & Profesi
        if(data.portfolio) {
            data.portfolio.forEach((txt, i) => {
                const el = document.getElementById(`porto-${i}`);
                if(el) el.value = txt;
            });
        }
        if(data.profession) {
            data.profession.forEach((txt, i) => {
                const el = document.getElementById(`prof-${i}`);
                if(el) el.value = txt;
            });
        }
    }
} catch (e) {
    console.error("Gagal load mentor:", e);
}
}
// --- 3. LOAD DATA SISWA (BENGKEL) ---
function loadStudents(mentorId) {
const container = document.getElementById('student-list-container');
code
Code
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
        
        // Cek Nilai Mentor Ini
        const myScore = (s.scores && s.scores[mentorId]) ? s.scores[mentorId] : null;

        let actionHTML = '';
        if (myScore !== null) {
            actionHTML = `
                <div style="text-align:right;">
                    <span style="color:#888; font-size:0.8rem;">Nilai Anda:</span><br>
                    <b style="color:#00ff00; font-size:1.5rem;">${myScore}</b>
                </div>`;
        } else {
            actionHTML = `
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="number" id="score-${sID}" placeholder="0-100" style="width:70px; padding:8px; background:#111; border:1px solid #444; color:white; border-radius:5px;">
                    <button onclick="window.submitScore('${sID}')" style="background:var(--primary); color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold;">Kirim</button>
                </div>`;
        }

        const imgUrl = s.img || "https://via.placeholder.com/150";

        container.innerHTML += `
        <div style="background:#222; padding:15px; border-radius:10px; border:1px solid #333; display:flex; align-items:center; gap:15px;">
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
// --- 4. FUNGSI GLOBAL ---
window.submitScore = async function(studentId) {
const mentorId = localStorage.getItem('mentorId');
const input = document.getElementById(score-${studentId});
const nilai = parseInt(input.value);
code
Code
if (!input.value || isNaN(nilai) || nilai < 0 || nilai > 100) return alert("Nilai 0-100!");

if (confirm(`Kirim nilai ${nilai}?`)) {
    const updateData = {};
    updateData[`scores.${mentorId}`] = nilai;
    await updateDoc(doc(db, "students", studentId), updateData);
}
}
window.saveMentorProfile = async function() {
const mentorId = localStorage.getItem('mentorId');
const name = document.getElementById('edit-name').value;
const spec = document.getElementById('edit-spec').value;
const phone = document.getElementById('edit-phone').value;
code
Code
let newPorto = [], newProf = [];
for(let i=0; i<7; i++) {
    const p = document.getElementById(`porto-${i}`).value;
    const f = document.getElementById(`prof-${i}`).value;
    if(p) newPorto.push(p); 
    if(f) newProf.push(f);
}

await updateDoc(doc(db, "mentors", mentorId), {
    name, specialist: spec, phone, portfolio: newPorto, profession: newProf
});
alert("Tersimpan!");
loadMentorData(mentorId);
}
window.triggerUpload = function() {
const mentorId = localStorage.getItem('mentorId');
const input = document.createElement('input');
input.type = 'file'; input.accept = 'image/*';
input.onchange = e => {
if(e.target.files[0]) {
const r = new FileReader();
r.onload = async (ev) => {
if(confirm("Simpan Foto?")) {
await updateDoc(doc(db, "mentors", mentorId), { img: ev.target.result });
document.getElementById('header-profile-img').src = ev.target.result;
}
};
r.readAsDataURL(e.target.files[0]);
}
};
input.click();
}
function renderInputs(n) {
const pContainer = document.getElementById('porto-inputs');
const fContainer = document.getElementById('prof-inputs');
if (pContainer && fContainer) {
pContainer.innerHTML = ''; fContainer.innerHTML = '';
for(let i=0; i<n; i++) {
pContainer.innerHTML += <input type="text" id="porto-${i}" class="input-mentor" placeholder="Slot ${i+1}" style="margin-bottom:5px;">;
fContainer.innerHTML += <input type="text" id="prof-${i}" class="input-mentor" placeholder="Slot ${i+1}" style="margin-bottom:5px;">;
}
}
}
window.switchTab = function(t) {
document.querySelectorAll('.tab-content').forEach(e => e.style.display='none');
document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
document.getElementById('tab-'+t).style.display='block';
event.currentTarget.classList.add('active');
}
window.prosesLogout = function() { if(confirm("Logout?")) { localStorage.clear(); window.location.href='index.html'; } }
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
