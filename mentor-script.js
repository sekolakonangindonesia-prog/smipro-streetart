import { db } from './firebase-config.js';
import { 
    doc, updateDoc, collection, onSnapshot, query, orderBy, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GLOBAL VARIABLES ---
const MENTOR_ID = localStorage.getItem('mentorId');
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

    try {
        await updateDoc(doc(db, "mentors", MENTOR_ID), {
            name, specialist: spec, phone, portfolio: newPorto, profession: newProf
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
