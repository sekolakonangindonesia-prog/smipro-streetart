// --- 1. IMPORT FIREBASE ---
import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc, increment, orderBy, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 2. AMBIL ID DARI LOCALSTORAGE ---
let WARUNG_ID = localStorage.getItem('mitraId');
if (!WARUNG_ID) { window.location.href = 'login.html'; } 

// Variable Global
window.currentActiveBookings = [];
window.currentActiveOrders = [];
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
        warungTotalCapacity = data.totalTables || 15; 
        const oldName = currentWarungName;
        currentWarungName = data.name; 

        document.getElementById('shop-name-display').innerText = data.name;
        if(data.img) {
            document.getElementById('header-profile-img').src = data.img;
            document.getElementById('preview-profile-img').src = data.img;
        }

        // Sinkronisasi Toggle Order Web
        const toggle = document.getElementById('toggle-order-web');
        const desc = document.getElementById('order-status-desc');
        if(toggle) {
            toggle.checked = data.enableOrder || false; 
            if(desc) {
                desc.innerText = data.enableOrder ? 'Fitur sedang Aktif' : 'Fitur sedang Mati';
                desc.style.color = data.enableOrder ? '#00ff00' : '#888';
            }
        }

        // Sinkronisasi Status Buka/Tutup
        const btnStatus = document.getElementById('store-status-btn');
        const txtStatus = document.getElementById('store-status-text');
        if (btnStatus && txtStatus) {
            if (data.status === 'open') {
                btnStatus.className = 'status-badge-inline open'; txtStatus.innerText = "BUKA";
            } else {
                btnStatus.className = 'status-badge-inline closed'; txtStatus.innerText = "TUTUP";
            }
        }

        // Update Fields Profil
        document.getElementById('edit-name').value = data.name || '';
        document.getElementById('edit-owner').value = data.owner || '';
        document.getElementById('edit-phone').value = data.phone || '';
        document.getElementById('edit-email').value = data.email || '';
        document.getElementById('edit-pass').value = data.password || '';

        if (oldName !== currentWarungName) {
            setupBookingListener();
            listenToWebOrders();
        }
    }
});

/* =========================================
   2. LISTENER BOOKING (SENSITIF REAL-TIME)
   ========================================= */
function setupBookingListener() {
    if (unsubscribeBooking) unsubscribeBooking();
    const qBooking = query(collection(db, "bookings"), where("warungId", "==", WARUNG_ID));

    unsubscribeBooking = onSnapshot(qBooking, (snapshot) => {
        const bookingsData = [];
        let countActive = 0, countBooked = 0;
        const now = new Date();

        snapshot.docChanges().forEach((change) => {
            if (!isInitialLoad) {
                const d = change.doc.data();
                if (change.type === "added" && d.status !== 'finished') {
                    notifSound.play();
                    window.tampilkanPesananBaru('booking', 'Reservasi Baru', `Tamu: ${d.customerName}`, 'home');
                }
                if (change.type === "modified" && d.status === 'active') {
                    notifSound.play();
                    window.tampilkanPesananBaru('booking', 'Tamu Datang', `${d.customerName} sudah Check-In`, 'home');
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

        // Simpan untuk Notifikasi Lonceng
        window.currentActiveBookings = bookingsData.map(b => ({
            id: b.id, type: 'booking', judul: b.status === 'active' ? 'Tamu Makan' : 'Reservasi Baru',
            detail: `${b.customerName} (${b.tablesNeeded || 1} Meja)`,
            time: b.timestamp ? b.timestamp.toMillis() : Date.now(), target: 'home'
        }));
        window.refreshNotifBell();

        // Update UI Angka
        document.getElementById('occupied-count').innerText = countActive;
        document.getElementById('booked-count').innerText = countBooked;
        const sisa = warungTotalCapacity - (countActive + countBooked);
        const totalEl = document.getElementById('total-table-count');
        if(totalEl) {
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
    container.innerHTML = bookings.length === 0 ? '<p style="text-align:center; color:#555; grid-column:1/-1;">Belum ada pesanan.</p>' : '';
    
    bookings.sort((a, b) => (a.status === 'active' ? -1 : 1));

    bookings.forEach((b) => {
        const qty = b.tablesNeeded || 1;
        const nomorMeja = b.tableNum ? (Array.isArray(b.tableNum) ? b.tableNum.join(", ") : b.tableNum) : "Pending";
        const jamHangus = b.expiredTime ? b.expiredTime.split('T')[1] : "-";

        if (b.status === 'booked') {
            container.innerHTML += `
            <div class="card-booking waiting">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span class="table-badge" style="color:#FFD700;">MEJA ${nomorMeja}</span>
                    <span style="background:#555; color:white; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${qty} Meja</span>
                </div>
                <b style="font-size:1.2rem; display:block;">${b.customerName}</b>
                <div style="font-size:0.85rem; color:#ccc; margin-top:5px;">
                    Kode: <b style="background:#333; padding:2px 5px;">${b.bookingCode}</b> | Tgl: ${b.bookingDate}<br>
                    <i class="fa-solid fa-hourglass-half"></i> Batas Check-in: <b style="color:red;">${jamHangus}</b>
                </div>
                <button class="btn-delete" style="width:100%; margin-top:10px;" onclick="cancelBooking('${b.id}', ${qty})">Batalkan</button>
            </div>`;
        } else {
            container.innerHTML += `
            <div class="card-booking active">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span class="table-badge">MEJA ${nomorMeja}</span>
                    <span style="background:#b71c1c; color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem;">${qty} Meja</span>
                </div>
                <b style="font-size:1.2rem; display:block;">${b.customerName}</b>
                <small style="color:#ffaaaa;">Sedang Makan</small>
                <button class="btn-primary" style="margin-top:10px; background:white; color:#b71c1c; width:100%; font-weight:bold; height:40px; border-radius:8px; cursor:pointer;" 
                    onclick="finishBooking('${b.id}', ${qty})">Selesai / Bayar</button>
            </div>`;
        }
    });
}

/* =========================================
   3. FUNGSI LOGIKA NOTIFIKASI (FACEBOOK STYLE)
   ========================================= */
window.toggleNotifPanel = function(e) {
    if(e) e.stopPropagation();
    const panel = document.getElementById('notif-panel');
    const badge = document.getElementById('web-notif-count');
    if(!panel) return;
    const isVisible = panel.style.display === 'flex';
    panel.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
        localStorage.setItem('lastReadNotifTime', Date.now()); 
        if(badge) badge.style.display = 'none';
        window.refreshNotifBell();
    }
};

window.refreshNotifBell = function() {
    const list = document.getElementById('notif-list-history');
    const badge = document.getElementById('web-notif-count');
    if(!list) return;

    const lastRead = parseInt(localStorage.getItem('lastReadNotifTime')) || 0;
    const all = [...window.currentActiveBookings, ...window.currentActiveOrders];
    all.sort((a, b) => b.time - a.time);

    const unread = all.filter(n => n.time > lastRead).length;
    if(badge) { badge.innerText = unread; badge.style.display = unread > 0 ? 'block' : 'none'; }

    list.innerHTML = all.length === 0 ? '<p style="text-align:center; padding:20px; color:#555;">Kosong.</p>' : '';
    all.forEach(n => {
        const color = n.type === 'booking' ? '#E50914' : '#FFD700';
        list.innerHTML += `
            <div class="notif-item" onclick="window.switchTab('${n.target}')">
                <div style="width:30px; height:30px; border-radius:50%; background:${color}; flex-shrink:0;"></div>
                <div style="flex:1;"><b>${n.judul}</b><br><small>${n.detail}</small></div>
            </div>`;
    });
};

window.tampilkanPesananBaru = function(tipe, judul, pesan, tab) {
    const container = document.getElementById('notif-toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-notif';
    toast.style.borderLeft = `5px solid ${tipe === 'booking' ? '#E50914' : '#FFD700'}`;
    toast.onclick = () => { window.switchTab(tab); toast.remove(); };
    toast.innerHTML = `<img src="${LOGO_STREETART}" style="width:35px; border-radius:50%;"><div style="flex:1;"><b>${judul}</b><br><small>${pesan}</small></div>`;
    container.appendChild(toast);
    setTimeout(() => { if(toast) toast.remove(); }, 8000);
    if (Notification.permission === "granted") new Notification("STREETART", { body: pesan, icon: LOGO_STREETART });
};

/* =========================================
   4. FUNGSI TAB & QR (DIJAMIN KELUAR)
   ========================================= */
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    const target = document.getElementById('tab-' + tabId);
    if(target) target.classList.add('active');
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => { if(btn.getAttribute('onclick').includes(`'${tabId}'`)) btn.classList.add('active'); });

    if (tabId === 'qr') renderQRCodes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.renderQRCodes = function() {
    const container = document.getElementById('qr-container');
    if(!container) return;
    container.innerHTML = '';
    const baseUrl = window.location.origin;
    for (let i = 1; i <= warungTotalCapacity; i++) {
        const qrData = `${baseUrl}/checkin.html?w=${WARUNG_ID}&t=${i}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
        container.innerHTML += `
            <div class="qr-card">
                <h4>MEJA ${i}</h4>
                <img src="${qrSrc}" style="width:130px;">
                <br>
                <button class="btn-download-qr" onclick="window.open('${qrSrc}', '_blank')">Unduh</button>
            </div>`;
    }
};

/* =========================================
   5. SISANYA LOGIKA TOMBOL (SAMA DENGAN ASLI)
   ========================================= */
window.toggleStoreStatus = async function() {
    const btn = document.getElementById('store-status-btn');
    const newStatus = btn && btn.classList.contains('open') ? 'closed' : 'open';
    await updateDoc(doc(db, "warungs", WARUNG_ID), { status: newStatus });
};

window.updateOrderSystemStatus = async function(isActive) {
    try { await updateDoc(doc(db, "warungs", WARUNG_ID), { enableOrder: isActive }); } catch(e){}
};

window.finishBooking = function(id, qty) {
    window.selectedBookingId = id; window.selectedTableCount = qty;
    document.getElementById('trx-amount').value = ''; 
    document.getElementById('modal-finish-transaction').style.display = 'flex';
};

window.submitTransaction = async function() {
    const amt = document.getElementById('trx-amount').value;
    if(!amt || amt <= 0) return alert("Masukkan Nominal!");
    await updateDoc(doc(db, "bookings", window.selectedBookingId), { status: 'finished', revenue: parseInt(amt), finishedAt: new Date() });
    await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: increment(-window.selectedTableCount) });
    document.getElementById('modal-finish-transaction').style.display = 'none';
};

window.cancelBooking = async function(id, qty) {
    if(confirm("Batalkan?")) {
        await deleteDoc(doc(db, "bookings", id));
        await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: increment(-parseInt(qty)) });
    }
};

window.triggerUpload = () => document.getElementById('file-input').click();
window.triggerMenuUpload = () => document.getElementById('menu-file-input').click();

window.saveProfile = async function() {
    await updateDoc(doc(db, "warungs", WARUNG_ID), {
        name: document.getElementById('edit-name').value,
        owner: document.getElementById('edit-owner').value,
        phone: document.getElementById('edit-phone').value,
        email: document.getElementById('edit-email').value,
        password: document.getElementById('edit-pass').value
    });
    alert("Profil Tersimpan!");
};

window.prosesLogout = () => { if(confirm("Logout?")) { localStorage.clear(); window.location.href = 'index.html'; } };

function listenToWebOrders() {
    const warungId = localStorage.getItem('mitraId');
    const q = query(collection(db, "warung_orders"), where("warungId", "==", warungId), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('web-orders-container');
        if(!container) return;
        window.currentActiveOrders = snapshot.docs.map(doc => {
            const o = doc.data(); 
            return { id: doc.id, type: 'order', judul: 'Pesanan Menu', detail: `Meja: ${o.tableNum || 'T.Away'}`, time: o.timestamp ? o.timestamp.toMillis() : Date.now(), target: 'web-orders' };
        });
        window.refreshNotifBell();
        container.innerHTML = snapshot.empty ? '<p style="text-align:center; color:#555; margin-top:50px;">Tidak ada pesanan.</p>' : '';
        snapshot.forEach(docSnap => {
            const order = docSnap.data();
            container.innerHTML += `<div class="order-card-web"><b>Meja: ${order.tableNum}</b><br>${order.items.map(i => i.name).join(', ')}<br><button onclick="window.handleOrderAction('${docSnap.id}', 'diproses')" style="background:#00ff00; border:none; padding:5px; margin-top:10px; cursor:pointer; border-radius:5px;">TERIMA</button></div>`;
        });
    });
}

window.handleOrderAction = async function(id, status) {
    await updateDoc(doc(db, "warung_orders", id), { status: status });
};

async function updateWarungTableCount(totalUsed) {
    try { await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: totalUsed }); } catch (e) {}
}

const qMenu = query(collection(db, "menus"), where("warungId", "==", WARUNG_ID));
onSnapshot(qMenu, (snap) => {
    const container = document.getElementById('menu-list-container');
    if(!container) return;
    container.innerHTML = '';
    snap.forEach(dSnap => {
        const m = dSnap.data();
        container.innerHTML += `<div class="menu-card" style="background:#222; border-radius:10px; overflow:hidden; border:1px solid #333; text-align:center;"><img src="${m.img || 'https://via.placeholder.com/150'}" style="width:100%; height:120px; object-fit:cover;"><div style="padding:10px;"><b>${m.name}</b><br><span style="color:gold;">Rp ${parseInt(m.price).toLocaleString()}</span><br><button onclick="deleteMenu('${dSnap.id}')" style="background:#333; color:red; border:1px solid #444; width:100%; margin-top:5px; cursor:pointer; height:30px;">Hapus</button></div></div>`;
    });
});

window.deleteMenu = async function(id) { if(confirm("Hapus menu?")) await deleteDoc(doc(db, "menus", id)); };

document.onclick = function() {
    const panel = document.getElementById('notif-panel');
    if(panel) panel.style.display = 'none';
};
