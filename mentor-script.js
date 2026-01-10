import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const MENTOR_ID = localStorage.getItem('mentorId');

// --- INIT ---
window.onload = function() {
    if(!MENTOR_ID) {
        alert("Sesi habis. Silakan login ulang.");
        window.location.href = 'index.html';
        return;
    }
    
    // Cek Admin Impersonate
    if(localStorage.getItem('adminOrigin') === 'true') {
        document.getElementById('admin-floating-btn').style.display = 'block';
        setupAdminHome();
    }

    loadMentorData();
    renderInputs(7); // Siapkan 7 kotak kosong
};

// --- RENDER INPUT 7 SLOT ---
function renderInputs(n) {
    const pContainer = document.getElementById('porto-inputs');
    const fContainer = document.getElementById('prof-inputs');
    pContainer.innerHTML = ''; fContainer.innerHTML = '';

    for(let i=0; i<n; i++) {
        pContainer.innerHTML += `<input type="text" id="porto-${i}" class="input-mentor" placeholder="Portofolio ${i+1}">`;
        fContainer.innerHTML += `<input type="text" id="prof-${i}" class="input-mentor" placeholder="Profesi ${i+1}">`;
    }
}

// --- LOAD DATA ---
async function loadMentorData() {
    const docRef = doc(db, "mentors", MENTOR_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();

        // Header
        document.getElementById('m-name').innerText = data.name;
        document.getElementById('m-spec').innerText = data.specialist || "MENTOR";
        document.getElementById('m-email').innerText = data.email;
        if(data.img) document.getElementById('header-profile-img').src = data.img;

        // Form Profil
        document.getElementById('edit-name').value = data.name;
        document.getElementById('edit-spec').value = data.specialist;
        document.getElementById('edit-email').value = data.email;
        document.getElementById('edit-phone').value = data.phone;

        // Isi Portofolio
        if(data.portfolio) {
            data.portfolio.forEach((txt, i) => {
                if(i < 7) document.getElementById(`porto-${i}`).value = txt;
            });
        }
        // Isi Profesi
        if(data.profession) {
            data.profession.forEach((txt, i) => {
                if(i < 7) document.getElementById(`prof-${i}`).value = txt;
            });
        }
    }
}

// --- SAVE DATA ---
window.saveMentorProfile = async function() {
    const name = document.getElementById('edit-name').value;
    const spec = document.getElementById('edit-spec').value;
    const phone = document.getElementById('edit-phone').value;
    
    // Ambil Array 7 Slot
    let newPorto = [];
    let newProf = [];

    for(let i=0; i<7; i++) {
        const pVal = document.getElementById(`porto-${i}`).value;
        const fVal = document.getElementById(`prof-${i}`).value;
        if(pVal) newPorto.push(pVal);
        if(fVal) newProf.push(fVal);
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
        loadMentorData(); // Refresh tampilan
    } catch(e) {
        alert("Gagal menyimpan: " + e.message);
    }
}

// --- FUNGSI ADMIN HOME (SAMA SEPERTI MITRA/PERFORMER) ---
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

// --- TOMBOL BALIK ADMIN ---
window.backToAdminDashboard = function() {
    if(confirm("Kembali ke Admin?")) {
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('userName', 'Super Admin');
        localStorage.setItem('userLink', 'admin-dashboard.html');
        window.location.href = 'admin-dashboard.html';
    }
}

// --- FUNGSI TAB ---
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).style.display = 'block';
    event.currentTarget.classList.add('active');
}

// --- FUNGSI LOGOUT ---
window.prosesLogout = function() {
    if(confirm("Logout?")) {
        localStorage.clear();
        window.location.href = 'index.html';
    }
}

// --- UPLOAD FOTO ---
window.triggerUpload = function() {
    // Buat input file on-the-fly
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
