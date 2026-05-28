import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc, increment, orderBy, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let WARUNG_ID = localStorage.getItem('mitraId');
if (!WARUNG_ID) { window.location.href = 'login.html'; } 

window.currentActiveBookings = [];
window.currentActiveOrders =[];
let currentMenuImageBase64 = null; 
let warungTotalCapacity = 15; 
let currentWarungName = ""; 
let unsubscribeBooking = null; 
let isInitialLoad = true;

const notifSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
const LOGO_STREETART = "https://raw.githubusercontent.com/sekolakonangindonesia-prog/smipro-streetart/main/Logo_Stretart.png";

/* =========================================
   1. LISTENER DATA WARUNG (UTAMA)
   ========================================= */
onSnapshot(doc(db, "warungs", WARUNG_ID), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.bannerImg) {
            const banner = document.getElementById('banner-bg');
            if(banner) banner.style.backgroundImage = `url('${data.bannerImg}')`;
        }
        warungTotalCapacity = data.totalTables || 15; 
        const oldName = currentWarungName;
        currentWarungName = data.name; 

        if(document.getElementById('shop-name-display')) document.getElementById('shop-name-display').innerText = data.name;
        if(data.img) {
            if(document.getElementById('header-profile-img')) document.getElementById('header-profile-img').src = data.img;
            if(document.getElementById('preview-profile-img')) document.getElementById('preview-profile-img').src = data.img;
        }

        const toggle = document.getElementById('toggle-order-web');
        const desc = document.getElementById('order-status-desc');
        if(toggle) {
            toggle.checked = data.enableOrder || false; 
            if(desc) {
                desc.innerText = data.enableOrder ? 'Fitur sedang Aktif' : 'Fitur sedang Mati';
                desc.style.color = data.enableOrder ? '#00ff00' : '#888';
            }
        }

        const btnStatus = document.getElementById('store-status-btn');
        const txtStatus = document.getElementById('store-status-text');
        if (btnStatus && txtStatus) {
            if (data.status === 'open') {
                btnStatus.className = 'status-badge-inline open'; txtStatus.innerText = "BUKA";
            } else {
                btnStatus.className = 'status-badge-inline closed'; txtStatus.innerText = "TUTUP";
            }
        }

        if(document.getElementById('edit-name')) document.getElementById('edit-name').value = data.name || '';
        if(document.getElementById('edit-owner')) document.getElementById('edit-owner').value = data.owner || '';
        if(document.getElementById('edit-phone')) document.getElementById('edit-phone').value = data.phone || '';
        if(document.getElementById('edit-email')) document.getElementById('edit-email').value = data.email || '';
        if(document.getElementById('edit-pass')) document.getElementById('edit-pass').value = data.password || '';

        if (oldName !== currentWarungName) {
            setupBookingListener();
            listenToWebOrders();
        }
    }
});

/* =========================================
   2. LISTENER BOOKING & MENU
   ========================================= */
function setupBookingListener() {
    if (unsubscribeBooking) unsubscribeBooking();
    const qBooking = query(collection(db, "bookings"), where("warungId", "==", WARUNG_ID));
    unsubscribeBooking = onSnapshot(qBooking, (snapshot) => {
        const bookingsData =[];
        let countActive = 0, countBooked = 0;
        snapshot.docChanges().forEach((change) => {
            if (!isInitialLoad) {
                const d = change.doc.data();
                if (change.type === "added") {
                    notifSound.play();
                    window.tampilkanPesananBaru(d.status === 'booked' ? 'booking' : 'walkin', 'Pesanan Baru', `Tamu: ${d.customerName}`, 'home');
                }
            }
        });
        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.status === 'finished') return; 
            bookingsData.push({ id: docSnap.id, ...d });
            const qty = parseInt(d.tablesNeeded) || 1;
            if(d.status === 'active') countActive += qty;
            else if (d.status === 'booked') countBooked += qty;
        });
        window.currentActiveBookings = bookingsData.map(b => ({
            id: b.id, type: 'booking', judul: b.status === 'active' ? 'Tamu Makan' : 'Reservasi Baru',
            detail: `${b.customerName} (${b.tablesNeeded || 1} Meja)`,
            time: b.timestamp ? b.timestamp.toMillis() : Date.now(), target: 'home'
        }));
        window.refreshNotifBell();
        if(document.getElementById('occupied-count')) document.getElementById('occupied-count').innerText = countActive;
        if(document.getElementById('booked-count')) document.getElementById('booked-count').innerText = countBooked;
        const totalEl = document.getElementById('total-table-count');
        if(totalEl) {
            const sisa = warungTotalCapacity - (countActive + countBooked);
            totalEl.innerText = sisa < 0 ? 0 : sisa;
            totalEl.style.color = sisa <= 0 ? 'red' : '#00ff00';
        }
        renderBookings(bookingsData);
        isInitialLoad = false;
    });
}

function renderBookings(bookings) {
    const container = document.getElementById('booking-container');
    if(!container) return;
    container.innerHTML = bookings.length === 0 ? '<p style="text-align:center; color:#555;">Belum ada pesanan.</p>' : '';
    bookings.sort((a,b) => (a.status === 'active' ? -1 : 1));
    bookings.forEach((b) => {
        const qty = b.tablesNeeded || 1;
        const nomorMeja = b.tableNum ? (Array.isArray(b.tableNum) ? b.tableNum.join(", ") : b.tableNum) : "Pending";
        const statusClass = b.status === 'active' ? 'active' : 'waiting';
        container.innerHTML += `
            <div class="card-booking ${statusClass}">
                <span class="table-badge">MEJA ${nomorMeja}</span>
                <b>${b.customerName}</b>
                <button class="btn-primary" onclick="window.finishBooking('${b.id}', ${qty})">Selesai</button>
            </div>`;
    });
}

const qMenu = query(collection(db, "menus"), where("warungId", "==", WARUNG_ID));
onSnapshot(qMenu, (snap) => {
    const container = document.getElementById('menu-list-container');
    if(!container) return;
    container.innerHTML = '';
    snap.forEach(d => {
        const m = d.data();
        container.innerHTML += `<div class="menu-card"><img src="${m.img || 'https://via.placeholder.com/150'}"><div class="menu-details"><b>${m.name}</b><br><span>Rp ${parseInt(m.price).toLocaleString()}</span><br><button onclick="window.deleteMenu('${d.id}')">Hapus</button></div></div>`;
    });
});

/* =========================================
   3. FUNGSI LOGIKA (GLOBAL)
   ========================================= */
function compressImage(file, maxWidth, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const factor = maxWidth / img.width;
            canvas.width = maxWidth; canvas.height = img.height * factor;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
    };
}

window.previewImage = (input) => {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], 300, async (base64) => {
            await updateDoc(doc(db, "warungs", WARUNG_ID), { img: base64 });
            alert("Foto Profil Diperbarui!");
        });
    }
}

window.previewCoverImage = (input) => {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], 800, async (base64) => {
            await updateDoc(doc(db, "warungs", WARUNG_ID), { bannerImg: base64 });
            alert("Foto Sampul Diperbarui!");
        });
    }
}

window.previewMenuImage = (input) => {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], 400, (base64) => {
            currentMenuImageBase64 = base64;
            const preview = document.getElementById('preview-menu-img');
            if(preview) preview.src = base64;
        });
    }
}

window.triggerUpload = () => document.getElementById('file-input').click();
window.triggerCoverUpload = () => document.getElementById('cover-file-input').click();
window.triggerMenuUpload = () => document.getElementById('menu-file-input').click();
window.goHome = () => window.location.href = 'index.html';
window.prosesLogout = () => { if(confirm("Keluar?")) { localStorage.clear(); window.location.href = 'index.html'; } };
window.addMenu = async function() {
    const name = document.getElementById('new-menu-name').value;
    const price = document.getElementById('new-menu-price').value;
    if(!name || !price) return alert("Isi Nama & Harga!");
    await addDoc(collection(db, "menus"), { warungId: WARUNG_ID, name, price, img: currentMenuImageBase64 || "" });
    document.getElementById('modal-menu').style.display = 'none';
    alert("Menu Ditambah!");
}
window.deleteMenu = async function(id) { if(confirm("Hapus menu?")) await deleteDoc(doc(db, "menus", id)); }
window.renderQRCodes = function() {
    const container = document.getElementById('qr-container');
    if(!container) return;
    container.innerHTML = '';
    const baseUrl = window.location.origin;
    for (let i = 1; i <= warungTotalCapacity; i++) {
        const qrData = `${baseUrl}/checkin.html?w=${WARUNG_ID}&t=${i}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
        container.innerHTML += `<div class="qr-card"><h4>MEJA ${i}</h4><img src="${qrSrc}"><br><button onclick="window.location.href='${qrSrc}'">Unduh</button></div>`;
    }
}
window.tampilkanPesananBaru = function(tipe, judul, pesan, tab) { /* ... isi fungsi notifikasi Anda ... */ };
window.refreshNotifBell = function() { /* ... isi fungsi notifikasi Anda ... */ };
window.toggleNotifPanel = function(e) { /* ... isi fungsi notifikasi Anda ... */ };
window.finishBooking = function(id, qty) { /* ... isi fungsi transaksi ... */ };
window.submitTransaction = async function() { /* ... isi fungsi transaksi ... */ };
window.cancelBooking = async function(id, qty) { /* ... isi fungsi batal ... */ };
window.toggleStoreStatus = async function() { /* ... isi fungsi status ... */ };
window.updateOrderSystemStatus = async function(isActive) { /* ... isi fungsi status ... */ };
window.saveProfile = async function() { /* ... isi fungsi profil ... */ };
window.switchTab = function(tabId) { /* ... fungsi tab ... */ };
function listenToWebOrders() { /* ... fungsi order ... */ }
