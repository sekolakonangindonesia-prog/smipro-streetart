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

       if (oldName !== currentWarungName || isFirstLoad) {
    isFirstLoad = false;
    setupBookingListener();
    listenToWebOrders();
}
    }
});

/* =========================================
   2. LISTENER BOOKING (SENSITIF REAL-TIME)
   ========================================= */
window.setupBookingListener = function() {
    if (unsubscribeBooking) unsubscribeBooking();
    isInitialLoad = true; // Tambahan ini saja
    const qBooking = query(collection(db, "bookings"), where("warungId", "==", WARUNG_ID));

    unsubscribeBooking = onSnapshot(qBooking, (snapshot) => {
        const bookingsData = [];
        let countActive = 0, countBooked = 0;
        const now = new Date();
        const dateInput = document.getElementById('filter-date-booking');
        const today = dateInput && dateInput.value ? dateInput.value : new Date().toISOString().split('T')[0];

        snapshot.docChanges().forEach((change) => {
    if (!isInitialLoad) {
        const d = change.doc.data();

        // 1. Jika ada DATA BARU (Added)
        if (change.type === "added") {
            if (d.status === 'booked') {
                
                // Booking Baru (Kuning)
                notifSound.play();
                window.tampilkanPesananBaru('booking', 'Reservasi Baru', `Tamu: ${d.customerName}`, 'home');
            } else if (d.status === 'active' && d.bookingCode === 'WALK-IN') {
                
                // Walk-In Baru (Merah)
                notifSound.play();
                window.tampilkanPesananBaru('walkin', 'Tamu Walk-In', `Tamu: ${d.customerName} langsung di lokasi`, 'home');
            }
        }

        // 2. Jika ada PERUBAHAN DATA (Modified) -> Ini untuk Check-In
        if (change.type === "modified") {
            // Jika status berubah menjadi 'active' (Tamu datang/Check-In)
            if (d.status === 'active') {
                notifSound.play();
                const nomorMeja = Array.isArray(d.tableNum) ? d.tableNum.join(',') : d.tableNum;
                window.tampilkanPesananBaru('checkin', 'Tamu Telah Datang', `${d.customerName} sudah duduk di Meja ${nomorMeja}`, 'home');
            }
        }
    }
});


        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.status === 'finished') return;
            
            if (d.status === 'booked' && d.expiredTime) {
            const expiredDate = new Date(d.expiredTime);
            // Jika waktu sekarang sudah melewati batas hangus (17:30 di tanggal bookingnya)
            if (now > expiredDate) {
            deleteDoc(docSnap.ref); // Hapus permanen dari database
            return; 
                }
            }
            bookingsData.push({ id: docSnap.id, ...d });
            
          if (d.bookingDate === today) {
                const qty = parseInt(d.tablesNeeded) || 1;
                if(d.status === 'active') {
                    countActive += qty;
                } else if (d.status === 'booked') {
                    countBooked += qty;
                }
            }
        });

        // Simpan untuk Notifikasi Lonceng
       window.currentActiveBookings = bookingsData.map(b => {
    // Terapkan Logika Pembeda
    const isWalkIn = (b.bookingCode === 'WALK-IN' || b.status === 'active');
    return {
        id: b.id, 
        type: isWalkIn ? 'walkin' : 'booking', // Bedakan tipe
        judul: isWalkIn ? 'Tamu Datang / Walk-In' : 'Reservasi Baru',
        detail: `${b.customerName} (${b.tablesNeeded || 1} Meja)`,
        time: b.timestamp ? b.timestamp.toMillis() : Date.now(), 
        target: 'home',
        bookingDate: b.bookingDate, 
        isRead: localStorage.getItem(`read_${b.id}`) === 'true' // Cek status baca per item
    };
});
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

    const dateInput = document.getElementById('filter-date-booking');
    const today = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    const dataHariIni = bookings.filter(b => b.bookingDate === today || b.status === 'active');

    if (dataHariIni.length === 0) { // Ganti dari bookings ke dataHariIni
        container.innerHTML = '<p style="text-align:center; color:#555; grid-column:1/-1;">Tidak ada pesanan untuk hari ini.</p>';
        return;
    }

    dataHariIni.sort((a, b) => (a.status === 'active' ? -1 : 1));
    dataHariIni.forEach((b) => {
        const qty = b.tablesNeeded || 1;
        const nomorMeja = b.tableNum ? (Array.isArray(b.tableNum) ? "MEJA " + b.tableNum.join(", ") : "MEJA " + b.tableNum) : "Pending";
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
    
    if (!isVisible) {
        // --- PROSES KETIKA LONCENG DIBUKA ---
        panel.style.display = 'flex';
        
        // 1. Langsung simpan waktu buka agar semua notif lama dianggap "Sudah Dibaca"
        localStorage.setItem('lastReadNotifTime', Date.now().toString()); 
        
        // 2. Langsung hapus angka di badge merah
        if(badge) badge.style.display = 'none';
        
        // 3. Langsung gambar ulang list (Agar titik birunya hilang seketika)
        window.refreshNotifBell();
    } else {
        panel.style.display = 'none';
    }
};

/* --- REVISI: MESIN PENGISI RIWAYAT LONCENG (INSTANT UPDATE) --- */
window.refreshNotifBell = function() {
    const listContainer = document.getElementById('notif-list-history');
    const badge = document.getElementById('web-notif-count');
    if(!listContainer) return;

    const allNotifs = [...(window.currentActiveBookings || []), ...(window.currentActiveOrders || [])];
    allNotifs.sort((a, b) => b.time - a.time);

    // 1. HITUNG YANG BELUM DIBACA (Per ID)
    const unreadCount = allNotifs.filter(n => n.isRead === false).length;
    if(badge) {
        badge.innerText = unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }

    listContainer.innerHTML = allNotifs.length === 0 ? '<p style="text-align:center; padding:20px; color:#555;">Kosong.</p>' : '';
    
    allNotifs.forEach(n => {
        let color = n.type === 'walkin' ? '#E50914' : (n.type === 'order' ? '#00d2ff' : '#FFD700');
        let icon = n.type === 'walkin' ? 'fa-walking' : (n.type === 'order' ? 'fa-utensils' : 'fa-calendar-check');

        // 2. TAMPILKAN TITIK BIRU JIKA ISREAD MASIH FALSE
        const blueDot = n.isRead ? '' : '<div class="unread-dot"></div>';

        listContainer.innerHTML += `
            <div class="notif-item" onclick="window.eksekusiBacaPesan('${n.id}', '${n.target}')">
                <div style="width:35px; height:35px; border-radius:50%; background:${color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <i class="fa-solid ${icon}" style="color:black; font-size:0.8rem;"></i>
                </div>
                <div style="flex:1; text-align:left;">
                    <b style="display:block; font-size:0.85rem; color:white;">${n.judul}</b>
                    <small style="color:#aaa; font-size:0.75rem;">${n.detail}</small>
                </div>
                ${blueDot}
            </div>`;
    });
};

/* --- FUNGSI KLIK: HILANGKAN TITIK & KURANGI ANGKA SECARA INSTAN --- */
window.eksekusiBacaPesan = function(id, targetTab) {
    // 1. Simpan status baca di memori permanen
    localStorage.setItem(`read_${id}`, 'true');

    // 2. Paksa update status di memori sementara (agar UI langsung berubah tanpa refresh)
    [...window.currentActiveBookings, ...window.currentActiveOrders].forEach(n => {
        if (n.id === id) n.isRead = true;
    });

    // 3. Langsung gambar ulang Lonceng (Titik akan hilang & Angka akan kurang 1 saat ini juga)
    window.refreshNotifBell();

    // 4. Jika ada tanggal booking, arahkan filter ke tanggal tersebut
    const notif = window.currentActiveBookings.find(n => n.id === id);
    if (notif && notif.bookingDate) {
        const dateInput = document.getElementById('filter-date-booking');
        if (dateInput) {
            dateInput.value = notif.bookingDate;
            setupBookingListener();
        }
    }

   // 5. Pindah ke tab yang dituju
    window.switchTab(targetTab);
};

/* --- FUNGSI BUKA LONCENG (HANYA BUKA SAJA) --- */
window.toggleNotifPanel = function(e) {
    if(e) e.stopPropagation();
    const panel = document.getElementById('notif-panel');
    if(!panel) return;
    
    // Hanya buka dan tutup panel, jangan meriset apapun
    const isVisible = panel.style.display === 'flex';
    panel.style.display = isVisible ? 'none' : 'flex';
    
    window.refreshNotifBell(); 
};

// Fungsi saat notif diklik (Mark as Read)
window.bacaNotif = function(id, targetTab) {
    localStorage.setItem(`read_notif_${id}`, 'true'); // Tandai di memori HP bahwa ID ini sudah dibuka
    window.switchTab(targetTab); 
    window.refreshNotifBell(); // Update tampilan (titik biru hilang, angka lonceng kurang 1)
};

window.tampilkanPesananBaru = function(tipe, judul, pesan, tab) {
    const container = document.getElementById('notif-toast-container');
    if(!container) return;
    let warnaSide = '#FFD700'; // Default Kuning
    if (tipe === 'walkin' || tipe === 'checkin') {
        warnaSide = '#E50914'; // Merah
    }
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

// --- GANTI BARIS 390 - 392 DENGAN INI ---
window.updateOrderSystemStatus = async function(isActive) {
    try {
        const docRef = doc(db, "warungs", WARUNG_ID);
        await updateDoc(docRef, {
            enableOrder: isActive // true atau false
        });
        
        // Perbaikan: Update teks keterangan di bawah saklar (Toggle) secara instan
        const desc = document.getElementById('order-status-desc');
        if(desc) {
            desc.innerText = isActive ? 'Fitur sedang Aktif' : 'Fitur sedang Mati';
            desc.style.color = isActive ? '#00ff00' : '#888';
        }
        console.log("Sistem Order Online:", isActive ? "AKTIF" : "MATI");
    } catch (e) {
        alert("Gagal memperbarui fitur order: " + e.message);
        // Kembalikan posisi tombol jika pengiriman ke Firebase gagal
        const toggle = document.getElementById('toggle-order-web');
        if(toggle) toggle.checked = !isActive;
    }
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

window.goHome = () => window.location.href = 'index.html';
window.prosesLogout = () => { if(confirm("Logout?")) { localStorage.clear(); window.location.href = 'index.html'; } };


function listenToWebOrders() {
    const warungId = localStorage.getItem('mitraId');
    const q = query(collection(db, "warung_orders"), where("warungId", "==", warungId), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('web-orders-container');
        if(!container) return;
        
        window.currentActiveOrders = snapshot.docs.map(doc => {
            const o = doc.data(); 
            return { id: doc.id, 
                    type: 'order', 
                    judul: 'Pesanan Menu', 
                    detail: `Meja: ${o.tableNum || 'T.Away'}`, 
                    time: o.timestamp ? o.timestamp.toMillis() : Date.now(), 
                    target: 'web-orders',
                    isRead: localStorage.getItem(`read_${doc.id}`) === 'true'};
        });
        
        window.refreshNotifBell();
        container.innerHTML = snapshot.empty ? '<p style="text-align:center; color:#555; margin-top:50px;">Tidak ada pesanan.</p>' : '';
        snapshot.forEach(docSnap => {
            const order = docSnap.data();
            const orderId = docSnap.id;
            const totalOrder = order.items.reduce((sum, item) => sum + item.price, 0);
            
           container.innerHTML += `
        <div class="order-card-web">
            <div style="display:flex; justify-content:space-between;">
                <b>Meja: ${order.tableNum}</b>
                <small>${new Date(order.timestamp?.toDate()).toLocaleTimeString()}</small>
            </div>
            <div style="margin:10px 0; color:#ccc; font-size:0.85rem;">
                ${order.items.map(i => `• ${i.name}`).join('<br>')}
            </div>
            <hr style="border-color:#333;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <b style="color:gold;">Rp ${totalOrder.toLocaleString()}</b>
                <button onclick="window.finishWebOrder('${orderId}', ${totalOrder})" 
                        style="background:#00ff00; color:black; border:none; padding:5px 12px; border-radius:5px; font-weight:bold; cursor:pointer;">
                    LUNAS
                </button>
                </div>
        </div>`;
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

/* =========================================
   FITUR TAMBAHAN: FOTO SAMPUL (COVER)
   ========================================= */

window.previewCoverImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = async function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                // Kompresi agar ringan
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64Data = canvas.toDataURL('image/jpeg', 0.7);
                
                try {
                    await updateDoc(doc(db, "warungs", WARUNG_ID), { bannerImg: base64Data });
                    alert("✅ Foto Sampul berhasil diperbarui!");
                    // Update tampilan banner secara instan
                    const banner = document.getElementById('banner-bg');
                    if(banner) banner.style.backgroundImage = `url('${base64Data}')`;
                } catch (error) {
                    alert("Gagal update foto sampul: " + error.message);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.triggerCoverUpload = function() {
    const input = document.getElementById('cover-file-input');
    if(input) input.click();
}; 

/* =========================================
   BAGIAN EKSEKUSI & FILTER TANGGAL
   ========================================= */

// Fungsi ini supaya tombol "HARI INI" di HTML bisa diklik
window.setTodayFilter = function() {
    const dateInput = document.getElementById('filter-date-booking');
    if(dateInput) {
        // Balikkan tanggal ke hari ini
        dateInput.value = new Date().toISOString().split('T')[0];
        // Paksa aplikasi untuk hitung ulang meja sesuai tanggal hari ini
        setupBookingListener(); 
    }
}

// Perintah yang dijalankan OTOMATIS saat Dashboard baru dibuka
window.addEventListener('load', () => {
    const dateInput = document.getElementById('filter-date-booking');
    if(dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
});

// --- TARUH DI PALING BAWAH mitra-script.js ---
window.finishWebOrder = async function(orderId, totalUang) {
    if(!confirm(`Pesanan Meja ini sudah lunas sebesar Rp ${totalUang.toLocaleString()}?`)) return;

    try {
        // 1. Update status pesanan jadi finished agar hilang dari layar "Pesanan Web"
        await updateDoc(doc(db, "warung_orders", orderId), { 
            status: "finished",
            paidAt: new Date()
        });

        // 2. Notifikasi sukses
        alert("Pembayaran Berhasil! Data telah diarsipkan ke laporan.");
        
    } catch (e) {
        alert("Eror saat memproses pembayaran: " + e.message);
    }
};
