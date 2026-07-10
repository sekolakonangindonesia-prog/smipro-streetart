// --- 1. IMPORT FIREBASE ---
import { db } from './firebase-config.js';
import { 
    doc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, query, where, getDoc, setDoc, increment, orderBy, getDocs, arrayUnion, runTransaction
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

// ============================================================
// FIX BUG 1: Hapus isFirstLoad & kondisi yang menyebabkan
// setupBookingListener() dipanggil berulang dari onSnapshot warung.
// Sekarang setupBookingListener hanya dipanggil SEKALI saat halaman
// pertama kali load, bukan setiap kali data warung berubah.
// ============================================================
let hasSetupBookingListener = false;

const notifSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
const LOGO_STREETART = "https://raw.githubusercontent.com/sekolakonangindonesia-prog/smipro-streetart/main/Logo_Stretart.png";

// ============================================================
// HELPER: Ambil tanggal hari ini dalam WIB (UTC+7)
// FIX BUG 2: Gunakan helper ini di semua tempat yang butuh
// tanggal hari ini, agar konsisten dengan data yang disimpan dashboard.
// ============================================================
function getTodayWIB() {
    const now = new Date();
    const wib = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    return wib.toISOString().split('T')[0];
}

/* =========================================
   1. LISTENER DATA WARUNG (UTAMA)
   ========================================= */
onSnapshot(doc(db, "warungs", WARUNG_ID), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        warungTotalCapacity = data.totalTables || 15; 
        currentWarungName = data.name; 

        document.getElementById('shop-name-display').innerText = data.name;
        if(data.img) {
            document.getElementById('header-profile-img').src = data.img;
            document.getElementById('preview-profile-img').src = data.img;
        }

        // Load foto QRIS jika sudah ada
        if (data.qrisImg) {
            const previewQris = document.getElementById('preview-qris-img');
            if (previewQris) previewQris.src = data.qrisImg;
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

        // FIX BUG 1: setupBookingListener hanya dipanggil SEKALI
        // (saat data warung pertama kali berhasil dimuat),
        // bukan setiap kali ada perubahan data warung.
        if (!hasSetupBookingListener) {
            hasSetupBookingListener = true;
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
    isInitialLoad = true;
    const qBooking = query(collection(db, "bookings"), where("warungId", "==", WARUNG_ID));

    unsubscribeBooking = onSnapshot(qBooking, (snapshot) => {
        const bookingsData = [];
        let countActive = 0, countBooked = 0;
        const now = new Date();
        
        // FIX: Gunakan helper WIB agar konsisten
        const dateInput = document.getElementById('filter-date-booking');
        const today = (dateInput && dateInput.value) ? dateInput.value : getTodayWIB();
        
        snapshot.docChanges().forEach((change) => {
            if (!isInitialLoad) {
                const d = change.doc.data();

                if (change.type === "added") {
                    if (d.status === 'booked') {
                        notifSound.play();
                        window.tampilkanPesananBaru('booking', 'Reservasi Baru', `Tamu: ${d.customerName}`, 'home');
                    } else if (d.status === 'active' && d.bookingCode === 'WALK-IN') {
                        notifSound.play();
                        window.tampilkanPesananBaru('walkin', 'Tamu Walk-In', `Tamu: ${d.customerName} langsung di lokasi`, 'home');
                    }
                }

                if (change.type === "modified") {
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
                if (now > expiredDate) {
                    deleteDoc(docSnap.ref);
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

        window.currentActiveBookings = bookingsData.map(b => {
            const isWalkIn = (b.bookingCode === 'WALK-IN' || b.status === 'active');
            return {
                id: b.id, 
                type: isWalkIn ? 'walkin' : 'booking',
                judul: isWalkIn ? 'Tamu Datang / Walk-In' : 'Reservasi Baru',
                detail: `${b.customerName} (${b.tablesNeeded || 1} Meja)`,
                time: b.timestamp ? b.timestamp.toMillis() : Date.now(), 
                target: 'home',
                bookingDate: b.bookingDate, 
                isRead: localStorage.getItem(`read_${b.id}`) === 'true'
            };
        });
        window.refreshNotifBell();

        document.getElementById('occupied-count').innerText = countActive;
        document.getElementById('booked-count').innerText = countBooked;
        const sisa = warungTotalCapacity - (countActive + countBooked);
        const totalEl = document.getElementById('total-table-count');
        if(totalEl) {
            totalEl.innerText = sisa < 0 ? 0 : sisa;
            totalEl.style.color = sisa <= 0 ? 'red' : '#00ff00';
        }


        // SINKRONISASI: Simpan sisaMeja ke Firestore agar warung-profile
        // baca langsung dari sini → selalu sinkron dengan dashboard
        updateDoc(doc(db, "warungs", WARUNG_ID), {
            availableTables: sisa < 0 ? 0 : sisa,
            lastAvailableDate: today
        }).catch(() => {});
        renderBookings(bookingsData);
        isInitialLoad = false;
    });
}

function renderBookings(bookings) {
    const container = document.getElementById('booking-container');
    if(!container) return;
    container.innerHTML = bookings.length === 0 ? '<p style="text-align:center; color:#555; grid-column:1/-1;">Belum ada pesanan.</p>' : '';

    const dateInput = document.getElementById('filter-date-booking');
    // FIX: Gunakan helper WIB agar konsisten
    const today = (dateInput && dateInput.value) ? dateInput.value : getTodayWIB();
    // FIX BUG: Sebelumnya `|| b.status === 'active'` tanpa cek tanggal,
    // akibatnya booking active dari hari LAIN (misal kemarin belum di-finish)
    // ikut ditampilkan dan ikut dikurangi dari total meja hari ini.
    // Sekarang: hanya tampilkan booking di tanggal yang dipilih filter.
    const dataHariIni = bookings.filter(b => b.bookingDate === today);

    if (dataHariIni.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#555; grid-column:1/-1;">Tidak ada pesanan untuk hari ini.</p>';
        return;
    }

    dataHariIni.sort((a, b) => (a.status === 'active' ? -1 : 1));
    dataHariIni.forEach((b) => {
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

// FIX: Hanya ada SATU definisi toggleNotifPanel (yang lama ada duplikat)
window.toggleNotifPanel = function(e) {
    if(e) e.stopPropagation();
    const panel = document.getElementById('notif-panel');
    if(!panel) return;
    
    const isVisible = panel.style.display === 'flex';
    panel.style.display = isVisible ? 'none' : 'flex';
    
    window.refreshNotifBell(); 
};

window.refreshNotifBell = function() {
    const listContainer = document.getElementById('notif-list-history');
    const badge = document.getElementById('web-notif-count');
    if(!listContainer) return;

    const allNotifs = [...(window.currentActiveBookings || []), ...(window.currentActiveOrders || [])];
    allNotifs.sort((a, b) => b.time - a.time);

    const unreadCount = allNotifs.filter(n => n.isRead === false).length;
    if(badge) {
        badge.innerText = unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }

    listContainer.innerHTML = allNotifs.length === 0 ? '<p style="text-align:center; padding:20px; color:#555;">Kosong.</p>' : '';
    
    allNotifs.forEach(n => {
        let color = n.type === 'walkin' ? '#E50914' : (n.type === 'order' ? '#00d2ff' : '#FFD700');
        let icon = n.type === 'walkin' ? 'fa-walking' : (n.type === 'order' ? 'fa-utensils' : 'fa-calendar-check');
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

// FIX: Deklarasikan dateInput di scope yang benar agar eksekusiBacaPesan bisa mengaksesnya
window.eksekusiBacaPesan = function(id, targetTab) {
    localStorage.setItem(`read_${id}`, 'true');

    [...window.currentActiveBookings, ...window.currentActiveOrders].forEach(n => {
        if (n.id === id) n.isRead = true;
    });

    window.refreshNotifBell();

    // FIX: dateInput diambil di dalam fungsi (bukan dari scope luar yang sudah tutup)
    const dateInput = document.getElementById('filter-date-booking');
    const notif = window.currentActiveBookings.find(n => n.id === id);
    if (notif && notif.bookingDate && dateInput) {
        if (dateInput.value !== notif.bookingDate) {
            dateInput.value = notif.bookingDate;
            setupBookingListener();
        }
    }

    window.switchTab(targetTab);
};

window.tampilkanPesananBaru = function(tipe, judul, pesan, tab) {
    const container = document.getElementById('notif-toast-container');
    if(!container) return;
    let warnaSide = tipe === 'walkin' || tipe === 'checkin' ? '#E50914' : '#FFD700';
    const toast = document.createElement('div');
    toast.className = 'toast-notif';
    toast.style.borderLeft = `5px solid ${warnaSide}`;
    toast.onclick = () => { window.switchTab(tab); toast.remove(); };
    toast.innerHTML = `<img src="${LOGO_STREETART}" style="width:35px; border-radius:50%;"><div style="flex:1;"><b>${judul}</b><br><small>${pesan}</small></div>`;
    container.appendChild(toast);
    setTimeout(() => { if(toast) toast.remove(); }, 8000);
    if (Notification.permission === "granted") new Notification("STREETART", { body: pesan, icon: LOGO_STREETART });
};

/* =========================================
   4. FUNGSI TAB & QR
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
   5. SISANYA LOGIKA TOMBOL
   ========================================= */
window.toggleStoreStatus = async function() {
    const btn = document.getElementById('store-status-btn');
    const newStatus = btn && btn.classList.contains('open') ? 'closed' : 'open';
    await updateDoc(doc(db, "warungs", WARUNG_ID), { status: newStatus });
};

window.updateOrderSystemStatus = async function(isActive) {
    try {
        const docRef = doc(db, "warungs", WARUNG_ID);
        await updateDoc(docRef, { enableOrder: isActive });
        
        const desc = document.getElementById('order-status-desc');
        if(desc) {
            desc.innerText = isActive ? 'Fitur sedang Aktif' : 'Fitur sedang Mati';
            desc.style.color = isActive ? '#00ff00' : '#888';
        }
    } catch (e) {
        alert("Gagal memperbarui fitur order: " + e.message);
        const toggle = document.getElementById('toggle-order-web');
        if(toggle) toggle.checked = !isActive;
    }
};

window.finishBooking = async function(id, qty) {
    window.selectedBookingId = id; window.selectedTableCount = qty;
    document.getElementById('trx-amount').value = '';

    const infoEl = document.getElementById('trx-online-info');
    try {
        const snap = await getDoc(doc(db, "bookings", id));
        const online = snap.exists() ? (parseInt(snap.data().onlineRevenue) || 0) : 0;
        window.selectedOnlineRevenue = online;
        if (online > 0) {
            infoEl.style.display = 'block';
            infoEl.innerText = `Sudah ada order online masuk: Rp ${online.toLocaleString()}`;
        } else {
            infoEl.style.display = 'none';
        }
    } catch (e) {
        window.selectedOnlineRevenue = 0;
        infoEl.style.display = 'none';
    }

    document.getElementById('modal-finish-transaction').style.display = 'flex';
};

window.submitTransaction = async function() {
    const manualInput = document.getElementById('trx-amount').value;
    const manualAmt   = manualInput ? parseInt(manualInput) : 0;
    if (manualInput && manualAmt < 0) return alert("Nominal tidak valid!");

    const onlineAmt = window.selectedOnlineRevenue || 0;
    const totalAmt  = onlineAmt + manualAmt;
    if (totalAmt <= 0) return alert("Masukkan nominal transaksi (tidak ada order online maupun manual)!");

    // FIX: Pastikan semua field yang dibutuhkan rekap admin tersimpan
    // Admin membaca: warungName, venueName, pax, revenue, finishedAt dari koleksi bookings
    const bookingSnap = await getDoc(doc(db, "bookings", window.selectedBookingId));
    const bookingData = bookingSnap.exists() ? bookingSnap.data() : {};
    
    await updateDoc(doc(db, "bookings", window.selectedBookingId), { 
        status: 'finished', 
        revenue: totalAmt,
        manualRevenue: manualAmt,
        onlineRevenue: onlineAmt,
        finishedAt: new Date(),
        // Pastikan field rekap ada (fallback ke data warung jika kosong di booking)
        warungName: bookingData.warungName || currentWarungName,
        venueName: bookingData.venueName || "",
        pax: bookingData.pax || 0
    });
    await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: increment(-window.selectedTableCount) });
    document.getElementById('modal-finish-transaction').style.display = 'none';
};

window.cancelBooking = async function(id, qty) {
    if(confirm("Batalkan?")) {
        await deleteDoc(doc(db, "bookings", id));
        await updateDoc(doc(db, "warungs", WARUNG_ID), { bookedCount: increment(-parseInt(qty)) });
    }
};

window.closeFinishModal = function() {
    document.getElementById('modal-finish-transaction').style.display = 'none';
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

const ORDER_CHIP_LABEL = { pending: 'Pesanan Baru', diproses: 'Sedang Dibuat', siap: 'Siap Diambil' };

function renderOrderActions(orderId, status, totalOrder) {
    const cetakBtn = `<button class="btn-order-action btn-cetak" onclick="window.cetakStruk('${orderId}')" title="Cetak Struk"><i class="fa-solid fa-print"></i></button>`;
    if (status === 'pending') {
        return `<div class="order-actions">
            <button class="btn-order-action btn-terima" onclick="window.updateOrderStatus('${orderId}','diproses')">Terima Pesanan</button>
            ${cetakBtn}
            <button class="btn-order-action btn-batal" onclick="window.cancelWebOrder('${orderId}')"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }
    if (status === 'diproses') {
        return `<div class="order-actions">
            <button class="btn-order-action btn-siap" onclick="window.updateOrderStatus('${orderId}','siap')">Siap Diambil</button>
            ${cetakBtn}
            <button class="btn-order-action btn-batal" onclick="window.cancelWebOrder('${orderId}')"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }
    // status === 'siap'
    return `<div class="order-actions">
        <button class="btn-order-action btn-lunas" onclick="window.finishWebOrder('${orderId}', ${totalOrder})">LUNAS</button>
        ${cetakBtn}
        <button class="btn-order-action btn-batal" onclick="window.cancelWebOrder('${orderId}')"><i class="fa-solid fa-trash"></i></button>
    </div>`;
}

function listenToWebOrders() {
    const warungId = localStorage.getItem('mitraId');
    const q = query(collection(db, "warung_orders"), where("warungId", "==", warungId), where("status", "in", ["pending", "diproses", "siap"]));
    onSnapshot(q, (snapshot) => {
        // FIX BEL: Bunyikan notif saat ada pesanan menu BARU
        if (typeof isFirstOrderLoad === "undefined") window.isFirstOrderLoad = true;
        if (!window.isFirstOrderLoad) {
            snapshot.docChanges().forEach(change => {
                if (change.type === "added") {
                    const o = change.doc.data();
                    notifSound.play().catch(() => {});
                    window.tampilkanPesananBaru("order", "Pesanan Menu Baru", `Meja: ${o.tableNum || "-"}`, "web-orders");
                }
            });
        }
        window.isFirstOrderLoad = false;
        const container = document.getElementById('web-orders-container');
        if(!container) return;
        
        window.currentActiveOrders = snapshot.docs.map(doc => {
            const o = doc.data(); 
            return { 
                id: doc.id, 
                type: 'order', 
                judul: 'Pesanan Menu', 
                detail: `Meja: ${o.tableNum || 'T.Away'}`, 
                time: o.timestamp ? o.timestamp.toMillis() : Date.now(), 
                target: 'web-orders',
                isRead: localStorage.getItem(`read_${doc.id}`) === 'true'
            };
        });
        
        window.refreshNotifBell();

        // Urutkan: pending dulu, lalu diproses, lalu siap. Dalam tiap grup, yang paling lama nunggu di atas.
        const urutanStatus = { pending: 0, diproses: 1, siap: 2 };
        const docsSorted = [...snapshot.docs].sort((a, b) => {
            const sa = urutanStatus[a.data().status] ?? 9;
            const sb = urutanStatus[b.data().status] ?? 9;
            if (sa !== sb) return sa - sb;
            const ta = a.data().timestamp ? a.data().timestamp.toMillis() : 0;
            const tb = b.data().timestamp ? b.data().timestamp.toMillis() : 0;
            return ta - tb;
        });

        container.innerHTML = snapshot.empty ? '<p style="text-align:center; color:#555; margin-top:50px;">Tidak ada pesanan aktif saat ini.</p>' : '';
        docsSorted.forEach(docSnap => {
            const order = docSnap.data();
            const orderId = docSnap.id;
            const status = order.status || 'pending';
            const totalOrder = order.items.reduce((sum, item) => sum + item.price, 0);
            const waktuOrder = order.timestamp?.toDate ? order.timestamp.toDate() : new Date();
            const menitLalu = Math.floor((Date.now() - waktuOrder.getTime()) / 60000);
            const timerHtml = status !== 'siap'
                ? `<span class="order-timer ${menitLalu >= 10 ? 'lama' : ''}"><i class="fa-regular fa-clock"></i> ${menitLalu < 1 ? 'baru saja' : menitLalu + ' menit lalu'}</span>`
                : '';

            // simpan data lengkap untuk fitur cetak struk
            window.orderDataCache = window.orderDataCache || {};
            window.orderDataCache[orderId] = { ...order, id: orderId, totalOrder };

            const nomorAntrianHtml = order.orderNumber
                ? `<span style="background:#000; color:var(--gold); font-weight:900; padding:2px 8px; border-radius:4px; font-size:0.8rem; margin-right:6px;">#${String(order.orderNumber).padStart(3,'0')}</span>`
                : '';

            container.innerHTML += `
            <div class="order-card-web status-${status}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <b>${nomorAntrianHtml}Meja: ${order.tableNum || 'Take Away'}</b>
                    <small>${waktuOrder.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</small>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                    <span class="order-chip ${status}">${ORDER_CHIP_LABEL[status] || status}</span>
                    ${timerHtml}
                </div>
                <div style="margin:10px 0; color:#ccc; font-size:0.85rem;">
                    ${order.items.map(i => `• ${i.name}`).join('<br>')}
                </div>
                <hr style="border-color:#333;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <b style="color:gold;">Rp ${totalOrder.toLocaleString()}</b>
                </div>
                ${renderOrderActions(orderId, status, totalOrder)}
            </div>`;
        });
    });
}

window.updateOrderStatus = async function(id, status) {
    try {
        await updateDoc(doc(db, "warung_orders", id), { status: status });
    } catch (e) {
        alert("Gagal update status: " + e.message);
    }
};

window.cetakStruk = function(orderId) {
    const order = (window.orderDataCache || {})[orderId];
    if (!order) return alert('Data pesanan tidak ditemukan.');

    const namaWarung = localStorage.getItem('mitraName') || 'SMIPRO Streetart';
    const waktuOrder = order.timestamp?.toDate ? order.timestamp.toDate() : new Date();
    const tanggalStr = waktuOrder.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const jamStr     = waktuOrder.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const nomorAntrian = order.orderNumber ? `#${String(order.orderNumber).padStart(3, '0')}` : '-';

    const barisItem = order.items.map(i =>
        `<div class="struk-item"><span>${i.name}</span><span>${Number(i.price).toLocaleString('id-ID')}</span></div>`
    ).join('');

    const struk = `
    <html><head><title>Struk ${nomorAntrian}</title>
    <style>
        @page { margin: 0; size: 58mm auto; }
        body { font-family: 'Courier New', monospace; width: 58mm; margin: 0 auto; padding: 8px; font-size: 12px; color:#000; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        .struk-item { display: flex; justify-content: space-between; margin: 2px 0; }
        .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; }
        .antrian { font-size: 20px; font-weight: 900; text-align:center; margin: 4px 0; }
    </style></head>
    <body>
        <div class="center bold">${namaWarung}</div>
        <div class="center">SMIPRO Streetart.id</div>
        <hr>
        <div class="antrian">${nomorAntrian}</div>
        <hr>
        <div>Tanggal : ${tanggalStr} ${jamStr}</div>
        <div>Meja    : ${order.tableNum || 'Take Away'}</div>
        <div>Nama    : ${order.customerName || '-'}</div>
        <hr>
        ${barisItem}
        <hr>
        <div class="total-row"><span>TOTAL</span><span>Rp ${Number(order.totalOrder).toLocaleString('id-ID')}</span></div>
        <div>Bayar   : ${(order.metodeBayar || '-').toUpperCase()}</div>
        <hr>
        <div class="center">Terima kasih 🙏</div>
        <div class="center">streetart.id</div>
    </body></html>`;

    const win = window.open('', '_blank', 'width=380,height=600');
    win.document.write(struk);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
};

// Alias lama, tetap dipertahankan agar tidak merusak pemanggilan yang sudah ada
window.handleOrderAction = window.updateOrderStatus;

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

window.openModalMenu = function() { document.getElementById('modal-menu').style.display = 'flex'; };
window.closeModalMenu = function() { document.getElementById('modal-menu').style.display = 'none'; };

window.addMenu = async function() {
    const name = document.getElementById('new-menu-name').value;
    const price = document.getElementById('new-menu-price').value;
    const desc = document.getElementById('new-menu-desc').value;
    if(!name || !price) return alert("Nama dan Harga wajib diisi!");
    await addDoc(collection(db, "menus"), {
        warungId: WARUNG_ID,
        name, price: parseInt(price), desc,
        img: currentMenuImageBase64 || ''
    });
    window.closeModalMenu();
};

window.deleteMenu = async function(id) { if(confirm("Hapus menu?")) await deleteDoc(doc(db, "menus", id)); };

window.previewImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = async function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 400;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64Data = canvas.toDataURL('image/jpeg', 0.7);
                try {
                    await updateDoc(doc(db, "warungs", WARUNG_ID), { img: base64Data });
                    document.getElementById('header-profile-img').src = base64Data;
                    document.getElementById('preview-profile-img').src = base64Data;
                    alert("Foto profil berhasil diperbarui!");
                } catch (error) {
                    alert("Gagal update foto: " + error.message);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.previewMenuImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 400;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                currentMenuImageBase64 = canvas.toDataURL('image/jpeg', 0.7);
                document.getElementById('preview-menu-img').src = currentMenuImageBase64;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.previewCoverImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = async function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64Data = canvas.toDataURL('image/jpeg', 0.7);
                try {
                    await updateDoc(doc(db, "warungs", WARUNG_ID), { bannerImg: base64Data });
                    alert("Foto Sampul berhasil diperbarui!");
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


window.previewQrisImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = async function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_SIZE = 400;
                const scale = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64Data = canvas.toDataURL('image/jpeg', 0.9);
                
                const previewEl = document.getElementById('preview-qris-img');
                if (previewEl) previewEl.src = base64Data;
                
                try {
                    await updateDoc(doc(db, "warungs", WARUNG_ID), { 
                        qrisImg: base64Data 
                    });
                    alert("Foto QRIS berhasil disimpan!");
                } catch (error) {
                    alert("Gagal simpan QRIS: " + error.message);
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

document.onclick = function() {
    const panel = document.getElementById('notif-panel');
    if(panel) panel.style.display = 'none';
};

/* =========================================
   FILTER TANGGAL
   ========================================= */
window.setTodayFilter = function() {
    const dateInput = document.getElementById('filter-date-booking');
    if(dateInput) {
        // FIX: Gunakan helper WIB
        dateInput.value = getTodayWIB();
        setupBookingListener(); 
    }
}

window.cancelWebOrder = async function(orderId) {
    if(!confirm("Hapus pesanan ini?")) return;
    try {
        await deleteDoc(doc(db, "warung_orders", orderId));
    } catch (e) {
        alert("Gagal hapus: " + e.message);
    }
};

window.finishWebOrder = async function(orderId, totalUang) {
    if(!confirm(`Pesanan Meja ini sudah lunas sebesar Rp ${totalUang.toLocaleString()}?`)) return;
    try {
        const orderSnap = await getDoc(doc(db, "warung_orders", orderId));
        const orderData = orderSnap.exists() ? orderSnap.data() : {};
        const todayStr  = getTodayWIB();
        const jumlah    = parseInt(totalUang) || 0;

        await updateDoc(doc(db, "warung_orders", orderId), { 
            status: "finished",
            paidAt: new Date()
        });

        // FIX ENDING FLOW: cari sesi booking meja yang MASIH AKTIF untuk nomor meja ini.
        // Kalau ketemu -> gabungkan omzet order online ke SATU dokumen booking yang sama.
        // Ini mencegah 2 entri laporan terpisah (booking meja + order online) untuk 1 kunjungan
        // yang sama, dan mencegah meja "nyangkut" aktif selamanya karena flow selesai order
        // online sebelumnya tidak pernah menutup booking mejanya.
        // Kalau TIDAK ketemu (take-away / order tanpa reservasi meja) -> tetap dicatat berdiri
        // sendiri sebagai transaksi selesai, supaya tetap masuk laporan admin.
        const tableNumInt = parseInt(orderData.tableNum, 10);
        let linkedBookingId = null;

        if (!isNaN(tableNumInt)) {
            const qActive = query(
                collection(db, "bookings"),
                where("warungId", "==", WARUNG_ID),
                where("status", "==", "active"),
                where("bookingDate", "==", todayStr),
                where("tableNum", "array-contains", tableNumInt)
            );
            const activeSnap = await getDocs(qActive);
            if (!activeSnap.empty) linkedBookingId = activeSnap.docs[0].id;
        }

        if (linkedBookingId) {
            await updateDoc(doc(db, "bookings", linkedBookingId), {
                revenue: increment(jumlah),
                onlineRevenue: increment(jumlah),
                linkedOrderIds: arrayUnion(orderId)
            });
        } else {
            await addDoc(collection(db, "bookings"), {
                warungId: WARUNG_ID,
                warungName: currentWarungName,
                venueName: orderData.venueName || "",
                customerName: orderData.customerName || "Pelanggan Web",
                tableNum: orderData.tableNum ? [orderData.tableNum] : [],
                tablesNeeded: 0,
                pax: orderData.items ? orderData.items.length : 0,
                bookingCode: "WEB-ORDER",
                bookingDate: todayStr,
                status: "finished",
                revenue: jumlah,
                onlineRevenue: jumlah,
                finishedAt: new Date(),
                timestamp: new Date(),
                sourceOrderId: orderId,
                metodeBayar: orderData.metodeBayar || "cod"
            });
        }

        alert("Pembayaran Berhasil! Data telah diarsipkan ke laporan.");
    } catch (e) {
        alert("Eror saat memproses pembayaran: " + e.message);
    }
};

// FIX: Fungsi edit jumlah total meja (dipanggil dari ikon pensil di kartu "Total Meja").
// Sebelumnya tombol ini tidak berfungsi karena fungsinya belum dibuat.
window.editTableCount = async function() {
    const current = warungTotalCapacity || 15;
    const input = prompt("Masukkan jumlah total meja warung Anda:", current);

    if (input === null) return; // user tekan Cancel

    const newCount = parseInt(input, 10);
    if (isNaN(newCount) || newCount <= 0) {
        alert("Jumlah meja tidak valid. Masukkan angka lebih dari 0.");
        return;
    }

    try {
        await updateDoc(doc(db, "warungs", WARUNG_ID), { totalTables: newCount });
        warungTotalCapacity = newCount;
        alert(`Jumlah meja berhasil diperbarui menjadi ${newCount}.`);
        // Refresh tampilan sisa meja tanpa perlu reload halaman
        setupBookingListener();
    } catch (e) {
        alert("Gagal menyimpan perubahan: " + e.message);
    }
};

// Cek pergantian hari setiap menit, reload jika tanggal berganti
setInterval(() => {
    const todayWIB = getTodayWIB();
    const dateInput = document.getElementById('filter-date-booking');
    if(dateInput && dateInput.value && dateInput.value !== todayWIB) {
        location.reload();
    }
}, 60000);
