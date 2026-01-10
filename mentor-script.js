import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Ambil ID dari LocalStorage
const MENTOR_ID = localStorage.getItem('mentorId');

// --- 1. INISIALISASI ---
window.onload = function() {
    // A. Cek Login
    if(!localStorage.getItem('userLoggedIn')) {
        window.location.href = 'index.html';
        return;
    }
    
    // B. Cek Apakah ID Mentor Ada? (PENTING)
    if(!MENTOR_ID) {
        alert("Error: ID Mentor tidak ditemukan. Silakan Login ulang dari Admin atau Halaman Login.");
        window.location.href = 'index.html';
        return;
    }

    // C. Cek Admin Impersonate
    if(localStorage.getItem('adminOrigin') === 'true') {
        const floatBtn = document.getElementById('admin-floating-btn');
        if(floatBtn) floatBtn.style.display = 'block';
        setupAdminHome();
    }

    // D. Jalankan Fungsi
    renderInputs(7); // Buat kotak kosong dulu
    loadMentorData(); // Isi datanya
};

// --- 2. RENDER 7 KOTAK INPUT ---
function renderInputs(n) {
    const pContainer = document.getElementById('porto-inputs');
    const fContainer = document.getElementById('prof-inputs');
    
    if(pContainer && fContainer) {
        pContainer.innerHTML = ''; 
        fContainer.innerHTML = '';

        for(let i=0; i<n; i++) {
            pContainer.innerHTML += `<input type="text" id="porto-${i}" class="input-mentor" placeholder="Slot ${i+1}" style="margin-bottom:8px;">`;
            fContainer.innerHTML += `<input type="text" id="prof-${i}" class="input-mentor" placeholder="Slot ${i+1}" style="margin-bottom:8px;">`;
        }
    }
}

// --- 3. LOAD DATA DARI FIREBASE ---
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

            // Isi Form Edit Utama
            document.getElementById('edit-name').value = data.name;
            document.getElementById('edit-spec').value = data.specialist;
            document.getElementById('edit-email').value = data.email;
            document.getElementById('edit-phone').value = data.phone;

            // Isi 7 Slot Portofolio (Looping)
            if(data.portfolio) {
                data.portfolio.forEach((txt, i) => {
                    const el = document.getElementById(`porto-${i}`);
                    if(el) el.value = txt;
                });
            }
            // Isi 7 Slot Profesi (Looping)
            if(data.profession) {
                data.profession.forEach((txt, i) => {
                    const el = document.getElementById(`prof-${i}`);
                    if(el) el.value = txt;
                });
            }
        } else {
            console.log("Dokumen tidak ditemukan!");
        }
    } catch (e) {
        console.error("Gagal load data:", e);
    }
}

// --- 4. SIMPAN DATA ---
window.saveMentorProfile = async function() {
    const name = document.getElementById('edit-name').value;
    const spec = document.getElementById('edit-spec').value;
    const phone = document.getElementById('edit-phone').value;
    
    // Ambil Data dari 7 Kotak
    let newPorto = [];
    let newProf = [];

    for(let i=0; i<7; i++) {
        const pVal = document.getElementById(`porto-${i}`).value;
        const fVal = document.getElementById(`prof-${i}`).value;
        // Simpan string kosong juga tidak apa-apa, atau filter di sini
        // Kita simpan apa adanya agar posisi slot tidak bergeser
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
        alert("Profil & Portofolio Berhasil Diupdate!");
        loadMentorData(); // Refresh tampilan
    } catch(e) {
        alert("Gagal menyimpan: " + e.message);
    }
}

// --- FUNGSI GLOBAL LAINNYA ---
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).style.display = 'block';
    event.currentTarget.classList.add('active');
}

window.triggerUpload = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
        const file = e.target.files[0];
        if(file) {
            const reader = new FileReader();
            reader.onload = async function(ev) {
                const base64 = ev.target.result;
                document.getElementById('header-profile-img').src = base64;
                if(confirm("Simpan Foto Profil Baru?")) {
                    await updateDoc(doc(db, "mentors", MENTOR_ID), { img: base64 });
                    alert("Foto Tersimpan!");
                }
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

window.prosesLogout = function() { if(confirm("Logout?")) { localStorage.clear(); window.location.href = 'index.html'; } }

function setupAdminHome() {
    setTimeout(() => {
        const oldBtn = document.getElementById('nav-home-btn');
        if (oldBtn) {
            const newBtn = oldBtn.cloneNode(true);
            newBtn.innerHTML = '<i class="fa-solid fa-house"></i> Home (Super Admin)';
            newBtn.onclick = function(e) {
                e.preventDefault();
                if(confirm("Kembali ke Home sebagai SUPER ADMIN?")) {
                    localStorage.setItem('userRole', 'admin');
                    localStorage.setItem('userName', 'Super Admin');
                    localStorage.setItem('userLink', 'admin-dashboard.html');
                    window.location.href = 'index.html';
                }
            };
            oldBtn.parentNode.replaceChild(newBtn, oldBtn);
        }
    }, 500);
}

window.backToAdminDashboard = function() {
    if(confirm("Kembali ke Admin?")) {
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('userName', 'Super Admin');
        localStorage.setItem('userLink', 'admin-dashboard.html');
        window.location.href = 'admin-dashboard.html';
    }
}
