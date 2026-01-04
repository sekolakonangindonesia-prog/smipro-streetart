// --- IMPORT FIREBASE (Pastikan firebase-config.js sudah ada) ---
import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const WARUNG_ID = "warung_bu_sri";

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
        await setDoc(docRef, { name: "Warung Bu Sri", status: "open", totalTables: 15, bookedCount: 0 });
    }
}

onSnapshot(doc(db, "warungs", WARUNG_ID), (doc) => {
    if (doc.exists()) {
        const data = doc.data();
        document.getElementById('shop-name-display').innerText = data.name;
        document.getElementById('total-table-count').innerText = data.totalTables;
        
        // Update di Tab Profil juga
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

const qBooking = query(collection(db, "bookings"), where("warungId", "==", WARUNG_ID));
onSnapshot(qBooking, (snapshot) => {
    storeData.bookings = [];
    let count = 0;
    snapshot.forEach((doc) => {
        storeData.bookings.push({ id: doc.id, ...doc.data() });
        count++;
    });
    document.getElementById('occupied-count').innerText = count;
    renderBookings();
});

const qMenu = query(collection(db, "menus"), where("warungId", "==", WARUNG_ID));
onSnapshot(qMenu, (snapshot) => {
    storeData.menus = [];
    snapshot.forEach((doc) => { storeData.menus.push({ id: doc.id, ...doc.data() }); });
    renderMenus();
});

/* ========================
   2. LOGIKA UTAMA (GANTI FOTO, LOGOUT, DLL)
   ======================== */

// FUNGSI GANTI FOTO PROFIL (MEMBUKA FOLDER)
window.triggerUpload = function() {
    document.getElementById('file-input').click();
}

// PREVIEW FOTO (Di Browser saja, belum upload ke storage)
window.previewImage = function(input) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function (e) {
            // Ubah foto di header
            document.getElementById('header-profile-img').src = e.target.result;
            // Ubah foto di tab profil
            document.getElementById('preview-profile-img').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// FUNGSI LOGOUT (HAPUS SESI)
window.prosesLogout = function() {
    if(confirm("Yakin ingin keluar dari Dashboard Warung?")) {
        localStorage.removeItem('userLoggedIn');
        localStorage.removeItem('userName');
        localStorage.removeItem('userLink');
        window.location.href = 'index.html';
    }
}

// TOGGLE BUKA TUTUP
window.toggleStoreStatus = async function() {
    const btn = document.getElementById('store-status-btn');
    const newStatus = btn.classList.contains('open') ? 'closed' : 'open';
    await updateDoc(doc(db, "warungs", WARUNG_ID), { status: newStatus });
}

// EDIT MEJA
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

// RENDER BOOKING
function renderBookings() {
    const container = document.getElementById('booking-container');
    container.innerHTML = '';
    if (storeData.bookings.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#555; grid-column:1/-1;">Belum ada pesanan.</p>';
        return;
    }
    storeData.bookings.forEach((b) => {
        let cardHtml = b.status === 'waiting' ? 
            `<div class="card-booking waiting"><span class="table-badge">MEJA ${b.tableNum}</span><b>${b.customerName}</b><br><small>${b.time}</small><div class="waiting-text">Menunggu Scan...</div></div>` :
            `<div class="card-booking active"><span class="table-badge">MEJA ${b.tableNum}</span><b>${b.customerName}</b><br><small>${b.time}</small><div class="active-text">Sedang Makan</div><button class="btn-primary" style="margin-top:10px; background:white; color:red;" onclick="finishBooking('${b.id}')">Selesai</button></div>`;
        container.innerHTML += cardHtml;
    });
}

window.finishBooking = async function(docId) {
    if (confirm("Kosongkan meja?")) await deleteDoc(doc(db, "bookings", docId));
}

// MENU
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
        const qrData = `https://smipro-app.web.app/checkin.html?w=${WARUNG_ID}&t=${i}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;
        container.innerHTML += `<div class="qr-card"><h4>MEJA ${i}</h4><img src="${qrSrc}"><br><small style="color:black;">Scan Meja</small></div>`;
    }
}

// Start
initDatabase();
