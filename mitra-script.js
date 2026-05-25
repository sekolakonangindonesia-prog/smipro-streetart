/* =========================================
   MITRA SCRIPT - SMIPRO (OPTIMIZED REAL-TIME)
   ========================================= */

import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc, increment, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. INISIALISASI & VARIABEL GLOBAL ---
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

        if (oldName !== currentWarungName) {
            setupBookingListener();
            listenToWebOrders();
        }
    }
});

// --- 3. LISTENER BOOKING (SENSITIF REAL-TIME) ---
function setupBookingListener() {
    if (unsubscribeBooking) unsubscribeBooking();
    const q = query(collection(db, "bookings"), where("warungId", "==", WARUNG_ID));

    unsubscribeBooking = onSnapshot(q, (snapshot) => {
        const bookingsData = [];
        let countActive = 0; 
        let countBooked = 0;

        // A. DETEKSI PERUBAHAN (BUNYI & TOAST)
        snapshot.docChanges().forEach((change) => {
            if (!isInitialLoad) {
                const d = change.doc.data();
                if (change.type === "added" && d.status !== 'finished') {
                    notifSound.play();
                    window.tampilkanPesananBaru('booking', 'Reservasi Baru', `Tamu: ${d.customerName}`, 'home');
                }
                if (change.type === "modified" && d.status === 'active') {
                    notifSound.play();
                    window.tampilkanPesananBaru('booking', 'Tamu Telah Datang', `${d.customerName} sudah di lokasi`, 'home');
                }
            }
        });

        // B. PROSES DATA UNTUK UI
        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.status === 'finished') return; // Abaikan yang sudah selesai

            bookingsData.push({ id: docSnap.id, ...d });
            const qty = parseInt(d.tablesNeeded) || 1;
            if(d.status === 'active') countActive += qty;
            else if (d.status === 'booked') countBooked += qty;
        });

        // C. UPDATE STATE & LONCENG
        window.currentActiveBookings = bookingsData.map(b => ({
            id: b.id, type: 'booking', judul: b.status === 'active' ? 'Tamu Makan' : 'Reservasi Baru',
            detail: `${b.customerName} (${b.tablesNeeded || 1} Meja)`,
            time: b.timestamp ? b.timestamp.toMillis() : Date.now(), target: 'home'
        }));
        
        window.refreshNotifBell();

        // D. GAMBAR KE LAYAR
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
        isInitialLoad = false; // Pastikan initial load selesai
    });
}

// --- 4. LISTENER PESANAN MAKANAN ---
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
            container.innerHTML += `<div class="order-card-web">
                <b>Meja: ${order.tableNum || 'T.Away'}</b><br>
                ${order.items.map(i => i.name).join(', ')}<br>
                <button onclick="handleOrderAction('${docSnap.id}', 'diproses')" style="background:#00ff00; border:none; padding:5px; margin-top:10px; cursor:pointer; width:100%; border-radius:5px; font-weight:bold;">TERIMA</button>
            </div>`;
        });
    });
}

// --- 5. FUNGSI LOGIKA NOTIFIKASI & TAB ---
window.tampilkanPesananBaru = function(tipe, judul, pesan, tabTujuan) {
    const container = document.getElementById('notif-toast-container');
    if(!container) return;
    const warnaSide = tipe === 'booking' ? '#E50914' : '#FFD700';

    const toast = document.createElement('div');
    toast.className = 'toast-notif';
    toast.style.borderLeft = `5px solid ${warnaSide}`;
    toast.onclick = () => { window.switchTab(tabTujuan); toast.remove(); };
    toast.innerHTML = `<img src="${LOGO_STREETART}" style="width:35px; border-radius:50%;">
                       <div style="flex:1; text-align:left;"><b>${judul}</b><small style="display:block; color:#aaa;">${pesan}</small></div>`;

    container.appendChild(toast);
    setTimeout(() => { if(toast) toast.remove(); }, 8000);

    if (Notification.permission === "granted") {
        new Notification("STREETART", { body: pesan, icon: LOGO_STREETART });
    }
};

window.refreshNotifBell = function() {
    const listContainer = document.getElementById('notif-list-history');
    const badge = document.getElementById('web-notif-count');
    if(!listContainer) return;

    const lastReadTime = parseInt(localStorage.getItem('lastReadNotifTime')) || 0;
    const allNotifs = [...window.currentActiveBookings, ...window.currentActiveOrders];
    allNotifs.sort((a, b) => b.time - a.time);

    const unreadCount = allNotifs.filter(n => n.time > lastReadTime).length;
    if(badge) {
        badge.innerText = unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }

    if(allNotifs.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding:15px; color:#555;">Tidak ada notif.</p>';
        return;
    }

    listContainer.innerHTML = '';
    allNotifs.forEach(n => {
        const color = n.type === 'booking' ? '#E50914' : '#FFD700';
        listContainer.innerHTML += `
            <div class="notif-item" onclick="window.switchTab('${n.target}')">
                <div style="width:30px; height:30px; border-radius:50%; background:${color}; flex-shrink:0;"></div>
                <div style="flex:1;"><b>${n.judul}</b><br><small>${n.detail}</small></div>
            </div>`;
    });
};

window.toggleNotifPanel = function(e) {
    if(e) e.stopPropagation();
    const panel = document.getElementById('notif-panel');
    if(!panel) return;
    const isVisible = panel.style.display === 'flex';
    panel.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
        localStorage.setItem('lastReadNotifTime', Date.now()); 
        window.refreshNotifBell();
    }
};

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    const target = document.getElementById('tab-' + tabId);
    if(target) target.classList.add('active');
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => { if(btn.getAttribute('onclick').includes(`'${tabId}'`)) btn.classList.add('active'); });
};

// --- 6. SISANYA LOGIKA FUNGSI TOMBOL (TETAP SAMA) ---
window.toggleStoreStatus = async function() {
    const btn = document.getElementById('store-status-btn');
    const newStatus = btn && btn.classList.contains('open') ? 'closed' : 'open';
    await updateDoc(doc(db, "warungs", WARUNG_ID), { status: newStatus });
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

function renderBookings(data) {
    const container = document.getElementById('booking-container');
    if(!container) return;
    container.innerHTML = data.empty ? '<p>Kosong</p>' : '';
    data.forEach(b => {
        const statusClass = b.status === 'active' ? 'active' : 'waiting';
        container.innerHTML += `<div class="card-booking ${statusClass}">
            <b>MEJA ${Array.isArray(b.tableNum) ? b.tableNum.join(',') : b.tableNum}</b><br>
            ${b.customerName}<br>
            ${b.status === 'active' ? `<button onclick="finishBooking('${b.id}', ${b.tablesNeeded})">Selesai</button>` : `<button onclick="cancelBooking('${b.id}', ${b.tablesNeeded})">Batal</button>`}
        </div>`;
    });
}
window.goHome = () => window.location.href = 'index.html';
window.prosesLogout = () => { localStorage.clear(); window.location.href = 'index.html'; };
