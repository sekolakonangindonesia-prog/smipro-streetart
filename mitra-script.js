/* =========================================
   MITRA SCRIPT - SMIPRO (VERSI REVISI TOTAL)
   ========================================= */

// --- IMPORT FIREBASE ---
import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc, increment, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- AMBIL ID DARI LOCALSTORAGE ---
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

// --- TAMBAHAN UNTUK NOTIFIKASI ---
const notifSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
const LOGO_STREETART = "https://raw.githubusercontent.com/sekolakonangindonesia-prog/smipro-streetart/main/Logo_Stretart.png";
let isInitialLoad = true;

// --- 1. LISTENER DATA WARUNG (UTAMA) ---
onSnapshot(doc(db, "warungs", WARUNG_ID), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        
        warungTotalCapacity = data.totalTables || 15; 
        const oldName = currentWarungName;
        currentWarungName = data.name; 

        // Update UI Nama Warung
        const nameDisplay = document.getElementById('shop-name-display');
        if(nameDisplay) nameDisplay.innerText = data.name;
        
        if(data.img) {
            const hImg = document.getElementById('header-profile-img');
            const pImg = document.getElementById('preview-profile-img');
            if(hImg) hImg.src = data.img;
            if(pImg) pImg.src = data.img;
        }

        // --- SINKRONISASI TOMBOL ORDER ONLINE ---
        const toggle = document.getElementById('toggle-order-web');
        const desc = document.getElementById('order-status-desc');
        if(toggle) {
            toggle.checked = data.enableOrder || false; 
            if(desc) {
                desc.innerText = data.enableOrder ? 'Fitur sedang Aktif' : 'Fitur sedang Mati';
                desc.style.color = data.enableOrder ? '#00ff00' : '#888';
            }
        }

        // Sinkronisasi Input Profile
        const editFields = ['edit-name', 'edit-owner', 'edit-phone', 'edit-email', 'edit-pass'];
        const values = [data.name, data.owner, data.phone, data.email, data.password];
        editFields.forEach((id, i) => {
            const el = document.getElementById(id);
            if(el) el.value = values[i] || '';
        });

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

// --- 2. UPDATE STATUS ORDER ONLINE (GLOBAL) ---
window.updateOrderSystemStatus = async function(isActive) {
    try {
        await updateDoc(doc(db, "warungs", WARUNG_ID), { enableOrder: isActive });
    } catch (e) {
        alert("Gagal update: " + e.message);
        document.getElementById('toggle-order-web').checked = !isActive;
    }
}

// --- 3. LISTENER BOOKING (BUNYI & NOTIF) ---
function setupBookingListener() {
    if (unsubscribeBooking) { unsubscribeBooking(); }
    const qBooking = query(collection(db, "bookings"), where("warungId", "==", WARUNG_ID));

    unsubscribeBooking = onSnapshot(qBooking, (snapshot) => {
        const bookings = [];
        let countActiveTables = 0; 
        let countBookedTables = 0; 
        const now = new Date();

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added" && !isInitialLoad) {
                notifSound.play();
                kirimNotifKeHP(`Booking Baru: ${change.doc.data().customerName}`);
            }
        });
        isInitialLoad = false;

        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
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
        
        // Update Lonceng/Badge
        const badge = document.getElementById('web-notif-count');
        if(badge) {
            badge.innerText = snapshot.size;
            badge.style.display = snapshot.size > 0 ? 'block' : 'none';
        }

        // Update Statistik UI
        const totalUsed = countActiveTables + countBookedTables;
        const sisa = warungTotalCapacity - totalUsed;
        const totalEl = document.getElementById('total-table-count');
        if(totalEl) {
            totalEl.innerText = sisa < 0 ? 0 : sisa; 
            totalEl.style.color = sisa <= 0 ? '#ff4444' : '#00ff00';
        }
        document.getElementById('occupied-count').innerText = countActiveTables;
        document.getElementById('booked-count').innerText = countBookedTables;

        renderBookings(bookings);
        updateWarungTableCount(totalUsed);
    });
}

function renderBookings(bookings) {
    const container = document.getElementById('booking-container');
    if(!container) return;
    container.innerHTML = bookings.length === 0 ? '<p style="text-align:center; color:#555; grid-column:1/-1;">Kosong.</p>' : '';
    
    bookings.sort((a, b) => (a.status === 'active' ? -1 : 1));
    bookings.forEach((b) => {
        const qty = b.tablesNeeded || 1;
        const nomorMeja = Array.isArray(b.tableNum) ? b.tableNum.join(", ") : (b.tableNum || "Pending");
        const statusClass = b.status === 'active' ? 'active' : 'waiting';

        container.innerHTML += `
        <div class="card-booking ${statusClass}">
            <span class="table-badge">MEJA ${nomorMeja}</span>
            <b style="font-size:1.1rem;">${b.customerName}</b><br>
            <small>${b.bookingCode} | ${qty} Meja</small>
            <div style="margin-top:10px;">
                ${b.status === 'active' ? 
                    `<button class="btn-primary" style="background:white; color:black; width:100%; border:none; padding:8px; border-radius:5px; font-weight:bold; cursor:pointer;" onclick="finishBooking('${b.id}', ${qty})">Selesai/Bayar</button>` : 
                    `<button class="btn-delete" style="width:100%;" onclick="cancelBooking('${b.id}', ${qty})">Batalkan</button>`
                }
            </div>
        </div>`;
    });
}

// --- 4. PEMANTAU PESANAN MAKANAN (ORDER WEB) ---
function listenToWebOrders() {
    const q = query(collection(db, "warung_orders"), where("warungId", "==", WARUNG_ID), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('web-orders-container');
        if(!container) return;
        container.innerHTML = snapshot.empty ? '<p style="text-align:center; color:#555; margin-top:50px;">Tidak ada pesanan.</p>' : '';
        snapshot.forEach(docSnap => {
            const order = docSnap.data();
            container.innerHTML += `
                <div class="order-card-web" style="background:#1a1a1a; border-left:4px solid gold; padding:15px; border-radius:8px; margin-bottom:10px;">
                    <b>Meja: ${order.tableNum || 'T.Away'}</b><br>
                    ${order.items.map(i => i.name).join(', ')}<br>
                    <button onclick="handleOrderAction('${docSnap.id}', 'diproses')" style="background:#00ff00; border:none; padding:5px 10px; border-radius:3px; font-weight:bold; cursor:pointer; margin-top:10px;">TERIMA</button>
                </div>`;
        });
    });
}

window.handleOrderAction = async function(id, status) {
    await updateDoc(doc(db, "warung_orders", id), { status: status });
}

// --- 5. FUNGSI PENYIMPANAN & HELPER (TETAP SAMA) ---
async function updateWarungTableCount(totalUsed) {
    try { await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: totalUsed }); } catch (e) {}
}

const qMenu = query(collection(db, "menus"), where("warungId", "==", WARUNG_ID));
onSnapshot(qMenu, (snapshot) => {
    const container = document.getElementById('menu-list-container');
    if(!container) return;
    container.innerHTML = '';
    snapshot.forEach((docSnap) => {
        const m = docSnap.data();
        container.innerHTML += `
        <div class="menu-card">
            <img src="${m.img || 'https://via.placeholder.com/150'}" style="width:100%; height:120px; object-fit:cover;">
            <div class="menu-details">
                <b>${m.name}</b><br>
                <span style="color:gold;">Rp ${parseInt(m.price).toLocaleString()}</span><br>
                <button class="btn-delete" onclick="deleteMenu('${docSnap.id}')" style="margin-top:5px; width:100%;"><i class="fa-solid fa-trash"></i> Hapus</button>
            </div>
        </div>`;
    });
});

// LOGIKA-LOGIKA GLOBAL (SINKRON DENGAN HTML)
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    const target = document.getElementById('tab-'+tabId);
    if(target) target.classList.add('active');
    if(tabId === 'qr') renderQRCodes();
}

window.toggleStoreStatus = async function() {
    const btn = document.getElementById('store-status-btn');
    const newStatus = btn.classList.contains('open') ? 'closed' : 'open';
    await updateDoc(doc(db, "warungs", WARUNG_ID), { status: newStatus });
}

window.editTableCount = async function() {
    let count = prompt("Total Meja Baru:", warungTotalCapacity);
    if(count) await updateDoc(doc(db, "warungs", WARUNG_ID), { totalTables: parseInt(count) });
}

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

// FINISH & CANCEL TRANSACTION
let selectedBookingId = null;
let selectedTableCount = 0;
window.finishBooking = function(docId, tableQty) {
    selectedBookingId = docId;
    selectedTableCount = parseInt(tableQty) || 1;
    document.getElementById('trx-amount').value = ''; 
    document.getElementById('modal-finish-transaction').style.display = 'flex';
}
window.closeFinishModal = function() { document.getElementById('modal-finish-transaction').style.display = 'none'; }
window.submitTransaction = async function() {
    const amount = document.getElementById('trx-amount').value;
    if(!amount || amount <= 0) return alert("Masukkan nominal!");
    try {
        await updateDoc(doc(db, "bookings", selectedBookingId), { status: 'finished', revenue: parseInt(amount), finishedAt: new Date() });
        await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: increment(-selectedTableCount) });
        alert("Selesai!"); closeFinishModal();
    } catch (e) { alert(e.message); }
}

window.cancelBooking = async function(id, qty) {
    if(confirm("Batalkan booking?")) {
        await deleteDoc(doc(db, "bookings", id));
        await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: increment(-parseInt(qty)) });
    }
}

// QR & LOGO IMAGE HELPER
window.triggerUpload = function() { document.getElementById('file-input').click(); }
window.renderQRCodes = function() {
    const container = document.getElementById('qr-container');
    if(!container) return;
    container.innerHTML = '';
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    for (let i = 1; i <= warungTotalCapacity; i++) {
        const qrData = `${baseUrl}/checkin.html?w=${WARUNG_ID}&t=${i}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
        container.innerHTML += `<div class="qr-card" style="background:white; padding:10px; border-radius:10px; text-align:center; color:black;"><h4>M${i}</h4><img src="${qrSrc}" style="width:100px;"><br><button class="btn-download-qr" onclick="downloadQR('${qrSrc}', ${i})">Unduh</button></div>`;
    }
}

function kirimNotifKeHP(pesan) {
    if (Notification.permission === "granted") {
        new Notification("STREETART", { body: pesan, icon: LOGO_STREETART });
    }
}
window.prosesLogout = function() { if(confirm("Logout?")) { localStorage.clear(); window.location.href = 'index.html'; } }
