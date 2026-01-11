// --- IMPORT FIREBASE ---
import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc, increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const WARUNG_ID = "warung_smipro"; 

// Variable Global
let currentMenuImageBase64 = null; 
let warungTotalCapacity = 15; 
let currentWarungName = ""; 
let unsubscribeBooking = null; 

// --- FUNGSI UTAMA: INIT ---
async function initDatabase() {
    const docRef = doc(db, "warungs", WARUNG_ID);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
        await setDoc(docRef, { 
            name: "Warung SMIPRO.ID", status: "open", totalTables: 15, bookedCount: 0,
            owner: "Admin Simulasi", phone: "08123456789", email: "admin@smipro.id"
        });
    }
}

// --- 1. LISTENER DATA WARUNG (UTAMA) ---
onSnapshot(doc(db, "warungs", WARUNG_ID), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        
        warungTotalCapacity = data.totalTables || 15; 
        const oldName = currentWarungName;
        currentWarungName = data.name; 

        // Set Sesi (Hati-hati ini bisa bentrok dengan Admin, tapi biarkan dulu sesuai request)
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userName', data.name);
        localStorage.setItem('userRole', 'mitra');
        localStorage.setItem('userLink', 'mitra-dashboard.html');

        document.getElementById('shop-name-display').innerText = data.name;
        
        if(data.img) {
            document.getElementById('header-profile-img').src = data.img;
            document.getElementById('preview-profile-img').src = data.img;
        }

        document.getElementById('edit-name').value = data.name || '';
        document.getElementById('edit-owner').value = data.owner || '';
        document.getElementById('edit-phone').value = data.phone || '';
        document.getElementById('edit-email').value = data.email || '';
        document.getElementById('edit-pass').value = data.password || '';

        const btn = document.getElementById('store-status-btn');
        const txt = document.getElementById('store-status-text');
        if (data.status === 'open') {
            btn.classList.remove('closed'); btn.classList.add('open'); txt.innerText = "BUKA";
        } else {
            btn.classList.remove('open'); btn.classList.add('closed'); txt.innerText = "TUTUP";
        }

        if (oldName !== currentWarungName) {
            setupBookingListener(currentWarungName);
        }
    }
});

// --- 2. SETUP LISTENER BOOKING (VERSI FIX DATE) ---
function setupBookingListener(targetName) {
    if (unsubscribeBooking) { unsubscribeBooking(); }

    const qBooking = query(collection(db, "bookings"), where("warungName", "==", targetName));

    unsubscribeBooking = onSnapshot(qBooking, (snapshot) => {
        const bookings = [];
        let countActiveTables = 0; 
        let countBookedTables = 0; 
        
        const now = new Date();

        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            
            // CEK EXPIRED (Format Baru: YYYY-MM-DDTHH:MM)
            let isExpired = false;
            if (d.status === 'booked' && d.expiredTime) {
                const expiredDate = new Date(d.expiredTime);
                if (now > expiredDate) {
                    isExpired = true;
                }
            }

            if (isExpired) {
                deleteDoc(docSnap.ref); 
                return; 
            }

            bookings.push({ id: docSnap.id, ...d });
            
            const qtyMeja = parseInt(d.tablesNeeded) || 1;

            if(d.status === 'active') {
                countActiveTables += qtyMeja;
            } else if (d.status === 'booked') {
                countBookedTables += qtyMeja;
            }
        });
        
        // UPDATE UI
        const totalUsed = countActiveTables + countBookedTables;
        const sisaMeja = warungTotalCapacity - totalUsed;
        
        const totalEl = document.getElementById('total-table-count');
        if(totalEl) {
            totalEl.innerText = sisaMeja < 0 ? 0 : sisaMeja; 
            totalEl.style.color = sisaMeja <= 0 ? '#ff4444' : '#00ff00';
            
            if(totalEl.parentElement) {
                const smallLabel = totalEl.parentElement.querySelector('small');
                if(smallLabel) {
                    smallLabel.innerHTML = `Tersedia <span style="color:#aaa;">(dari Total ${warungTotalCapacity})</span>`;
                }
            }
        }

        document.getElementById('occupied-count').innerText = countActiveTables;
        document.getElementById('booked-count').innerText = countBookedTables;

        renderBookings(bookings);
        updateWarungTableCount(totalUsed);
    });
}

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
        
        let displayMeja = "Belum Assign";
        if(b.tableNum) {
            displayMeja = Array.isArray(b.tableNum) ? "MEJA " + b.tableNum.join(", ") : "MEJA " + b.tableNum;
        } else {
             displayMeja = `${qty} MEJA (Pending)`;
        }

        let displayDate = b.bookingDate || "Hari Ini";
        let displayExpired = b.expiredTime && b.expiredTime.includes('T') ? b.expiredTime.split('T')[1] : (b.expiredTime || "-");

        if (b.status === 'booked') {
            cardHtml = `
            <div class="card-booking waiting">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <span class="table-badge" style="background:#555; font-size:0.9rem;">${displayMeja}</span>
                    <span style="background:#333; color:gold; padding:2px 6px; border-radius:4px; font-size:0.7rem;">${qty} Meja</span>
                </div>
                <b style="font-size:1.1rem; display:block; margin:5px 0;">${b.customerName}</b>
                <small><i class="fa-solid fa-calendar"></i> Tgl: <b>${displayDate}</b></small><br>
                <small><i class="fa-solid fa-clock"></i> Rencana: ${b.arrivalTime}</small><br>
                <small><i class="fa-solid fa-hourglass-half"></i> Hangus Pukul: <b style="color:#ff4444;">${displayExpired}</b></small><br>
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
                 <button class="btn-primary" 
                style="margin-top:10px; background:white; color:red; width:100%; border:none; padding:8px; border-radius:5px; font-weight:bold; cursor:pointer;" 
                onclick="finishBooking('${b.id}', ${qty})"> <!-- PERHATIKAN PARAMETER INI -->
                Selesai / Bayar
            </button>
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

// EXPORT FUNGSI KE WINDOW (Supaya bisa di-klik di HTML)
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
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    for (let i = 1; i <= warungTotalCapacity; i++) {
        const qrData = `${baseUrl}/checkin.html?w=${WARUNG_ID}&t=${i}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
        container.innerHTML += `<div class="qr-card"><h4>MEJA ${i}</h4><img src="${qrSrc}"><br><button class="btn-download-qr" onclick="downloadQR('${qrSrc}', ${i})">Download</button></div>`;
    }
}

// --- VARIABEL GLOBAL BARU ---
let selectedBookingId = null;
let selectedTableCount = 0; // Untuk mengembalikan stok meja

// 1. FUNGSI DIPANGGIL SAAT TOMBOL SELESAI DIKLIK
window.finishBooking = function(docId, tableQty) {
    // Simpan ID dan Jumlah Meja ke variabel global sementara
    selectedBookingId = docId;
    selectedTableCount = parseInt(tableQty) || 1; // Default 1 kalau error
    
    // Buka Modal
    document.getElementById('trx-amount').value = ''; // Reset input
    document.getElementById('modal-finish-transaction').style.display = 'flex';
}

// 2. TUTUP MODAL
window.closeFinishModal = function() {
    document.getElementById('modal-finish-transaction').style.display = 'none';
    selectedBookingId = null;
}

// 3. EKSEKUSI SIMPAN (ARSIP DATA)
window.submitTransaction = async function() {
    const amount = document.getElementById('trx-amount').value;
    
    if(!amount || amount <= 0) return alert("Masukkan nominal transaksi yang valid!");

    // Konfirmasi terakhir
    if(!confirm(`Simpan transaksi Rp ${parseInt(amount).toLocaleString()} dan kosongkan meja?`)) return;

    try {
        const bookingRef = doc(db, "bookings", selectedBookingId);
        const warungRef = doc(db, "warungs", WARUNG_ID);

        // A. UPDATE STATUS BOOKING JADI 'finished' & SIMPAN NOMINAL
        // Data ini TIDAK DIHAPUS, tapi disimpan untuk statistik Admin
        await updateDoc(bookingRef, {
            status: 'finished',
            revenue: parseInt(amount),
            finishedAt: new Date()
        });

        // B. KEMBALIKAN STOK MEJA WARUNG
        // Kita kurangi 'bookedCount' sebanyak meja yang dipakai
        // Menggunakan 'increment(-value)' adalah cara aman mengurangi angka di Firebase
        await updateDoc(warungRef, {
            bookedCount: increment(-selectedTableCount) 
        });

        alert("Transaksi Berhasil Disimpan!");
        closeFinishModal();

    } catch (e) {
        console.error(e);
        alert("Gagal memproses: " + e.message);
    }
}
initDatabase();
