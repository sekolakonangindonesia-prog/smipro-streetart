/* =========================================
   MITRA SCRIPT - SMIPRO (RESTORASI TOTAL)
   ========================================= */

import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc, increment, orderBy, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. INISIALISASI ---
let WARUNG_ID = localStorage.getItem('mitraId');
if (!WARUNG_ID) { window.location.href = 'login.html'; } 

window.currentActiveBookings = [];
window.currentActiveOrders = [];
let warungTotalCapacity = 15; 
let currentWarungName = ""; 
let unsubscribeBooking = null; 
let isInitialLoad = true;

const notifSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
const LOGO_STREETART = "https://raw.githubusercontent.com/sekolakonangindonesia-prog/smipro-streetart/main/Logo_Stretart.png";

// --- 2. LISTENER DATA WARUNG (UTAMA) ---
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
        if(toggle) toggle.checked = data.enableOrder || false;

        // Status Buka/Tutup
        const btnStatus = document.getElementById('store-status-btn');
        const txtStatus = document.getElementById('store-status-text');
        if (btnStatus && txtStatus) {
            if (data.status === 'open') {
                btnStatus.className = 'status-badge-inline open'; txtStatus.innerText = "BUKA";
            } else {
                btnStatus.className = 'status-badge-inline closed'; txtStatus.innerText = "TUTUP";
            }
        }

        // Sinkronisasi Form Profil
        if(document.getElementById('edit-name')) document.getElementById('edit-name').value = data.name || '';
        if(document.getElementById('edit-owner')) document.getElementById('edit-owner').value = data.owner || '';
        if(document.getElementById('edit-phone')) document.getElementById('edit-phone').value = data.phone || '';
        if(document.getElementById('edit-email')) document.getElementById('edit-email').value = data.email || '';

        if (oldName !== currentWarungName) {
            setupBookingListener();
            listenToWebOrders();
        }
    }
});

// --- 3. LISTENER BOOKING (SENSITIF REAL-TIME) ---
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

        window.currentActiveBookings = bookingsData.map(b => ({
            id: b.id, type: 'booking', judul: b.status === 'active' ? 'Check-In' : 'Reservasi',
            detail: `${b.customerName} (${b.tablesNeeded || 1} Meja)`,
            time: b.timestamp ? b.timestamp.toMillis() : Date.now(), target: 'home'
        }));
        
        window.refreshNotifBell();

        document.getElementById('occupied-count').innerText = countActive;
        document.getElementById('booked-count').innerText = countBooked;
        const totalUsed = countActive + countBooked;
        const sisa = warungTotalCapacity - totalUsed;
        const totalEl = document.getElementById('total-table-count');
        if(totalEl) {
            totalEl.innerText = sisa < 0 ? 0 : sisa;
            totalEl.style.color = sisa <= 0 ? 'red' : '#00ff00';
        }

        renderBookings(bookingsData);
        isInitialLoad = false; 
    });
}

// --- 4. LISTENER PESANAN MENU ---
function listenToWebOrders() {
    const q = query(collection(db, "warung_orders"), where("warungId", "==", WARUNG_ID), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('web-orders-container');
        if(!container) return;

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added" && !isInitialLoad) {
                notifSound.play();
                const d = change.doc.data();
                window.tampilkanPesananBaru('order', 'Pesanan Menu', `Meja: ${d.tableNum}`, 'web-orders');
            }
        });

        window.currentActiveOrders = snapshot.docs.map(doc => {
            const o = doc.data(); 
            return { 
                id: doc.id, type: 'order', judul: 'Pesanan Menu', detail: `Meja: ${o.tableNum || 'T.Away'}`,
                time: o.timestamp ? o.timestamp.toMillis() : Date.now(), target: 'web-orders' 
            };
        });
        window.refreshNotifBell();

        container.innerHTML = snapshot.empty ? '<p style="text-align:center; color:#555; margin-top:50px;">Tidak ada pesanan.</p>' : '';
        snapshot.forEach(docSnap => {
            const order = docSnap.data();
            container.innerHTML += `<div class="order-card-web"><b>Meja: ${order.tableNum}</b><br>${order.items.map(i => i.name).join(', ')}<br><button onclick="window.handleOrderAction('${docSnap.id}', 'diproses')" style="background:#00ff00; border:none; padding:5px; margin-top:10px; cursor:pointer; border-radius:5px;">TERIMA</button></div>`;
        });
    });
}

// --- 5. FUNGSI GLOBAL TOMBOL (WAJIB window. AGAR BISA DIKLIK) ---

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    const target = document.getElementById('tab-' + tabId);
    if(target) target.classList.add('active');
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => { if(btn.getAttribute('onclick').includes(`'${tabId}'`)) btn.classList.add('active'); });
    if(tabId === 'qr') renderQRCodes();
};

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

    list.innerHTML = all.length === 0 ? '<p style="text-align:center; padding:15px; color:#555;">Tidak ada notif.</p>' : '';
    all.forEach(n => {
        const color = n.type === 'booking' ? '#E50914' : '#FFD700';
        list.innerHTML += `<div class="notif-item" onclick="window.switchTab('${n.target}')"><div style="width:30px; height:30px; border-radius:50%; background:${color}; flex-shrink:0;"></div><div style="flex:1; text-align:left;"><b>${n.judul}</b><br><small>${n.detail}</small></div></div>`;
    });
};

window.tampilkanPesananBaru = function(tipe, judul, pesan, tab) {
    const container = document.getElementById('notif-toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-notif';
    toast.style.borderLeft = `5px solid ${tipe === 'booking' ? '#E50914' : '#FFD700'}`;
    toast.onclick = () => { window.switchTab(tab); toast.remove(); };
    toast.innerHTML = `<img src="${LOGO_STREETART}" style="width:35px; border-radius:50%;"><div style="flex:1; text-align:left;"><b>${judul}</b><br><small>${pesan}</small></div>`;
    container.appendChild(toast);
    setTimeout(() => { if(toast) toast.remove(); }, 8000);
};

window.toggleStoreStatus = async function() {
    const btn = document.getElementById('store-status-btn');
    const newStatus = btn.classList.contains('open') ? 'closed' : 'open';
    await updateDoc(doc(db, "warungs", WARUNG_ID), { status: newStatus });
};

window.updateOrderSystemStatus = async function(isActive) {
    try { await updateDoc(doc(db, "warungs", WARUNG_ID), { enableOrder: isActive }); } catch (e) { alert("Gagal!"); }
};

window.handleOrderAction = async function(id, status) {
    await updateDoc(doc(db, "warung_orders", id), { status: status });
};

window.finishBooking = function(id, qty) {
    window.selectedBookingId = id; window.selectedTableCount = qty;
    document.getElementById('trx-amount').value = ''; 
    document.getElementById('modal-finish-transaction').style.display = 'flex';
};

window.submitTransaction = async function() {
    const amt = document.getElementById('trx-amount').value;
    if(!amt || amt <= 0) return alert("Nominal!");
    await updateDoc(doc(db, "bookings", window.selectedBookingId), { status: 'finished', revenue: parseInt(amt), finishedAt: new Date() });
    await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: increment(-window.selectedTableCount) });
    document.getElementById('modal-finish-transaction').style.display = 'none';
};

window.cancelBooking = async function(id, qty) {
    if(confirm("Batal?")) {
        await deleteDoc(doc(db, "bookings", id));
        await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: increment(-parseInt(qty)) });
    }
};

window.saveProfile = async function() {
    await updateDoc(doc(db, "warungs", WARUNG_ID), {
        name: document.getElementById('edit-name').value,
        owner: document.getElementById('edit-owner').value,
        phone: document.getElementById('edit-phone').value,
        email: document.getElementById('edit-email').value
    });
    alert("Profil Disimpan!");
};

window.triggerUpload = () => document.getElementById('file-input').click();
window.goHome = () => window.location.href = 'index.html';
window.prosesLogout = () => { localStorage.clear(); window.location.href = 'index.html'; };

window.renderQRCodes = function() {
    const container = document.getElementById('qr-container');
    if(!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= warungTotalCapacity; i++) {
        const qrData = `${window.location.origin}/checkin.html?w=${WARUNG_ID}&t=${i}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
        container.innerHTML += `<div class="qr-card" style="background:white; padding:10px; border-radius:10px; text-align:center; color:black;"><h4>M${i}</h4><img src="${qrSrc}" style="width:100px;"></div>`;
    }
};

function renderBookings(data) {
    const container = document.getElementById('booking-container');
    if(!container) return;
    container.innerHTML = '';
    data.forEach(b => {
        const statusClass = b.status === 'active' ? 'active' : 'waiting';
        const nomorMeja = Array.isArray(b.tableNum) ? b.tableNum.join(',') : (b.tableNum || 'P');
        container.innerHTML += `<div class="card-booking ${statusClass}">
            <b>MEJA ${nomorMeja}</b><br>${b.customerName}<br>
            ${b.status === 'active' ? `<button class="btn-primary" style="background:white; color:black; width:100%; margin-top:10px;" onclick="finishBooking('${b.id}', ${b.tablesNeeded})">Selesai</button>` : `<button class="btn-delete" style="width:100%; margin-top:10px;" onclick="cancelBooking('${b.id}', ${b.tablesNeeded})">Batal</button>`}
        </div>`;
    });
}

document.onclick = function() {
    const panel = document.getElementById('notif-panel');
    if(panel) panel.style.display = 'none';
};
