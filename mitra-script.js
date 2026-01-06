// --- IMPORT FIREBASE ---
import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const WARUNG_ID = "warung_smipro"; 
const WARUNG_NAME = "Warung SMIPRO.ID"; 

let currentMenuImageBase64 = null; // Wadah foto menu

// --- FUNGSI KOMPRES FOTO (PENTING AGAR PERMANEN) ---
function compressImage(file, maxWidth, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function (event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const scaleFactor = maxWidth / img.width;
            
            canvas.width = maxWidth;
            canvas.height = img.height * scaleFactor;
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // Kompres jadi JPEG kualitas 0.7 (Cukup bagus tapi ringan)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7); 
            callback(dataUrl);
        };
    };
}

/* =========================================
   1. INISIALISASI
   ========================================= */
async function initDatabase() {
    const docRef = doc(db, "warungs", WARUNG_ID);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        await setDoc(docRef, { 
            name: WARUNG_NAME, status: "open", totalTables: 15, bookedCount: 0,
            owner: "Admin Simulasi", phone: "08123456789", email: "admin@smipro.id"
        });
    }
}

// LISTEN PROFIL
onSnapshot(doc(db, "warungs", WARUNG_ID), (doc) => {
    if (doc.exists()) {
        const data = doc.data();
        document.getElementById('shop-name-display').innerText = data.name;
        document.getElementById('total-table-count').innerText = data.totalTables;
        
        if(data.img) {
            document.getElementById('header-profile-img').src = data.img;
            document.getElementById('preview-profile-img').src = data.img;
        }

        // Form Profil
        document.getElementById('edit-name').value = data.name || '';
        document.getElementById('edit-owner').value = data.owner || '';
        document.getElementById('edit-phone').value = data.phone || '';
        document.getElementById('edit-email').value = data.email || '';
        document.getElementById('edit-pass').value = data.password || '';

        // Status
        const btn = document.getElementById('store-status-btn');
        const txt = document.getElementById('store-status-text');
        if (data.status === 'open') {
            btn.classList.remove('closed'); btn.classList.add('open'); txt.innerText = "BUKA";
        } else {
            btn.classList.remove('open'); btn.classList.add('closed'); txt.innerText = "TUTUP";
        }
        
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userName', data.name);
        localStorage.setItem('userRole', 'mitra');
    }
});

// LISTEN BOOKING (Menampilkan Meja yang sudah ditentukan)
const qBooking = query(collection(db, "bookings"), where("warungName", "==", WARUNG_NAME));
onSnapshot(qBooking, (snapshot) => {
    const bookings = [];
    let active = 0;
    let booked = 0;

    snapshot.forEach((doc) => {
        const d = doc.data();
        bookings.push({ id: doc.id, ...d });
        const qty = d.tablesNeeded || 1;
        if(d.status === 'active') active += qty;
        else if (d.status === 'booked') booked += qty;
    });
    
    document.getElementById('occupied-count').innerText = active;
    document.getElementById('booked-count').innerText = booked;
    renderBookings(bookings);
});

// LISTEN MENU
const qMenu = query(collection(db, "menus"), where("warungId", "==", WARUNG_ID));
onSnapshot(qMenu, (snapshot) => {
    const container = document.getElementById('menu-list-container');
    container.innerHTML = '';
    snapshot.forEach((doc) => {
        const m = doc.data();
        container.innerHTML += `
        <div class="menu-card">
            <img src="${m.img || 'https://via.placeholder.com/150'}" style="width:100%; height:120px; object-fit:cover;">
            <div class="menu-details">
                <b>${m.name}</b><br>
                <span style="color:gold;">Rp ${parseInt(m.price).toLocaleString()}</span><br>
                <button class="btn-delete" onclick="deleteMenu('${doc.id}')" style="margin-top:5px; width:100%;"><i class="fa-solid fa-trash"></i> Hapus</button>
            </div>
        </div>`;
    });
});

/* ========================
   RENDER
   ======================== */
function renderBookings(bookings) {
    const container = document.getElementById('booking-container');
    container.innerHTML = '';
    if (bookings.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#555; grid-column:1/-1;">Belum ada pesanan.</p>';
        return;
    }
    bookings.sort((a, b) => (a.status === 'active' ? -1 : 1));

    bookings.forEach((b) => {
        let cardHtml = '';
        const qty = b.tablesNeeded || 1;
        
        // TAMPILKAN NOMOR MEJA YANG SUDAH DIBOOKING (JIKA ADA)
        const displayMeja = b.tableNum ? `MEJA ${b.tableNum}` : `${qty} MEJA (Belum Set)`;

        if (b.status === 'booked') {
            cardHtml = `
            <div class="card-booking waiting">
                <span class="table-badge" style="background:#555;">RESERVASI: ${displayMeja}</span>
                <b style="font-size:1.1rem;">${b.customerName}</b>
                <br><small>Jam: ${b.arrivalTime}</small>
                <br><small>Kode: <b style="color:white;">${b.bookingCode}</b></small>
                <div class="waiting-text">Menunggu Tamu...</div>
                <button class="btn-delete" onclick="finishBooking('${b.id}')" style="margin-top:10px; width:100%;">Batalkan</button>
            </div>`;
        } else if (b.status === 'active') {
            cardHtml = `
            <div class="card-booking active">
                <span class="table-badge" style="background:#b71c1c;">${displayMeja}</span>
                <b>${b.customerName}</b>
                <br><small>Sedang Makan</small>
                <button class="btn-primary" style="margin-top:10px; background:white; color:red; width:100%;" onclick="finishBooking('${b.id}')">Kosongkan Meja</button>
            </div>`;
        }
        container.innerHTML += cardHtml;
    });
}

// UPLOAD FOTO PROFIL (KOMPRES DULU)
window.previewImage = function(input) {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], 300, async (base64String) => {
            document.getElementById('header-profile-img').src = base64String;
            document.getElementById('preview-profile-img').src = base64String;
            await updateDoc(doc(db, "warungs", WARUNG_ID), { img: base64String });
            alert("Foto Profil Disimpan!");
        });
    }
}

// UPLOAD FOTO MENU (KOMPRES DULU)
window.previewMenuImage = function(input) {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], 400, (base64String) => {
            currentMenuImageBase64 = base64String;
            document.getElementById('preview-menu-img').src = currentMenuImageBase64;
        });
    }
}

window.addMenu = async function() {
    const name = document.getElementById('new-menu-name').value;
    const price = document.getElementById('new-menu-price').value;
    const desc = document.getElementById('new-menu-desc').value;
    
    if(!name || !price) return alert("Isi Nama & Harga!");
    
    // Simpan Menu ke Firebase
    await addDoc(collection(db, "menus"), { 
        warungId: WARUNG_ID, 
        name, price, desc, 
        img: currentMenuImageBase64 || "https://via.placeholder.com/150" 
    });
    
    window.closeModalMenu();
    // Reset Form
    document.getElementById('new-menu-name').value = '';
    document.getElementById('new-menu-price').value = '';
    document.getElementById('preview-menu-img').src = "https://via.placeholder.com/100?text=Foto";
    currentMenuImageBase64 = null;
    alert("Menu Berhasil Ditambah!");
}

window.finishBooking = async function(docId) { if (confirm("Kosongkan meja?")) await deleteDoc(doc(db, "bookings", docId)); }
window.deleteMenu = async function(docId) { if(confirm("Hapus menu?")) await deleteDoc(doc(db, "menus", docId)); }
window.saveProfile = async function() {
    const data = {
        name: document.getElementById('edit-name').value,
        owner: document.getElementById('edit-owner').value,
        phone: document.getElementById('edit-phone').value,
        email: document.getElementById('edit-email').value,
        password: document.getElementById('edit-pass').value
    };
    await updateDoc(doc(db, "warungs", WARUNG_ID), data);
    alert("Profil Tersimpan!");
}

// Navigasi & UI
window.triggerUpload = function() { document.getElementById('file-input').click(); }
window.triggerMenuUpload = function() { document.getElementById('menu-file-input').click(); }
window.toggleStoreStatus = async function() {
    const btn = document.getElementById('store-status-btn');
    const newStatus = btn.classList.contains('open') ? 'closed' : 'open';
    await updateDoc(doc(db, "warungs", WARUNG_ID), { status: newStatus });
}
window.editTableCount = async function() {
    let count = prompt("Total Meja Baru:", document.getElementById('total-table-count').innerText);
    if(count) await updateDoc(doc(db, "warungs", WARUNG_ID), { totalTables: parseInt(count) });
}
window.goHome = function() { window.location.href = 'index.html'; }
window.prosesLogout = function() { if(confirm("Logout?")) { localStorage.clear(); window.location.href = 'index.html'; } }
window.openModalMenu = function() { document.getElementById('modal-menu').style.display = 'flex'; }
window.closeModalMenu = function() { document.getElementById('modal-menu').style.display = 'none'; }
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    document.getElementById('tab-'+tabId).classList.add('active');
    if(tabId === 'qr') renderQRCodes();
}
window.downloadQR = async function(url, i) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `QR_Meja_${i}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch(e) { alert("Klik kanan gambar -> Save Image"); }
}
window.renderQRCodes = function() {
    const container = document.getElementById('qr-container');
    const total = document.getElementById('total-table-count').innerText;
    container.innerHTML = '';
    for (let i = 1; i <= total; i++) {
        const qrData = `https://smipro-app.web.app/checkin.html?w=${WARUNG_ID}&t=${i}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`;
        container.innerHTML += `<div class="qr-card"><h4>MEJA ${i}</h4><img src="${qrSrc}"><br><button class="btn-download-qr" onclick="downloadQR('${qrSrc}', ${i})">Download</button></div>`;
    }
}

initDatabase();
