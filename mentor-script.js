import { db } from './firebase-config.js';
import { 
    doc, getDoc, updateDoc, collection, onSnapshot, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// AMBIL ID DARI PENYIMPANAN
const MENTOR_ID = localStorage.getItem('mentorId');

// --- 1. INISIALISASI (AUTO RUN) ---
window.onload = function() {
    console.log("Mentor Dashboard Init. ID:", MENTOR_ID);

    // Cek Login
    if(!localStorage.getItem('userLoggedIn')) {
        window.location.href = 'index.html';
        return;
    }
    
    // Cek ID Mentor (Penyebab Data Hilang saat Refresh biasanya disini)
    if(!MENTOR_ID) {
        alert("Sesi kedaluwarsa. Silakan Login ulang.");
        window.location.href = 'index.html';
        return;
    }

    // Cek Admin Impersonate
    if(localStorage.getItem('adminOrigin') === 'true') {
        const floatBtn = document.getElementById('admin-floating-btn');
        if(floatBtn) floatBtn.style.display = 'block';
        setupAdminHome();
    }

    // Render Tampilan
    renderInputs(7);  // Siapkan kotak profil
    loadMentorData(); // Isi data profil (Fix Refresh Hilang)
    loadStudents();   // Ambil data siswa dari Admin (Fix Masalah Bengkel)
};

// --- 2. LOAD DATA MENTOR (PROFIL) ---
async function loadMentorData() {
    try {
        const docRef = doc(db, "mentors", MENTOR_ID);
        const docSnap = await getDoc(docRef);

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

            // Isi Portofolio
            if(data.portfolio) {
                data.portfolio.forEach((txt, i) => {
                    const el = document.getElementById(`porto-${i}`);
                    if(el) el.value = txt;
                });
            }
            // Isi Profesi
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

// --- 3. LOAD DATA SISWA (DARI ADMIN) ---
function loadStudents() {
    const container = document.getElementById('student-list-container');
    
    // Ambil data dari koleksi 'students' secara realtime
    const q = query(collection(db, "students"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align:center; color:#666;">Belum ada siswa di Bengkel.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const s = docSnap.data();
            const sID = docSnap.id;
            
            // Cek apakah Mentor INI sudah memberi nilai?
            // Struktur scores di DB: { "mentorId_A": 90, "mentorId_B": 80 }
            const myScore = (s.scores && s.scores[MENTOR_ID]) ? s.scores[MENTOR_ID] : null;

            // Tentukan Tampilan Input atau Hasil Nilai
            let actionHTML = '';
            if (myScore !== null) {
                // SUDAH DINILAI
                actionHTML = `
                    <div style="text-align:right;">
                        <span style="color:#888; font-size:0.8rem;">Nilai Anda:</span><br>
                        <b style="color:#00ff00; font-size:1.5rem;">${myScore}</b>
                        <br><button onclick="editScore('${sID}')" style="background:none; border:none; color:#aaa; cursor:pointer; font-size:0.8rem; text-decoration:underline;">Ubah</button>
                    </div>`;
            } else {
                // BELUM DINILAI (INPUT FORM)
                actionHTML = `
                    <div style="display:flex; gap:5px; align-items:center;">
                        <input type="number" id="score-${sID}" placeholder="0-100" style="width:70px; padding:8px; background:#111; border:1px solid #444; color:white; border-radius:5px;">
                        <button onclick="submitScore('${sID}')" style="background:var(--primary); color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold;">Kirim</button>
                    </div>`;
            }

            // Render Kartu Siswa
            container.innerHTML += `
            <div style="background:#222; padding:15px; border-radius:10px; border:1px solid #333; display:flex; align-items:center; gap:15px;">
                <img src="${s.img}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid #555;">
                <div style="flex:1;">
                    <h4 style="margin:0; color:white;">${s.name}</h4>
                    <span style="color:var(--accent); font-size:0.8rem;">${s.genre}</span>
                </div>
                ${actionHTML}
            </div>`;
        });
    });
}

// --- 4. FUNGSI KIRIM NILAI ---
window.submitScore = async function(studentId) {
    const input = document.getElementById(`score-${studentId}`);
    const nilai = parseInt(input.value);

    if (!input.value || isNaN(nilai) || nilai < 0 || nilai > 100) {
        return alert("Masukkan nilai valid (0-100)!");
    }

    if (confirm(`Kirim nilai ${nilai} untuk siswa ini?`)) {
        try {
            // Update field scores secara spesifik untuk Mentor ID ini
            // Menggunakan notasi 'scores.MENTOR_ID'
            const updateData = {};
            updateData[`scores.${MENTOR_ID}`] = nilai;

            await updateDoc(doc(db, "students", studentId), updateData);
            // Tidak perlu alert sukses berlebihan, UI akan update otomatis karena onSnapshot
        } catch (e) {
            alert("Gagal kirim nilai: " + e.message);
        }
    }
}

// Fitur Edit Nilai (Reset jadi null agar input muncul lagi)
window.editScore = async function(studentId) {
    if(confirm("Ubah nilai?")) {
         // Cara menghapus field di map (sedikit trick, set null atau pakai FieldValue.delete)
         // Disini kita set 0 atau overwrite nanti. Kita tampilkan input lagi aja.
         // Tapi karena struktur HTML dirender ulang, kita cukup update UI sementara atau
         // Hapus field score (Advanced). Untuk simpelnya, kita minta user input ulang/timpa.
         
         // Solusi Simpel: Prompt
         const newVal = prompt("Masukkan Nilai Baru (0-100):");
         if(newVal) {
             const n = parseInt(newVal);
             const updateData = {};
             updateData[`scores.${MENTOR_ID}`] = n;
             await updateDoc(doc(db, "students", studentId), updateData);
         }
    }
}

// --- 5. FUNGSI UTILITAS LAINNYA ---

// Render 7 Kotak Input Profil
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

// Simpan Profil
window.saveMentorProfile = async function() {
    const name = document.getElementById('edit-name').value;
    const spec = document.getElementById('edit-spec').value;
    const phone = document.getElementById('edit-phone').value;
    let newPorto = [], newProf = [];
    for(let i=0; i<7; i++) {
        const p = document.getElementById(`porto-${i}`).value;
        const f = document.getElementById(`prof-${i}`).value;
        newPorto.push(p); newProf.push(f);
    }
    try {
        await updateDoc(doc(db, "mentors", MENTOR_ID), {
            name, specialist: spec, phone, portfolio: newPorto, profession: newProf
        });
        alert("Profil Tersimpan!");
        loadMentorData();
    } catch(e) { alert("Error: " + e.message); }
}

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
