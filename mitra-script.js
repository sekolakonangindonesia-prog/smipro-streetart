// --- IMPORT FIREBASE ---
import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// KONFIGURASI WARUNG
const WARUNG_ID = "warung_bu_sri";
const WARUNG_NAME = "Warung Bu Sri"; 

let storeData = {
    bookings: [],
    menus: []
};

/* =========================================
   1. INISIALISASI & LISTEN DATA
   ========================================= */
async function initDatabase() {
    const docRef = doc(db, "warungs", WARUNG_ID);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        await setDoc(docRef, { name: WARUNG_NAME, status: "open", totalTables: 15, bookedCount: 0 });
    }
}

// Listen Status Warung
onSnapshot(doc(db, "warungs", WARUNG_ID), (doc) => {
    if (doc.exists()) {
        const data = doc.data();
        document.getElementById('shop-name-display').innerText = data.name;
        document.getElementById('total-table-count').innerText = data.totalTables;
        document.getElementById('edit-name').value = data.name;

        const btn = document.getElementById('store-status-btn');
        const txt = document.getElementById('store-status-text');
        
        // Atur Kelas Tombol Buka/Tutup
        if (data.status === 'open') {
            btn.classList.remove('closed');
            btn.classList.add('open');
            txt.innerText = "BUKA";
        } else {
            btn.classList.remove('open');
            btn.classList.add('closed');
            txt.innerText = "TUTUP";
        }
    }
});

// LISTEN BOOKING
const qBooking = query(collection(db, "bookings"), where("warungName", "==", WARUNG_NAME));

onSnapshot(qBooking, (snapshot) => {
    storeData.bookings = [];
    let activeTables = 0;
    let bookedTables = 0;

    snapshot.forEach((doc) => {
        const d = doc.data();
        storeData.bookings.push({ id: doc.id, ...d });
        const qty = d.tablesNeeded || 1;
        if(d.status === 'active') activeTables += qty;
        else if (d.status === 'booked') bookedTables += qty;
    });
    
    document.getElementById('occupied-count').innerText = activeTables;
    document.getElementById('booked-count').innerText = bookedTables;
    renderBookings();
});

// Listen Menu
const qMenu = query(collection(db, "menus"), where("warungId", "==", WARUNG_ID));
onSnapshot(qMenu, (snapshot) => {
    storeData.menus = [];
    snapshot.forEach((doc) => { storeData.menus.push({ id: doc.id, ...doc.data() }); });
    renderMenus();
});

/* ========================
   2. FUNGSI RENDER (UI)
   ======================== */

function renderBookings() {
    const container = document.getElementById('booking-container');
    container.innerHTML = '';
    
    if (storeData.bookings.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#555; grid-column:1/-1;">Belum ada pesanan.</p>';
        return;
    }

    storeData.bookings.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return 0;
    });

    storeData.bookings.forEach((b) => {
        let cardHtml = '';
        const qtyMeja = b.tablesNeeded || 1;
        
        if (b.status === 'booked') {
            cardHtml = `
            <div class="card-booking waiting">
                <span class="table-badge" style="font-size:0.9rem; background:#555;">RESERVASI (${qtyMeja} Meja)</span>
                <b style="font-size:1.1rem;">${b.customerName}</b>
                <br><small><i class="fa-regular fa-clock"></i> Datang: ${b.arrivalTime}</small>
                <br><small><i class="fa-solid fa-key"></i> Kode: <b style="color:white;">${b.bookingCode}</b></small>
                <div class="waiting-text">Menunggu Check-In (Scan QR)...</div>
                <button class="btn-delete" onclick="finishBooking('${b.id}')" style="margin-top:10px; width:100%;">Batalkan</button>
            </div>`;
        } 
        else if (b.status === 'active') {
            const infoMeja = b.tableNum ? `MEJA ${b.tableNum}` : `${qtyMeja} MEJA`;
            cardHtml = `
            <div class="card-booking active">
                <span class="table-badge">${infoMeja}</span>
                <b>${b.customerName}</b>
                <br><small>Sedang Makan</small>
                <div class="active-text">Pelanggan Aktif</div>
                <button class="btn-primary" style="margin-top:10px; background:white; color:red; width:100%;" onclick="finishBooking('${b.id}')">Selesai / Kosongkan</button>
            </div>`;
        }
        container.innerHTML += cardHtml;
    });
}

function renderMenus() {
    const container = document.getElementById('menu-list-container');
    container.innerHTML = '';
    storeData.menus.forEach((m) => {
        container.innerHTML += `
        <div class="menu-item">
            <img src="${m.img}" class="menu-thumb">
            <div style="flex:1;"><b>${m.name}</b><br><span style="color:gold;">Rp ${m.price}</span></div>
            <button class="btn-delete" onclick="deleteMenu('${m.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });
}

// GENERATE QR CODE DENGAN TOMBOL DOWNLOAD
window.renderQRCodes = function() {
    const container = document.getElementById('qr-container');
    const total = document.getElementById('total-table-count').innerText;
    container.innerHTML = '';
    
    for (let i = 1; i <= total; i++) {
        // Ganti URL ini dengan URL Website Asli Anda nanti
        const qrData = `https://smipro-app.web.app/checkin.html?w=${WARUNG_ID}&t=${i}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`;
        
        container.innerHTML += `
        <div class="qr-card">
            <h4>MEJA ${i}</h4>
            <img src="${qrSrc}" id="qr-img-${i}">
            <br>
            <button class="btn-download-qr" onclick="downloadQR('${qrSrc}', ${i})">
                <i class="fa-solid fa-download"></i> Download
            </button>
        </div>`;
    }
}

// --- FUNGSI INTERAKTIF (DIEXPOSE KE WINDOW AGAR BISA DIKLIK) ---

window.downloadQR = async function(url, tableNum) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `QR_Meja_${tableNum}_${WARUNG_ID}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        alert("Gagal mengunduh QR. Coba klik kanan dan 'Save Image'.");
    }
}

window.toggleStoreStatus = async function() {
    const btn = document.getElementById('store-status-btn');
    // Cek status saat ini dari class
    const currentStatus = btn.classList.contains('open') ? 'open' : 'closed';
    const newStatus = currentStatus === 'open' ? 'closed' : 'open';
    
    // Update Firebase
    await updateDoc(doc(db, "warungs", WARUNG_ID), { status: newStatus });
}

window.finishBooking = async function(docId) {
    if (confirm("Selesaikan pesanan / Kosongkan meja?")) await deleteDoc(doc(db, "bookings", docId));
}

window.addMenu = async function() {
    const name = document.getElementById('new-menu-name').value;
    const price = document.getElementById('new-menu-price').value;
    const desc = document.getElementById('new-menu-desc').value;
    if(!name || !price) return alert("Isi data!");
    await addDoc(collection(db, "menus"), { warungId: WARUNG_ID, name, price, desc, img: "https://via.placeholder.com/60" });
    window.closeModalMenu();
    document.getElementById('new-menu-name').value = '';
    document.getElementById('new-menu-price').value = '';
}

window.deleteMenu = async function(docId) {
    if(confirm("Hapus menu ini?")) await deleteDoc(doc(db, "menus", docId));
}

window.saveProfile = async function() {
    const newName = document.getElementById('edit-name').value;
    await updateDoc(doc(db, "warungs", WARUNG_ID), { name: newName });
    alert("Profil Diupdate!");
}

window.triggerUpload = function() { document.getElementById('file-input').click(); }

window.previewImage = function(input) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('header-profile-img').src = e.target.result;
            document.getElementById('preview-profile-img').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
        // Disini nanti bisa tambahkan logika Upload ke Firebase Storage
    }
}

window.editTableCount = async function() {
    let currentTotal = document.getElementById('total-table-count').innerText;
    let newCount = prompt("Total meja baru:", currentTotal);
    if (newCount !== null) {
        newCount = parseInt(newCount);
        if (newCount > 0 && newCount <= 15) {
            await updateDoc(doc(db, "warungs", WARUNG_ID), { totalTables: newCount });
        } else if (newCount > 15) {
            alert("⚠️ Jumlah > 15 butuh verifikasi Admin.");
        }
    }
}

window.prosesLogout = function() {
    if(confirm("Yakin ingin keluar dari Dashboard Warung?")) {
        localStorage.removeItem('userLoggedIn');
        localStorage.removeItem('userName');
        localStorage.removeItem('userLink');
        window.location.href = 'index.html';
    }
}

// Navigasi Tab
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    // Cari tombol yang diklik (sedikit trick karena event bubbling)
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => {
        if(btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });
    
    if(tabId === 'qr') renderQRCodes();
}

window.openModalMenu = function() { document.getElementById('modal-menu').style.display = 'flex'; }
window.closeModalMenu = function() { document.getElementById('modal-menu').style.display = 'none'; }

// Start
initDatabase();
