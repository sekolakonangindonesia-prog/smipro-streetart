// --- IMPORT FIREBASE ---
import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const WARUNG_ID = "warung_smipro"; 

// Variable Global
let currentMenuImageBase64 = null; 
let warungTotalCapacity = 15; 
let currentWarungName = ""; 
let unsubscribeBooking = null; // Untuk menghandle listener booking agar dinamis

// --- FUNGSI UTAMA: INIT ---
async function initDatabase() {
    const docRef = doc(db, "warungs", WARUNG_ID);
    const docSnap = await getDoc(docRef);
    
    // Jika data belum ada, buat default
    if (!docSnap.exists()) {
        await setDoc(docRef, { 
            name: "Warung SMIPRO.ID", status: "open", totalTables: 15, bookedCount: 0,
            owner: "Admin Simulasi", phone: "08123456789", email: "admin@smipro.id"
        });
    }

    // Jalankan Auto Cancel sekali di awal, lalu looping tiap menit
    checkAutoCancel();
    setInterval(checkAutoCancel, 60000); 
}

// --- FUNGSI AUTO CANCEL (PEMBERSIH DATA BASI) ---
async function checkAutoCancel() {
    // Logika penghapusan ada di dalam listener booking di bawah agar realtime
    // Fungsi ini dipanggil hanya untuk memicu interval
}

// --- 1. LISTENER DATA WARUNG (UTAMA) ---
onSnapshot(doc(db, "warungs", WARUNG_ID), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Simpan Data Penting ke Global
        warungTotalCapacity = data.totalTables; 
        const oldName = currentWarungName;
        currentWarungName = data.name; // Update nama sesuai DB

        // === KEMBALIKAN SESI LOGIN (AGAR TOMBOL HOME AMAN) ===
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userName', data.name);
        localStorage.setItem('userRole', 'mitra');
        localStorage.setItem('userLink', 'mitra-dashboard.html');

        // Update UI Profil
        document.getElementById('shop-name-display').innerText = data.name;
        
        // Update Foto
        if(data.img) {
            document.getElementById('header-profile-img').src = data.img;
            document.getElementById('preview-profile-img').src = data.img;
        }

        // Isi Form Edit Profil
        document.getElementById('edit-name').value = data.name || '';
        document.getElementById('edit-owner').value = data.owner || '';
        document.getElementById('edit-phone').value = data.phone || '';
        document.getElementById('edit-email').value = data.email || '';
        document.getElementById('edit-pass').value = data.password || '';

        // Status Buka/Tutup
        const btn = document.getElementById('store-status-btn');
        const txt = document.getElementById('store-status-text');
        if (data.status === 'open') {
            btn.classList.remove('closed'); btn.classList.add('open'); txt.innerText = "BUKA";
        } else {
            btn.classList.remove('open'); btn.classList.add('closed'); txt.innerText = "TUTUP";
        }

        // === LOGIKA DINAMIS: JIKA NAMA WARUNG BERUBAH, RESET LISTENER BOOKING ===
        if (oldName !== currentWarungName) {
            setupBookingListener(currentWarungName);
        }
    }
});

// --- 2. SETUP LISTENER BOOKING (DIPISAH AGAR DINAMIS) ---
function setupBookingListener(targetName) {
    // Matikan listener lama jika ada (biar gak double)
    if (unsubscribeBooking) {
        unsubscribeBooking();
    }

    // Listener baru berdasarkan Nama Warung yang aktif
    const qBooking = query(collection(db, "bookings"), where("warungName", "==", targetName));

    unsubscribeBooking = onSnapshot(qBooking, (snapshot) => {
        const bookings = [];
        let countActiveTables = 0; // Sedang Makan
        let countBookedTables = 0; // Reservasi
        
        const now = new Date();
        // Format jam menit saat ini (HH:MM)
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMinutes}`;

        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            bookings.push({ id: docSnap.id, ...d });
            
            const qtyMeja = parseInt(d.tablesNeeded) || 1;

            // CEK EXPIRED (Hapus booking basi real-time)
            // Jika status booked DAN jam sekarang > jam expired
            if (d.status === 'booked' && d.expiredTime && currentTimeStr > d.expiredTime) {
                deleteDoc(docSnap.ref); 
                return; // Jangan dihitung, lanjut ke item berikutnya
            }

            // HITUNG STATISTIK
            if(d.status === 'active') {
                countActiveTables += qtyMeja;
            } else if (d.status === 'booked') {
                countBookedTables += qtyMeja;
            }
        });
        
        // === UPDATE UI DASHBOARD ===
        
        // 1. Hitung Sisa Meja
        const totalUsed = countActiveTables + countBookedTables;
        const sisaMeja = warungTotalCapacity - totalUsed;
        
        // 2. Update Angka Besar (Sisa Meja)
        const totalEl = document.getElementById('total-table-count');
        totalEl.innerText = sisaMeja < 0 ? 0 : sisaMeja; 
        totalEl.style.color = sisaMeja <= 0 ? '#ff4444' : '#00ff00';

        // 3. Update Label Kecil
        if(totalEl.parentElement) {
            const smallLabel = totalEl.parentElement.querySelector('small');
            if(smallLabel) {
                smallLabel.innerHTML = `Tersedia <span style="color:#aaa;">(dari Total ${warungTotalCapacity})</span>`;
            }
        }

        // 4. Update Kotak Lain
        document.getElementById('occupied-count').innerText = countActiveTables;
        document.getElementById('booked-count').innerText = countBookedTables;

        // 5. Render Kartu
        renderBookings(bookings);
        
        // 6. SYNC KE DATABASE WARUNG
        updateWarungTableCount(totalUsed);
    });
}

// Fungsi Sync Stok ke Dokumen Warung
async function updateWarungTableCount(totalUsed) {
    try {
        const warungRef = doc(db, "warungs", WARUNG_ID);
        await updateDoc(warungRef, { bookedCount: totalUsed });
    } catch (e) { console.log("Sync error:", e); }
}

// --- RENDER MENU ---
const qMenu = query(collection(db, "menus"), where("warungId", "==", WARUNG_ID));
onSnapshot(qMenu, (snapshot) => {
    const container = document.getElementById('menu-list-container');
    container.innerHTML = '';
    snapshot.forEach((docSnap) => {
        const m = docSnap.data();
        container.innerHTML += `
        <div class="menu-card">
            <img src="${m.img || 'https://via.placeholder.com/150'}" style="width:100%; height:120px; object-fit:cover;">
            <div class="menu-details">
                <b>${m.name}</b><br>
                <span style="color:gold;">Rp ${parseInt(m.price).toLocaleString()}</span><br>
                <button class="btn-delete" onclick="deleteMenu('${docSnap.id}')" style="margin-top:5px; width:100%;"><i class="fa-solid fa-trash"></i> Hapus</button>
            </div>
        </div>`;
    });
});

// --- RENDER BOOKING CARDS ---
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
        
        // Format Tampilan Meja di Kartu
        let displayMeja = "Belum Assign";
        if(b.tableNum) {
            if(Array.isArray(b.tableNum)) {
                displayMeja = "MEJA " + b.tableNum.join(" & ");
            } else {
                displayMeja = "MEJA " + b.tableNum;
            }
        } else {
             displayMeja = `${qty} MEJA (Pending)`;
        }

        if (b.status === 'booked') {
            cardHtml = `
            <div class="card-booking waiting">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <span class="table-badge" style="background:#555; font-size:0.9rem;">${displayMeja}</span>
                    <span style="background:#333; color:gold; padding:2px 6px; border-radius:4px; font-size:0.7rem;">${qty} Meja</span>
                </div>
                <b style="font-size:1.1rem; display:block; margin:5px 0;">${b.customerName}</b>
                <small><i class="fa-solid fa-clock"></i> Datang: <b>${b.arrivalTime}</b></small><br>
                <small><i class="fa-solid fa-hourglass-half"></i> Hangus: <b style="color:#ff4444;">${b.expiredTime}</b></small><br>
                <small>Kode: <b style="color:white; letter-spacing:1px;">${b.bookingCode}</b></small>
                
                <div class="waiting-text">Menunggu Tamu Check-In...</div>
                
                <div style="display:flex; gap:5px; margin-top:10px;">
                    <button class="btn-delete" onclick="finishBooking('${b.id}')" style="width:100%;">Batalkan</button>
                </div>
            </div>`;
        } else if (b.status === 'active') {
            cardHtml = `
            <div class="card-booking active">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <span class="table-badge" style="background:#b71c1c;">${displayMeja}</span>
                     <span style="background:#333; color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem;">${qty} Meja</span>
                </div>
                <b>${b.customerName}</b>
                <br><small>Sedang Makan</small>
                <button class="btn-primary" style="margin-top:10px; background:white; color:red; width:100%; border:none; padding:8px; border-radius:5px; font-weight:bold; cursor:pointer;" onclick="finishBooking('${b.id}')">Selesai / Kosongkan</button>
            </div>`;
        }
        container.innerHTML += cardHtml;
    });
}

// --- HELPER FUNCTIONS ---
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
            canvas.width = maxWidth; canvas.height = img.height * scaleFactor;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
    };
}

// Upload & CRUD
window.previewImage = function(input) {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], 300, async (base64) => {
            document.getElementById('header-profile-img').src = base64;
            document.getElementById('preview-profile-img').src = base64;
            await updateDoc(doc(db, "warungs", WARUNG_ID), { img: base64 });
            alert("Foto Profil Disimpan!");
        });
    }
}
window.previewMenuImage = function(input) {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], 400, (base64) => {
            currentMenuImageBase64 = base64;
            document.getElementById('preview-menu-img').src = currentMenuImageBase64;
        });
    }
}
window.addMenu = async function() {
    const name = document.getElementById('new-menu-name').value;
    const price = document.getElementById('new-menu-price').value;
    const desc = document.getElementById('new-menu-desc').value;
    if(!name || !price) return alert("Isi Nama & Harga!");
    await addDoc(collection(db, "menus"), { warungId: WARUNG_ID, name, price, desc, img: currentMenuImageBase64 || "https://via.placeholder.com/150" });
    window.closeModalMenu();
    document.getElementById('new-menu-name').value = '';
    document.getElementById('new-menu-price').value = '';
    document.getElementById('preview-menu-img').src = "https://via.placeholder.com/100?text=Foto";
    alert("Menu Ditambah!");
}
window.finishBooking = async function(docId) { if (confirm("Kosongkan meja/Batalkan pesanan?")) await deleteDoc(doc(db, "bookings", docId)); }
window.deleteMenu = async function(docId) { if(confirm("Hapus menu?")) await deleteDoc(doc(db, "menus", docId)); }
window.saveProfile = async function() {
    await updateDoc(doc(db, "warungs", WARUNG_ID), {
        name: document.getElementById('edit-name').value,
        owner: document.getElementById('edit-owner').value,
        phone: document.getElementById('edit-phone').value,
        email: document.getElementById('edit-email').value,
        password: document.getElementById('edit-pass').value
    });
    alert("Profil Tersimpan!");
}
window.triggerUpload = function() { document.getElementById('file-input').click(); }
window.triggerMenuUpload = function() { document.getElementById('menu-file-input').click(); }
window.toggleStoreStatus = async function() {
    const btn = document.getElementById('store-status-btn');
    const newStatus = btn.classList.contains('open') ? 'closed' : 'open';
    await updateDoc(doc(db, "warungs", WARUNG_ID), { status: newStatus });
}
window.editTableCount = async function() {
    let count = prompt("Total Meja Baru:", warungTotalCapacity);
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

// === FIX QR CODE OTOMATIS IKUT DOMAIN ===
window.downloadQR = async function(url, i) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `QR_Meja_${i}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch(e) { alert("Error download. Coba klik kanan -> Save Image."); }
}

window.renderQRCodes = function() {
    const container = document.getElementById('qr-container');
    container.innerHTML = '';
    
    // DETEKSI URL OTOMATIS
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    
    for (let i = 1; i <= warungTotalCapacity; i++) {
        // Link yang benar: https://domain-anda.com/checkin.html?w=ID&t=1
        const qrData = `${baseUrl}/checkin.html?w=${WARUNG_ID}&t=${i}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
        container.innerHTML += `<div class="qr-card"><h4>MEJA ${i}</h4><img src="${qrSrc}"><br><button class="btn-download-qr" onclick="downloadQR('${qrSrc}', ${i})">Download</button></div>`;
    }
}

// Start
initDatabase();
