import { db } from './firebase-config.js';
import { 
    doc, getDoc, updateDoc, collection, onSnapshot, query, orderBy, addDoc, deleteDoc, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Ambil ID
const MENTOR_ID = localStorage.getItem('mentorId');

// --- 1. INISIALISASI (URUTAN DIPERBAIKI) ---
window.onload = function() {
    console.log("Script Mentor Jalan... ID:", MENTOR_ID);

    // A. TAMPILKAN TOMBOL ADMIN DULUAN (Biar gak kejebak)
    if(localStorage.getItem('adminOrigin') === 'true') {
        const floatBtn = document.getElementById('admin-floating-btn');
        if(floatBtn) floatBtn.style.display = 'block';
        setupAdminHome();
    }

    // B. Cek Login
    if(!localStorage.getItem('userLoggedIn')) {
        window.location.href = 'index.html';
        return;
    }
    
    // C. Cek ID Mentor
    if(!MENTOR_ID) {
        alert("Error: ID Mentor tidak ditemukan. Kembali ke Admin.");
        window.location.href = 'admin-dashboard.html';
        return;
    }

    // D. Render Kotak Kosong Dulu (Biar gak blank)
    renderInputs(7);

    // E. Load Data (Realtime)
    loadMentorData(); 
    loadStudents();
    loadShowcase(); // Load Karya
};

// --- 2. LOAD DATA MENTOR ---
function loadMentorData() {
    // Pakai onSnapshot biar realtime dan gak ilang pas refresh
    onSnapshot(doc(db, "mentors", MENTOR_ID), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Header
            document.getElementById('m-name').innerText = data.name;
            document.getElementById('m-spec').innerText = data.specialist || "MENTOR";
            document.getElementById('m-email').innerText = data.email;
            if(data.img) document.getElementById('header-profile-img').src = data.img;

            // Form
            document.getElementById('edit-name').value = data.name || "";
            document.getElementById('edit-spec').value = data.specialist || "";
            document.getElementById('edit-email').value = data.email || "";
            document.getElementById('edit-phone').value = data.phone || "";

            // Portofolio
            if(data.portfolio) {
                data.portfolio.forEach((txt, i) => {
                    const el = document.getElementById(`porto-${i}`);
                    if(el) el.value = txt;
                });
            }
            // Profesi
            if(data.profession) {
                data.profession.forEach((txt, i) => {
                    const el = document.getElementById(`prof-${i}`);
                    if(el) el.value = txt;
                });
            }
        }
    });
}

// --- 3. LOAD SISWA (BENGKEL) ---
function loadStudents() {
    const container = document.getElementById('student-list-container');
    const q = query(collection(db, "students"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) { container.innerHTML = '<p style="text-align:center; color:#666;">Belum ada siswa.</p>'; return; }

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
                <img src="${s.img || 'https://via.placeholder.com/150'}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid #555;">
                <div style="flex:1;"><h4 style="margin:0; color:white;">${s.name}</h4><span style="color:var(--accent); font-size:0.8rem;">${s.genre}</span></div>
                ${actionHTML}
            </div>`;
        });
    });
}

// --- 4. SHOWCASE KARYA (BARU) ---
function loadShowcase() {
    const container = document.getElementById('work-list-container');
    // Ambil karya milik mentor ini saja
    const q = query(collection(db, "mentor_works"), where("mentorId", "==", MENTOR_ID));
    
    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if(snapshot.empty) { container.innerHTML = '<p style="text-align:center; color:#666; grid-column:1/-1;">Belum ada karya diupload.</p>'; return; }

        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            container.innerHTML += `
            <div class="work-card">
                <img src="${d.thumb || 'https://via.placeholder.com/150'}" class="work-thumb">
                <span class="work-type">${d.type}</span>
                <div class="work-info">
                    <b style="color:white; font-size:0.9rem;">${d.title}</b><br>
                    <a href="${d.url}" target="_blank" style="color:#00d2ff; font-size:0.8rem;">Lihat</a>
                    <button class="btn-del-work" onclick="window.deleteWork('${docSnap.id}')">Hapus</button>
                </div>
            </div>`;
        });
    });
}

window.openAddWorkModal = function() { document.getElementById('modal-add-work').style.display = 'flex'; }

window.saveWorkItem = async function() {
    const title = document.getElementById('work-title').value;
    const type = document.getElementById('work-type').value;
    let url = document.getElementById('work-url').value;
    const thumb = document.getElementById('work-thumb').value;

    if(!title || !url) return alert("Judul dan Link wajib!");

    if(type === 'video' && url.includes('watch?v=')) url = url.replace('watch?v=', 'embed/');

    await addDoc(collection(db, "mentor_works"), {
        mentorId: MENTOR_ID,
        title, type, url, 
        thumb: thumb || 'https://via.placeholder.com/150',
        timestamp: new Date()
    });
    alert("Karya Ditambahkan!");
    document.getElementById('modal-add-work').style.display = 'none';
}

window.deleteWork = async function(id) {
    if(confirm("Hapus karya ini?")) await deleteDoc(doc(db, "mentor_works", id));
}

// --- 5. FUNGSI UMUM ---
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

window.saveMentorProfile = async function() {
    const name = document.getElementById('edit-name').value;
    const spec = document.getElementById('edit-spec').value;
    const phone = document.getElementById('edit-phone').value;
    const email = document.getElementById('edit-email').value;
    let newPorto = [], newProf = [];
    for(let i=0; i<7; i++) {
        const p = document.getElementById(`porto-${i}`).value;
        const f = document.getElementById(`prof-${i}`).value;
        newPorto.push(p); newProf.push(f);
    }
    await updateDoc(doc(db, "mentors", MENTOR_ID), {
        name, specialist: spec, phone, email, portfolio: newPorto, profession: newProf
    });
    alert("Profil Tersimpan!");
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
            n.onclick = e => { 
                e.preventDefault(); 
                if(confirm("Ke Home Admin?")) { 
                    localStorage.setItem('userRole','admin'); 
                    localStorage.setItem('userName','Super Admin'); 
                    localStorage.setItem('userLink','admin-dashboard.html'); 
                    window.location.href='index.html'; 
                } 
            };
            b.parentNode.replaceChild(n, b);
        }
    }, 500);
}
window.backToAdminDashboard = function() { 
    if(confirm("Kembali ke Admin?")) { 
        localStorage.setItem('userRole','admin'); 
        localStorage.setItem('userName','Super Admin'); 
        localStorage.setItem('userLink','admin-dashboard.html'); 
        window.location.href='admin-dashboard.html'; 
    } 
}
