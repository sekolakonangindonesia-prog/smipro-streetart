// --- IMPORT FIREBASE ---
import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc, increment, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- AMBIL ID DARI LOCALSTORAGE (PASTIKAN PENULISAN 'mitraId' BENAR) ---
let WARUNG_ID = localStorage.getItem('mitraId');

// PENGAMAN: Jika tidak ada ID
if (!WARUNG_ID) {
    alert("Sesi habis atau Anda belum login. Silakan login kembali.");
    window.location.href = 'login.html';
} 

// Variable Global
let currentMenuImageBase64 = null; 
let warungTotalCapacity = 15; 
let currentWarungName = ""; 
let unsubscribeBooking = null; 

// --- TAMBAHAN UNTUK NOTIFIKASI ---
const notifSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
const LOGO_STREETART = "https://raw.githubusercontent.com/sekolakonangindonesia-prog/smipro-streetart/main/Logo_Stretart.png";
let isInitialLoad = true; // Supaya tidak bunyi saat pertama buka halaman

// --- 1. LISTENER DATA WARUNG (UTAMA) ---
onSnapshot(doc(db, "warungs", WARUNG_ID), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        
        warungTotalCapacity = data.totalTables || 15; 
        const oldName = currentWarungName;
        currentWarungName = data.name; 

        document.getElementById('shop-name-display').innerText = data.name;
        
        if(data.img) {
            document.getElementById('header-profile-img').src = data.img;
            document.getElementById('preview-profile-img').src = data.img;
        }

        // --- SINKRONISASI TOMBOL TOGGLE ORDER (FIX VISUAL SS2) ---
        const toggle = document.getElementById('toggle-order-web');
        const desc = document.getElementById('order-status-desc');
        if(toggle) {
            toggle.checked = data.enableOrder || false; 
            if(desc) {
                desc.innerText = data.enableOrder ? 'Fitur sedang Aktif' : 'Fitur sedang Mati';
                desc.style.color = data.enableOrder ? '#00ff00' : '#888';
            }
        }

        // Status Buka/Tutup
        const btn = document.getElementById('store-status-btn');
        const txt = document.getElementById('store-status-text');
        if (data.status === 'open') {
            btn.className = 'shop-switch open'; txt.innerText = "BUKA";
        } else {
            btn.className = 'shop-switch closed'; txt.innerText = "TUTUP";
        }

        // Jalankan Listener jika nama warung sudah ada
        if (oldName !== currentWarungName) {
            setupBookingListener();
            listenToWebOrders(); // Fungsi monitor pesanan makanan
        }
    }
});

// --- 2. FUNGSI UPDATE STATUS ORDER (DITARUH DI DALAM JS MODULE) ---
window.updateOrderSystemStatus = async function(isActive) {
    try {
        await updateDoc(doc(db, "warungs", WARUNG_ID), {
            enableOrder: isActive
        });
        console.log("Status Order Web berhasil diubah.");
    } catch (e) {
        alert("Eror update status: " + e.message);
        // Kembalikan tombol jika gagal
        document.getElementById('toggle-order-web').checked = !isActive;
    }
}

// --- 3. SETUP LISTENER BOOKING (BUNYI & NOTIF HP) ---
function setupBookingListener() {
    if (unsubscribeBooking) { unsubscribeBooking(); }
    const qBooking = query(collection(db, "bookings"), where("warungId", "==", WARUNG_ID));

    unsubscribeBooking = onSnapshot(qBooking, (snapshot) => {
        const bookings = [];
        let countActiveTables = 0; 
        let countBookedTables = 0; 
        const now = new Date();

        // LOGIKA BUNYI SAAT ADA DATA BARU
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added" && !isInitialLoad) {
                notifSound.play();
                const newB = change.doc.data();
                kirimNotifKeHP(`Reservasi Meja Baru: ${newB.customerName}`);
            }
        });
        isInitialLoad = false;

        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            // Cek Expired (tetap ada)
            let isExpired = false;
            if (d.status === 'booked' && d.expiredTime) {
                if (now > new Date(d.expiredTime)) isExpired = true;
            }
            if (isExpired) { deleteDoc(docSnap.ref); return; }

            bookings.push({ id: docSnap.id, ...d });
            const qtyMeja = parseInt(d.tablesNeeded) || 1;
            if(d.status === 'active') countActiveTables += qtyMeja;
            else if (d.status === 'booked') countBookedTables += qtyMeja;
        });
        
        // Update Lonceng Notif (Badge)
        const badge = document.getElementById('web-notif-count');
        if(badge) {
            badge.innerText = snapshot.size;
            badge.style.display = snapshot.size > 0 ? 'block' : 'none';
        }

        // Update UI Statistik
        const totalUsed = countActiveTables + countBookedTables;
        const sisaMeja = warungTotalCapacity - totalUsed;
        const totalEl = document.getElementById('total-table-count');
        if(totalEl) {
            totalEl.innerText = sisaMeja < 0 ? 0 : sisaMeja; 
            totalEl.style.color = sisaMeja <= 0 ? '#ff4444' : '#00ff00';
        }

        document.getElementById('occupied-count').innerText = countActiveTables;
        document.getElementById('booked-count').innerText = countBookedTables;
        renderBookings(bookings);
        updateWarungTableCount(totalUsed);
    });
}

// --- 4. LISTENER PESANAN MENU MAKANAN ---
function listenToWebOrders() {
    const q = query(collection(db, "warung_orders"), where("warungId", "==", WARUNG_ID), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('web-orders-container');
        if(!container) return;

        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align:center; color:#555; margin-top:50px;">Tidak ada pesanan aktif saat ini.</p>';
            return;
        }

        container.innerHTML = '<h3 style="margin-top:0;">Daftar Pesanan Menu</h3>';
        snapshot.forEach(docSnap => {
            const order = docSnap.data();
            container.innerHTML += `
                <div style="background:#1a1a1a; border-left:4px solid gold; padding:15px; border-radius:8px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between;">
                        <b>📦 Meja: ${order.tableNum || 'Take Away'}</b>
                        <small style="color:#aaa;">${new Date(order.timestamp?.toDate()).toLocaleTimeString()}</small>
                    </div>
                    <div style="margin:10px 0;">
                        ${order.items.map(i => `• ${i.name} (x${i.qty})`).join('<br>')}
                    </div>
                    <button onclick="updateOrderStatus('${docSnap.id}', 'diproses')" style="background:#00ff00; color:black; border:none; padding:8px; border-radius:5px; font-weight:bold; cursor:pointer; width:100%;">TERIMA & MASAK</button>
                </div>`;
        });
    });
}

window.updateOrderStatus = async function(id, status) {
    await updateDoc(doc(db, "warung_orders", id), { status: status });
}

// --- FUNGSI NOTIF HP DENGAN LOGO ---
function kirimNotifKeHP(pesan) {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
        new Notification("STREETART", { body: pesan, icon: LOGO_STREETART });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

// --- FUNGSI RENDER BOOKING CARDS (Lanjutan Asli Anda) ---
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
        let nomorMejaTeks = b.tableNum ? (Array.isArray(b.tableNum) ? "MEJA " + b.tableNum.join(", ") : "MEJA " + b.tableNum) : `${qty} MEJA (Pending)`;

        if (b.status === 'booked') {
            cardHtml = `
            <div class="card-booking waiting">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-weight:bold; color:#FFD700;">${nomorMejaTeks}</span>
                    <span style="background:#555; color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem;">${qty} Meja</span>
                </div>
                <b style="font-size:1.1rem; display:block;">${b.customerName}</b>
                <div style="font-size:0.8rem; color:#ccc; margin-top:5px;">
                    Kode: <b>${b.bookingCode}</b> | Tgl: ${b.bookingDate}
                </div>
                <div style="display:flex; gap:5px; margin-top:10px;">
                    <button class="btn-delete" onclick="cancelBooking('${b.id}', ${qty})" style="width:100%;">Batalkan</button>
                </div>
            </div>`;
        } else {
            cardHtml = `
            <div class="card-booking active">
                <span style="font-weight:bold; color:white;">${nomorMejaTeks}</span>
                <b style="font-size:1.1rem; display:block; margin:5px 0;">${b.customerName}</b>
                <small style="color:#ffaaaa;">Sedang Makan</small>
                <button class="btn-primary" style="margin-top:10px; background:white; color:#b71c1c; width:100%; border:none; padding:8px; border-radius:5px; font-weight:bold; cursor:pointer;" 
                    onclick="finishBooking('${b.id}', ${qty})">Selesai / Bayar</button>
            </div>`;
        }
        container.innerHTML += cardHtml;
    });
}
// >>> JANGAN HAPUS KODE DI BAWAH INI (Helper, Profile, deleteMenu, dll tetap di bawah baris 246) <<<
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

// --- FUNGSI BATALKAN PESANAN (Tanpa Input Uang) ---
window.cancelBooking = async function(docId, tableQty) {
    if(!confirm("Yakin ingin membatalkan pesanan ini? Stok meja akan dikembalikan.")) return;

    try {
        const tableCount = parseInt(tableQty) || 1;
        
        // 1. Hapus Dokumen Booking
        await deleteDoc(doc(db, "bookings", docId));

        // 2. Kembalikan Stok Meja
        await updateDoc(doc(db, "warungs", WARUNG_ID), {
            bookedCount: increment(-tableCount)
        });

        alert("Pesanan Dibatalkan!");
    } catch (e) {
        console.error(e);
        alert("Gagal membatalkan: " + e.message);
    }
}

// FUNGSI UNTUK MEMUNCULKAN NOTIF SISTEM HP DENGAN LOGO STREETART
function kirimNotifKeHP(pesan) {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
        new Notification("STREETART - Reservasi", {
            body: pesan,
            icon: LOGO_STREETART, // Logo StreetArt Muncul di sini
            vibrate: [200, 100, 200]
        });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}
