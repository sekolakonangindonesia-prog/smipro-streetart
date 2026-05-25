/* =========================================
   MITRA SCRIPT - SMIPRO (FIXED VERSION)
   ========================================= */

// 1. IMPORT FIREBASE
import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc, increment, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. AMBIL ID DARI LOCALSTORAGE
let WARUNG_ID = localStorage.getItem('mitraId');

if (!WARUNG_ID) {
    alert("Sesi habis atau Anda belum login. Silakan login kembali.");
    window.location.href = 'login.html';
} 

// Variable Global
let currentMenuImageBase64 = null; 
let warungTotalCapacity = 15; 
let currentWarungName = ""; 
let unsubscribeBooking = null; 
let isInitialLoad = true;

const notifSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
const LOGO_STREETART = "https://raw.githubusercontent.com/sekolakonangindonesia-prog/smipro-streetart/main/Logo_Stretart.png";

// --- 3. LISTENER DATA WARUNG (UTAMA) ---
onSnapshot(doc(db, "warungs", WARUNG_ID), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        
        warungTotalCapacity = data.totalTables || 15; 
        const oldName = currentWarungName;
        currentWarungName = data.name; 

        // Update UI Header
        const nameDisplay = document.getElementById('shop-name-display');
        if(nameDisplay) nameDisplay.innerText = data.name;
        
        if(data.img) {
            const hImg = document.getElementById('header-profile-img');
            const pImg = document.getElementById('preview-profile-img');
            if(hImg) hImg.src = data.img;
            if(pImg) pImg.src = data.img;
        }

        // Sinkronisasi Input Profile
        if(document.getElementById('edit-name')) document.getElementById('edit-name').value = data.name || '';
        if(document.getElementById('edit-owner')) document.getElementById('edit-owner').value = data.owner || '';
        if(document.getElementById('edit-phone')) document.getElementById('edit-phone').value = data.phone || '';
        if(document.getElementById('edit-email')) document.getElementById('edit-email').value = data.email || '';
        if(document.getElementById('edit-pass')) document.getElementById('edit-pass').value = data.password || '';

        // SINKRONISASI TOMBOL ORDER ONLINE (TOGGLE)
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
        if (btn && txt) {
            if (data.status === 'open') {
                btn.className = 'shop-switch open'; txt.innerText = "BUKA";
            } else {
                btn.className = 'shop-switch closed'; txt.innerText = "TUTUP";
            }
        }

        if (oldName !== currentWarungName) {
            setupBookingListener();
            listenToWebOrders();
        }
    }
});

// --- 4. LISTENER BOOKING MEJA (BUNYI & NOTIF) ---
function setupBookingListener() {
    if (unsubscribeBooking) { unsubscribeBooking(); }
    const qBooking = query(collection(db, "bookings"), where("warungId", "==", WARUNG_ID));

    unsubscribeBooking = onSnapshot(qBooking, (snapshot) => {
        const bookings = [];
        let countActiveTables = 0; 
        let countBookedTables = 0; 
        const now = new Date();

        snapshot.docChanges().forEach((change) => {
            const d = change.doc.data();
            
            // 1. Jika ada Reservasi Baru (Warna Kuning)
            if (change.type === "added" && !isInitialLoad) {
                notifSound.play();
                window.tampilkanPesananBaru('booking', 'Reservasi Meja Baru', `Tamu: ${d.customerName}`, 'home');
            }

            // 2. Jika Status Berubah (Check-In / Tamu Datang)
            if (change.type === "modified" && d.status === 'active') {
                notifSound.play();
                window.tampilkanPesananBaru('booking', 'Tamu Telah Datang', `Tamu ${d.customerName} berhasil Check-In`, 'home');
            }
        });
        isInitialLoad = false;
// ---------------------------------

        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.status === 'finished') return;
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

        // UPDATE RIWAYAT BOOKING (HANYA SATU KALI)
        window.currentActiveBookings = bookings.map(b => ({
            id: b.id, 
            type: 'booking', 
            judul: 'Reservasi Baru', 
            detail: `Tamu: ${b.customerName} (${b.tablesNeeded || 1} Meja)`,
            time: b.timestamp ? b.timestamp.toMillis() : Date.now(), 
            target: 'home'
        }));
        window.refreshNotifBell();

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

// --- 5. FUNGSI RENDER CARDS ---
function renderBookings(bookings) {
    const container = document.getElementById('booking-container');
    if(!container) return;
    container.innerHTML = '';
    
    if (bookings.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#555; grid-column:1/-1;">Belum ada pesanan.</p>';
        return;
    }
    
    bookings.sort((a, b) => (a.status === 'active' ? -1 : 1));

    bookings.forEach((b) => {
        if (b.status === 'finished') return;
        const qty = b.tablesNeeded || 1;
        let nomorMejaTeks = b.tableNum ? (Array.isArray(b.tableNum) ? "MEJA " + b.tableNum.join(", ") : "MEJA " + b.tableNum) : `${qty} MEJA (Pending)`;
        const statusClass = b.status === 'active' ? 'active' : 'waiting';

        container.innerHTML += `
            <div class="card-booking ${statusClass}">
                <span class="table-badge">${nomorMejaTeks}</span>
                <b style="font-size:1.1rem; display:block;">${b.customerName}</b>
                <small>${b.bookingCode} | ${qty} Meja</small>
                <div style="display:flex; gap:5px; margin-top:10px;">
                    ${b.status === 'active' ? 
                        `<button class="btn-primary" style="background:white; color:black; width:100%;" onclick="finishBooking('${b.id}', ${qty})">Selesai/Bayar</button>` : 
                        `<button class="btn-delete" style="width:100%;" onclick="cancelBooking('${b.id}', ${qty})">Batalkan</button>`
                    }
                </div>
            </div>`;
    });
}

// --- 6. LOGIKA PESANAN MAKANAN (WEB ORDERS) ---
function listenToWebOrders() {
    const warungId = localStorage.getItem('mitraId');
    const q = query(collection(db, "warung_orders"), where("warungId", "==", warungId), where("status", "==", "pending"));

    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('web-orders-container');
        if(!container) return;

        // UPDATE RIWAYAT MAKANAN (HANYA SATU KALI)
        window.currentActiveOrders = snapshot.docs.map(doc => {
            const o = doc.data(); 
            return { 
                id: doc.id, 
                type: 'order', 
                judul: 'Pesanan Makanan', 
                detail: `Meja: ${o.tableNum || 'T.Away'}`,
                time: o.timestamp ? o.timestamp.toMillis() : Date.now(), 
                target: 'web-orders' 
            };
        });
        window.refreshNotifBell();
       
        if (snapshot.empty) {
            container.innerHTML = `<div style="text-align:center; padding:50px 20px; color:#555;"><i class="fa-solid fa-utensils" style="font-size:3rem; margin-bottom:15px; opacity:0.2;"></i><p>Tidak ada pesanan.</p></div>`;
            return;
        }

        container.innerHTML = '<h3 style="margin-top:0; color:white; padding:0 10px;">Daftar Pesanan Baru</h3>';
        snapshot.forEach(docSnap => {
            const order = docSnap.data();
            container.innerHTML += `
                <div class="order-card-web" style="background:#1a1a1a; border-left:4px solid gold; padding:15px; border-radius:8px; margin-bottom:10px;">
                    <b>Meja: ${order.tableNum || 'T.Away'}</b><br>
                    ${order.items.map(i => `• ${i.name} (x${i.qty})`).join('<br>')}
                    <button onclick="handleOrderAction('${docSnap.id}', 'diproses')" style="background:#00ff00; border:none; padding:8px 15px; border-radius:5px; font-weight:bold; cursor:pointer; width:100%; margin-top:10px;">TERIMA</button>
                </div>`;
        });
    });
}

/* =========================================
   7. FUNGSI-FUNGSI GLOBAL (LOGIKA LONCENG FB)
   ========================================= */

window.currentActiveBookings = [];
window.currentActiveOrders = [];

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    const targetTab = document.getElementById('tab-' + tabId);
    if(targetTab) targetTab.classList.add('active');
   
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => {
        if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${tabId}'`)) {
            btn.classList.add('active');
        }
    });
    if(tabId === 'qr') renderQRCodes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

document.onclick = function() {
    const panel = document.getElementById('notif-panel');
    if(panel) panel.style.display = 'none';
};

window.refreshNotifBell = function() {
    const listContainer = document.getElementById('notif-list-history');
    const badge = document.getElementById('web-notif-count');
    if(!listContainer) return;

    const lastReadTime = parseInt(localStorage.getItem('lastReadNotifTime')) || 0;
    const allNotifs = [...(window.currentActiveBookings || []), ...(window.currentActiveOrders || [])];
    allNotifs.sort((a, b) => b.time - a.time);

    const unreadCount = allNotifs.filter(n => n.time > lastReadTime).length;
    if(badge) {
        badge.innerText = unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }

    if(allNotifs.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#555; font-size:0.8rem;">Tidak ada pemberitahuan.</p>';
        return;
    }

    listContainer.innerHTML = '';
    allNotifs.forEach(n => {
        const color = n.type === 'booking' ? '#E50914' : '#FFD700';
        const icon = n.type === 'booking' ? 'fa-calendar-check' : 'fa-utensils';
        const isNew = n.time > lastReadTime ? 'border-right: 3px solid #00d2ff;' : '';
        listContainer.innerHTML += `
            <div class="notif-item" style="display:flex; gap:12px; padding:12px; border-bottom:1px solid #222; cursor:pointer; ${isNew}" onclick="window.switchTab('${n.target}')">
                <div style="width:35px; height:35px; border-radius:50%; background:${color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <i class="fa-solid ${icon}" style="color:black; font-size:0.8rem;"></i>
                </div>
                <div style="flex:1; text-align:left;">
                    <b style="display:block; font-size:0.85rem; color:white;">${n.judul}</b>
                    <small style="color:#aaa; font-size:0.75rem;">${n.detail}</small>
                </div>
            </div>`;
    });
}

// 2. Fungsi Kembali ke Home (FIXED Karakter)
window.goHome = function() {
    window.location.href = 'index.html';
};

// 3. Fungsi Logout
window.prosesLogout = function() {
    if(confirm("Logout?")) { localStorage.clear(); window.location.href = 'index.html'; }
};

window.updateOrderSystemStatus = async function(isActive) {
    try {
        await updateDoc(doc(db, "warungs", WARUNG_ID), { enableOrder: isActive });
    } catch (e) { alert("Gagal update status"); }
};

window.handleOrderAction = async function(id, status) {
    await updateDoc(doc(db, "warung_orders", id), { status: status });
};

window.toggleStoreStatus = async function() {
    const btn = document.getElementById('store-status-btn');
    const newStatus = btn && btn.classList.contains('open') ? 'closed' : 'open';
    await updateDoc(doc(db, "warungs", WARUNG_ID), { status: newStatus });
};

window.editTableCount = async function() {
    let count = prompt("Total Meja Baru:", warungTotalCapacity);
    if(count) await updateDoc(doc(db, "warungs", WARUNG_ID), { totalTables: parseInt(count) });
};

window.saveProfile = async function() {
    try {
        await updateDoc(doc(db, "warungs", WARUNG_ID), {
            name: document.getElementById('edit-name').value,
            owner: document.getElementById('edit-owner').value,
            phone: document.getElementById('edit-phone').value,
            email: document.getElementById('edit-email').value,
            password: document.getElementById('edit-pass').value
        });
        alert("Profil Tersimpan!");
    } catch (e) { alert(e.message); }
};

// FINISH BOOKING LOGIC
window.selectedBookingId = null;
window.selectedTableCount = 0;
window.finishBooking = function(docId, tableQty) {
    window.selectedBookingId = docId;
    window.selectedTableCount = parseInt(tableQty) || 1;
    document.getElementById('trx-amount').value = ''; 
    document.getElementById('modal-finish-transaction').style.display = 'flex';
};

window.closeFinishModal = function() { 
    document.getElementById('modal-finish-transaction').style.display = 'none'; 
};

window.submitTransaction = async function() {
    const amount = document.getElementById('trx-amount').value;
    if(!amount || amount <= 0) return alert("Nominal tidak valid!");
    try {
        await updateDoc(doc(db, "bookings", window.selectedBookingId), { status: 'finished', revenue: parseInt(amount), finishedAt: new Date() });
        await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: increment(-window.selectedTableCount) });
        alert("Berhasil!"); window.closeFinishModal();
    } catch (e) { alert(e.message); }
};

window.cancelBooking = async function(id, qty) {
    if(confirm("Batalkan?")) {
        await deleteDoc(doc(db, "bookings", id));
        await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: increment(-parseInt(qty)) });
    }
};

// IMAGE & QR HELPERS
window.triggerUpload = () => document.getElementById('file-input').click();
window.previewImage = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            await updateDoc(doc(db, "warungs", WARUNG_ID), { img: e.target.result });
            alert("Foto Update!");
        };
        reader.readAsDataURL(input.files[0]);
    }
};

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

function kirimNotifKeHP(pesan) {
    if (Notification.permission === "granted") {
        new Notification("STREETART", { body: pesan, icon: LOGO_STREETART });
    }
}

async function updateWarungTableCount(totalUsed) {
    try { await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: totalUsed }); } catch (e) {}
}
