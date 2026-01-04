// --- IMPORT KONEKSI FIREBASE ---
import { db } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ID Warung (Kita pakai ID tetap dulu untuk simulasi ini)
const WARUNG_ID = "warung_bu_sri";

// Data Lokal untuk Tampilan
let storeData = {
    bookings: [],
    menus: []
};

/* =========================================
   1. INISIALISASI & DENGARKAN DATA (REALTIME)
   ========================================= */

// Fungsi Cek & Buat Data Awal (Jika Database Masih Kosong)
async function initDatabase() {
    const docRef = doc(db, "warungs", WARUNG_ID);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        // Buat data awal Warung Bu Sri di Internet
        await setDoc(docRef, {
            name: "Warung Bu Sri",
            status: "open", // open / closed
            totalTables: 15,
            bookedCount: 0,
            phone: "08123456789"
        });
        console.log("Database Warung Berhasil Dibuat!");
    }
}

// A. DENGARKAN DATA PROFIL WARUNG (Status Buka/Tutup & Jumlah Meja)
onSnapshot(doc(db, "warungs", WARUNG_ID), (doc) => {
    if (doc.exists()) {
        const data = doc.data();
        
        // Update Tampilan Header
        document.getElementById('shop-name-display').innerText = data.name;
        document.getElementById('total-table-count').innerText = data.totalTables;
        
        // Update Tombol Buka/Tutup Otomatis
        const btn = document.getElementById('store-status-btn');
        const txt = document.getElementById('store-status-text');
        
        if (data.status === 'open') {
            btn.className = "shop-switch open"; txt.innerText = "BUKA";
        } else {
            btn.className = "shop-switch closed"; txt.innerText = "TUTUP";
        }
    }
});

// B. DENGARKAN BOOKING MASUK (Kartu Kuning/Merah)
const qBooking = query(collection(db, "bookings"), where("warungId", "==", WARUNG_ID));
onSnapshot(qBooking, (snapshot) => {
    storeData.bookings = [];
    let count = 0;
    
    snapshot.forEach((doc) => {
        storeData.bookings.push({ id: doc.id, ...doc.data() });
        count++;
    });
    
    // Update angka meja terisi
    document.getElementById('occupied-count').innerText = count;
    renderBookings(); // Refresh Kartu
});

// C. DENGARKAN MENU MAKANAN
const qMenu = query(collection(db, "menus"), where("warungId", "==", WARUNG_ID));
onSnapshot(qMenu, (snapshot) => {
    storeData.menus = [];
    snapshot.forEach((doc) => {
        storeData.menus.push({ id: doc.id, ...doc.data() });
    });
    renderMenus();
});

/* ========================
   2. LOGIKA INTERAKSI (ACTION)
   ======================== */

// TOGGLE BUKA TUTUP (Kirim ke Firebase)
window.toggleStoreStatus = async function() {
    const btn = document.getElementById('store-status-btn');
    const isCurrentlyOpen = btn.classList.contains('open');
    const newStatus = isCurrentlyOpen ? 'closed' : 'open';

    await updateDoc(doc(db, "warungs", WARUNG_ID), { status: newStatus });
}

// EDIT JUMLAH MEJA
window.editTableCount = async function() {
    let currentTotal = document.getElementById('total-table-count').innerText;
    let newCount = prompt("Masukkan jumlah total meja baru:", currentTotal);
    
    if (newCount !== null) {
        newCount = parseInt(newCount);
        if (newCount > 0 && newCount <= 15) {
            await updateDoc(doc(db, "warungs", WARUNG_ID), { totalTables: newCount });
            alert("Jumlah meja diperbarui ke Server!");
        } else if (newCount > 15) {
            alert("⚠️ Jumlah > 15 butuh verifikasi Admin.");
        }
    }
}

// RENDER KARTU BOOKING
function renderBookings() {
    const container = document.getElementById('booking-container');
    container.innerHTML = '';

    if (storeData.bookings.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#555; grid-column:1/-1;">Belum ada pesanan masuk.</p>';
        return;
    }

    storeData.bookings.forEach((b) => {
        let cardHtml = '';

        if (b.status === 'waiting') {
            // KARTU KUNING (Belum Scan)
            // Ada tombol simulasi scan untuk testing
            cardHtml = `
            <div class="card-booking waiting">
                <span class="table-badge">MEJA ${b.tableNum || '?'}</span>
                <div style="font-weight:bold;">${b.customerName}</div>
                <div style="font-size:0.9rem; color:#ccc;">${b.time} WIB</div>
                <div class="waiting-text"><i class="fa-solid fa-spinner fa-spin"></i> Menunggu Scan QR...</div>
                <button onclick="simulateScan('${b.id}')" style="margin-top:10px; font-size:0.7rem; background:#444; color:white; border:none; padding:5px; cursor:pointer;">[Test] Simulasi Tamu Datang</button>
            </div>`;
        } else {
            // KARTU MERAH (Sedang Makan)
            cardHtml = `
            <div class="card-booking active">
                <span class="table-badge">MEJA ${b.tableNum || '?'}</span>
                <div style="font-weight:bold;">${b.customerName}</div>
                <div class="active-text">Sedang Makan</div>
                <button class="btn-primary" style="margin-top:10px; background:white; color:red;" onclick="finishBooking('${b.id}')">Selesai / Kosongkan</button>
            </div>`;
        }
        container.innerHTML += cardHtml;
    });
}

// SELESAI / KOSONGKAN MEJA (Hapus dari Firebase)
window.finishBooking = async function(docId) {
    if (confirm("Kosongkan meja ini?")) {
        await deleteDoc(doc(db, "bookings", docId));
    }
}

// SIMULASI SCAN QR (Hanya untuk testing develop)
window.simulateScan = async function(docId) {
    await updateDoc(doc(db, "bookings", docId), { status: 'active' });
}

/* ========================
   3. LOGIKA MENU (TAMBAH & HAPUS)
   ======================== */

// RENDER MENU
function renderMenus() {
    const container = document.getElementById('menu-list-container');
    container.innerHTML = '';
    storeData.menus.forEach((m) => {
        container.innerHTML += `
        <div class="menu-item">
            <img src="${m.img}" class="menu-thumb">
            <div style="flex:1;">
                <h4 style="margin:0;">${m.name}</h4>
                <div style="color:var(--accent); font-weight:bold;">Rp ${parseInt(m.price).toLocaleString()}</div>
                <small style="color:#aaa;">${m.desc}</small>
            </div>
            <button class="btn-delete" onclick="deleteMenu('${m.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });
}

// TAMBAH MENU KE FIREBASE
window.addMenu = async function() {
    const name = document.getElementById('new-menu-name').value;
    const price = document.getElementById('new-menu-price').value;
    const desc = document.getElementById('new-menu-desc').value;

    if(!name || !price) return alert("Isi nama dan harga!");

    try {
        await addDoc(collection(db, "menus"), {
            warungId: WARUNG_ID,
            name: name,
            price: price,
            desc: desc,
            img: "https://via.placeholder.com/60"
        });
        alert("Menu tersimpan di Server!");
        window.closeModalMenu();
        // Reset
        document.getElementById('new-menu-name').value = '';
        document.getElementById('new-menu-price').value = '';
        document.getElementById('new-menu-desc').value = '';
    } catch (e) {
        alert("Gagal: " + e.message);
    }
}

// HAPUS MENU
window.deleteMenu = async function(docId) {
    if(confirm("Hapus menu ini permanen?")) {
        await deleteDoc(doc(db, "menus", docId));
    }
}

/* ========================
   4. UTILS & UI
   ======================== */
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    
    // Khusus tab QR, render ulang
    if(tabId === 'qr') renderQRCodes();
}

window.openModalMenu = function() { document.getElementById('modal-menu').style.display = 'flex'; }
window.closeModalMenu = function() { document.getElementById('modal-menu').style.display = 'none'; }

// UPDATE PROFIL WARUNG
window.saveProfile = async function() {
    const newName = document.getElementById('edit-name').value;
    const newPhone = document.getElementById('edit-phone').value;
    
    await updateDoc(doc(db, "warungs", WARUNG_ID), {
        name: newName,
        phone: newPhone
    });
    alert("Profil Diupdate!");
}

// RENDER QR CODE (Statis berdasarkan jumlah meja)
window.renderQRCodes = function() {
    const container = document.getElementById('qr-container');
    const total = document.getElementById('total-table-count').innerText; // Ambil dari tampilan
    container.innerHTML = '';

    for (let i = 1; i <= total; i++) {
        // Ini link simulasi check-in
        const qrData = `https://smipro-app.web.app/checkin.html?w=${WARUNG_ID}&t=${i}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

        container.innerHTML += `
        <div class="qr-card">
            <h4>MEJA ${i}</h4>
            <img src="${qrSrc}" alt="QR Meja ${i}">
            <br><small style="color:#555;">Scan to Check-in</small>
        </div>`;
    }
}

// TRIGGER DOWNLOAD QR
window.triggerUpload = function() { document.getElementById('file-input').click(); }
window.previewImage = function(input) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('header-profile-img').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Start
initDatabase();
