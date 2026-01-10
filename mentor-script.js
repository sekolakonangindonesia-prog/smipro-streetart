import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Ambil ID
const MENTOR_ID = localStorage.getItem('mentorId');

window.onload = function() {
    console.log("Script Mentor Jalan... ID:", MENTOR_ID);

    // 1. CEK LOGIN
    if(!localStorage.getItem('userLoggedIn')) {
        window.location.href = 'index.html';
        return;
    }

    // 2. CEK ADMIN
    if(localStorage.getItem('adminOrigin') === 'true') {
        const floatBtn = document.getElementById('admin-floating-btn');
        if(floatBtn) floatBtn.style.display = 'block';
        setupAdminHome();
    }

    // 3. RENDER KOTAK INPUT (PENTING: Dijalankan duluan!)
    renderInputs(7);

    // 4. LOAD DATA DATABASE
    if(MENTOR_ID) {
        loadMentorData();
    } else {
        alert("ID Mentor Kosong! Pastikan Anda masuk melalui Login atau Admin.");
    }
};

// --- FUNGSI RENDER KOTAK ---
function renderInputs(n) {
    const pContainer = document.getElementById('porto-inputs');
    const fContainer = document.getElementById('prof-inputs');

    if (pContainer && fContainer) {
        pContainer.innerHTML = '';
        fContainer.innerHTML = '';

        for (let i = 0; i < n; i++) {
            pContainer.innerHTML += `
                <div style="margin-bottom:8px;">
                    <input type="text" id="porto-${i}" class="input-mentor" placeholder="Isi portofolio ke-${i+1}...">
                </div>`;
            
            fContainer.innerHTML += `
                <div style="margin-bottom:8px;">
                    <input type="text" id="prof-${i}" class="input-mentor" placeholder="Isi profesi ke-${i+1}...">
                </div>`;
        }
    }
}

// --- FUNGSI LOAD DATA ---
async function loadMentorData() {
    try {
        const docRef = doc(db, "mentors", MENTOR_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // ISI HEADER
            document.getElementById('m-name').innerText = data.name;
            document.getElementById('m-spec').innerText = data.specialist || "MENTOR";
            document.getElementById('m-email').innerText = data.email;
            if(data.img) document.getElementById('header-profile-img').src = data.img;

            // ISI FORM DATA DIRI
            document.getElementById('edit-name').value = data.name || "";
            document.getElementById('edit-spec').value = data.specialist || "";
            document.getElementById('edit-email').value = data.email || "";
            document.getElementById('edit-phone').value = data.phone || "";

            // ISI 7 KOTAK PORTOFOLIO
            if(data.portfolio && Array.isArray(data.portfolio)) {
                data.portfolio.forEach((text, index) => {
                    const input = document.getElementById(`porto-${index}`);
                    if(input) input.value = text;
                });
            }

            // ISI 7 KOTAK PROFESI
            if(data.profession && Array.isArray(data.profession)) {
                data.profession.forEach((text, index) => {
                    const input = document.getElementById(`prof-${index}`);
                    if(input) input.value = text;
                });
            }

        } else {
            console.log("Data tidak ditemukan di database.");
        }
    } catch (e) {
        console.error("Gagal memuat data:", e);
    }
}

// --- FUNGSI SIMPAN ---
window.saveMentorProfile = async function() {
    const name = document.getElementById('edit-name').value;
    const spec = document.getElementById('edit-spec').value;
    const phone = document.getElementById('edit-phone').value;
    const email = document.getElementById('edit-email').value;

    let newPorto = [];
    let newProf = [];

    // Ambil data dari 7 kotak
    for (let i = 0; i < 7; i++) {
        const pVal = document.getElementById(`porto-${i}`).value;
        const fVal = document.getElementById(`prof-${i}`).value;
        newPorto.push(pVal); 
        newProf.push(fVal);
    }

    try {
        await updateDoc(doc(db, "mentors", MENTOR_ID), {
            name: name,
            specialist: spec,
            phone: phone,
            email: email,
            portfolio: newPorto,
            profession: newProf
        });
        alert("Data Berhasil Disimpan!");
        loadMentorData(); 
    } catch (e) {
        alert("Error saving: " + e.message);
    }
}

// --- FUNGSI UPLOAD FOTO ---
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

// --- FUNGSI NAVIGASI ---
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).style.display = 'block';
    event.currentTarget.classList.add('active');
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
