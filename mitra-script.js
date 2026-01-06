// --- IMPORT FIREBASE ---
import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ID Warung (Kunci untuk update profil & status buka tutup)
const WARUNG_ID = "warung_bu_sri";
const WARUNG_NAME = "Warung Bu Sri"; // Nama Warung untuk query booking

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
        if (data.status === 'open') {
            btn.className = "shop-switch open"; txt.innerText = "BUKA";
        } else {
            btn.className = "shop-switch closed"; txt.innerText = "TUTUP";
        }
    }
});

// LISTEN BOOKING (FIX: Query pakai warungName)
const qBooking = query(collection(db, "bookings"), where("warungName", "==", WARUNG_NAME));

onSnapshot(qBooking, (snapshot) => {
    storeData.bookings = [];
    let count = 0;
    
    snapshot.forEach((doc) => {
        const d = doc.data();
        // Masukkan semua data booking
        storeData.bookings.push({ id: doc.id, ...d });
        
        // Hitung yang statusnya Active (Sedang Makan)
        if(d.status === 'active') count++;
    });
    
    document.getElementById('occupied-count').innerText = count;
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
   2. LOGIKA RENDER & UTAMA
   ======================== */

// RENDER BOOKING (FIX: Support status 'booked')
function renderBookings() {
    const container = document.getElementById('booking-container');
    container.innerHTML = '';
    
    if (storeData.bookings.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#555; grid-column:1/-1;">Belum ada pesanan.</p>';
        return;
    }

    // Urutkan: Active paling atas, lalu Booked
    storeData.bookings.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return 0; // Sama kuat
    });

    storeData.bookings.forEach((b) => {
        let cardHtml = '';
        
        // STATUS 1: BOOKED (Belum Datang/Scan QR)
        if (b.status === 'booked') {
            cardHtml = `
            <div class="card-booking waiting">
                <span class="table-badge" style="font-size:0.9rem; background:#555;">RESERVASI</span>
                <b style="font-size:1.1rem;">${b.customerName}</b>
                <br><small>Datang: ${b.arrivalTime}</small>
                <br><small>Kode: <b style="color:white;">${b.bookingCode}</b></small>
                <div class="waiting-text">Menunggu Check-In (Scan QR)...</div>
                <button class="btn-delete" onclick="finishBooking('${b.id}')" style="margin-top:10px; width:100%;">Batalkan</button>
            </div>`;
        } 
        // STATUS 2: ACTIVE (Sudah Duduk)
        else if (b.status === 'active') {
            const mejaText = b.tableNum ? `MEJA ${b.tableNum}` : "MEJA ?";
            cardHtml = `
            <div class="card-booking active">
                <span class="table-badge">${mejaText}</span>
                <b>${b.customerName}</b>
                <br><small>Sedang Makan</small>
                <div class="active-text">Pelanggan Aktif</div>
                <button class="btn-primary" style="margin-top:10px; background:white; color:red; width:100%;" onclick="finishBooking('${b.id}')">Selesai / Kosongkan</button>
            </div>`;
        }

        container.innerHTML += cardHtml;
    });
}

// FUNGSI LAINNYA (TETAP SAMA)
window.finishBooking = async function(docId) {
    if (confirm("Selesaikan pesanan / Kosongkan meja?")) await deleteDoc(doc(db, "bookings", docId));
}

function renderMenus() {
    const container = document.getElementById('menu-list-container');
    container.innerHTML = '';
    storeData.menus.forEach((m) => {
        container.innerHTML += `<div class="menu-item"><img src="${m.img}" class="menu-thumb"><div style="flex:1;"><b>${m.name}</b><br><span style="color:gold;">Rp ${m.price}</span></div><button class="btn-delete" onclick="deleteMenu('${m.id}')"><i class="fa-solid fa-trash"></i></button></div>`;
    });
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
    if(confirm("Hapus?")) await deleteDoc(doc(db, "menus", docId));
}

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    if(tabId === 'qr') renderQRCodes();
}

window.openModalMenu = function() { document.getElementById('modal-menu').style.display = 'flex'; }
window.closeModalMenu = function() { document.getElementById('modal-menu').style.display = 'none'; }

window.saveProfile = async function() {
    const newName = document.getElementById('edit-name').value;
    await updateDoc(doc(db, "warungs", WARUNG_ID), { name: newName });
    alert("Profil Diupdate!");
}

window.renderQRCodes = function() {
    const container = document.getElementById('qr-container');
    const total = document.getElementById('total-table-count').innerText;
    container.innerHTML = '';
    for (let i = 1; i <= total; i++) {
        // LINK QR CODE: Mengarah ke checkin.html
        // Ganti 'smipro-app.web.app' dengan URL hosting Anda nanti jika sudah online
        // Untuk lokal, QR ini mungkin tidak bisa discan HP kecuali HP dan Laptop satu jaringan
        const qrData = `https://smipro-app.web.app/checkin.html?w=${WARUNG_ID}&t=${i}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;
        container.innerHTML += `<div class="qr-card"><h4>MEJA ${i}</h4><img src="${qrSrc}"><br><small style="color:black;">Scan Meja</small></div>`;
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

window.triggerUpload = function() { document.getElementById('file-input').click(); }
window.previewImage = function(input) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('header-profile-img').src = e.target.result;
            document.getElementById('preview-profile-img').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
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

// Start
initDatabase();
