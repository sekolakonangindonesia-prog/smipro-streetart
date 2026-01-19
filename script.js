import { db } from './firebase-config.js';
import { 
    collection, getDocs, getDoc, onSnapshot, addDoc, updateDoc, doc, query, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


/* =========================================
   2. SISTEM NAVIGASI HALAMAN
   ========================================= */

// Fungsi untuk pindah halaman (SPA - Single Page Application)
function showPage(pageId) {
    // Sembunyikan semua halaman
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // Tampilkan halaman tujuan
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.add('active');
        window.scrollTo(0, 0); // Scroll ke paling atas
    }

    // Khusus jika membuka halaman admin-login, siapkan dropdown
    if (pageId === 'admin-login') {
        prepareAdminLogin();
    }
}

/* =========================================
   3. LOGIKA DASHBOARD (HOME) - VERSI FIREBASE
   ========================================= */

async function renderDashboard() {
    // A. Render Lokasi (Venues) dari Firebase
    const vList = document.getElementById('venues-list');
    
    // Cek dulu apakah elemennya ada di HTML agar tidak error
    if (vList) {
        vList.innerHTML = '<p style="text-align:center;">Memuat lokasi...</p>'; // Loading state
        
        try {
            // Ambil data dari koleksi 'venues'
            const q = query(collection(db, "venues")); 
            const snapshot = await getDocs(q);
            
            vList.innerHTML = ''; // Bersihkan loading

            if(snapshot.empty) {
                vList.innerHTML = '<p>Belum ada data lokasi.</p>';
            }

            snapshot.forEach(docSnap => {
                const v = docSnap.data();
                const isOpen = v.status === 'open'; // Cek status open/closed
                
                // Style berdasarkan status
                let statusHtml = isOpen ? `<span class="badge active">BUKA</span>` : `<span class="badge soon">TUTUP</span>`;
                let disabledClass = isOpen ? '' : 'disabled';
                let icon = isOpen ? 'fa-door-open' : 'fa-lock';
                
                // Aksi Klik: Kalau BUKA jalankan fungsi detail, Kalau TUTUP muncul alert
                let clickAction = isOpen ? 
                    `onclick="openVenueDetail('${docSnap.id}')"` : 
                    `onclick="alert('Mohon maaf, lokasi ini sedang Tutup!')"`;

                vList.innerHTML += `
                <div class="venue-card ${disabledClass}" ${clickAction} style="cursor:pointer;">
                    <div style="font-size:1.5rem; color:${isOpen ? 'var(--primary)' : '#555'}">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div style="flex:1;">
                        <h3 style="margin:0; font-size:1rem;">${v.name} ${statusHtml}</h3>
                        <p style="margin:0; font-size:0.8rem; color:#888;">${v.desc || ''}</p>
                    </div>
                    <i class="fa-solid fa-chevron-right" style="color:#444;"></i>
                </div>`;
            });
        } catch (e) {
            console.error("Gagal memuat venues:", e);
        }
    }

    // B. Render Top Performers dari Firebase
    const pList = document.getElementById('top-performers-list');
    if (pList) {
        try {
            // Ambil data dari koleksi 'performers'
            const qPerf = query(collection(db, "performers"));
            const snapPerf = await getDocs(qPerf);
            
            pList.innerHTML = '';

            snapPerf.forEach(docSnap => {
                const p = docSnap.data();
                pList.innerHTML += `
                <div class="artist-card-ss1">
                    <img src="${p.img || 'https://via.placeholder.com/150'}" class="artist-img-ss1">
                    <h4>${p.name}</h4>
                </div>`;
            });
        } catch (e) {
            console.error("Gagal memuat performer:", e);
        }
    }
}

/* =========================================
   4. LOGIKA HALAMAN DETAIL (VENUES) - VERSI FIREBASE
   ========================================= */

let currentVenueId = null; // Variabel penyimpan ID Venue yang sedang dibuka

// Dipanggil saat Venue di Dashboard diklik
window.openVenueDetail = function(id) {
    currentVenueId = id; // Simpan ID biar sistem tahu kita di venue mana
    showPage('detail');  // Pindah halaman ke detail
    renderWarungs();     // Panggil fungsi muat data
}

// Render Grid Warung dan Status Meja (Realtime)
function renderWarungs() {
    const grid = document.getElementById('warung-grid');
    if(!grid) return;

    grid.innerHTML = '<p style="text-align:center; color:#ccc; width:100%;">Memuat daftar warung...</p>';

    // Ambil data warung secara Realtime (onSnapshot)
    // Jadi kalau admin update meja, di sini langsung berubah tanpa refresh
    onSnapshot(collection(db, "warungs"), (snapshot) => {
        grid.innerHTML = ''; // Bersihkan dulu
        
        if(snapshot.empty) {
            grid.innerHTML = '<p style="text-align:center; color:#ccc; width:100%;">Belum ada warung di lokasi ini.</p>';
            return;
        }

        snapshot.forEach(docSnap => {
            const w = docSnap.data();
            const wId = docSnap.id; // ID Dokumen Firebase
            
            // Ambil data meja dari database
            // (Pastikan di database nanti ada field 'totalTables'. Jika 'booked' belum ada, anggap 0)
            const total = parseInt(w.totalTables) || 0;
            const booked = parseInt(w.bookedTables) || 0;
            
            const sisa = total - booked;
            const isFull = sisa <= 0;
            
            // Atur Tombol: Kalau penuh dimatikan, kalau ada sisa bisa diklik
            let btnHtml = isFull ? 
                `<button class="btn-book" disabled style="background:#555; cursor:not-allowed;">Penuh</button>` : 
                `<button class="btn-book" onclick="openBooking('${wId}')">Booking</button>`;
                
            let statusClass = isFull ? 'full' : '';
            let imgUrl = w.img || "https://via.placeholder.com/200"; // Gambar default jika kosong

            // Render HTML Kartu Warung
            grid.innerHTML += `
            <div class="warung-card">
                <img src="${imgUrl}" class="warung-img">
                <div style="padding:10px;">
                    <span style="font-weight:bold; display:block; font-size:0.9rem;">${w.name}</span>
                    <span class="table-status ${statusClass}" style="font-size:0.75rem; color:#aaa; display:block; margin:5px 0;">
                        <b>${isFull ? 0 : sisa}</b> / ${total} Meja
                    </span>
                    ${btnHtml}
                </div>
            </div>`;
        });
    });
}

/* =========================================
   5. SISTEM BOOKING (TRANSAKSI FIREBASE)
   ========================================= */

let selectedWarungId = null; // Menyimpan ID warung yang akan dibooking

// 1. Buka Modal Booking
window.openBooking = async function(id) {
    selectedWarungId = id; // Simpan ID
    
    // Ambil Nama Warung dulu dari database biar judul modalnya benar
    const docRef = doc(db, "warungs", id);
    const docSnap = await getDocs(query(collection(db, "warungs"), where(document.id, "==", id))); 
    // *Catatan: Cara di atas agak ribet, kita pakai cara getDoc biasa:
    
    // Kita reset dulu formnya
    document.getElementById('book-name').value = '';
    document.getElementById('book-qty').value = '1';
    document.getElementById('modal-warung-name').innerText = "Memuat...";
    document.getElementById('booking-modal').style.display = 'flex';

    // Ambil detail nama warung
    const snap = await getDoc(doc(db, "warungs", id));
    if(snap.exists()) {
        document.getElementById('modal-warung-name').innerText = snap.data().name;
    }
}

// 2. Tutup Modal (Apapun)
window.closeModal = function(id) {
    document.getElementById(id).style.display = 'none';
}

// 3. Proses Konfirmasi Booking (KIRIM KE FIREBASE)
window.confirmBooking = async function() {
    const name = document.getElementById('book-name').value;
    const qty = parseInt(document.getElementById('book-qty').value);
    
    if(!name || !qty || qty < 1) return alert("Data booking tidak valid!");
    if(!selectedWarungId) return alert("Warung tidak terdeteksi!");

    const btn = document.querySelector('.btn-submit');
    btn.innerHTML = "Memproses...";
    btn.disabled = true;

    try {
        // A. Cek Ketersediaan Meja Dulu
        const warungRef = doc(db, "warungs", selectedWarungId);
        const warungSnap = await getDoc(warungRef); // Perlu import getDoc di atas nanti

        if (!warungSnap.exists()) throw new Error("Warung tidak ditemukan");

        const wData = warungSnap.data();
        const currentBooked = parseInt(wData.bookedTables) || 0;
        const maxTables = parseInt(wData.totalTables) || 0;

        if (currentBooked + qty > maxTables) {
            alert("Maaf! Meja tidak cukup. Sisa meja: " + (maxTables - currentBooked));
            btn.innerHTML = "Booking Sekarang";
            btn.disabled = false;
            return;
        }

        // B. Simpan Data Pesanan ke Koleksi 'bookings'
        await addDoc(collection(db, "bookings"), {
            warungId: selectedWarungId,
            warungName: wData.name,
            customerName: name,
            qty: qty,
            status: 'active', // Tamu sedang berkunjung
            timestamp: new Date()
        });

        // C. Update Jumlah Meja Terpakai di Dokumen Warung
        await updateDoc(warungRef, {
            bookedTables: currentBooked + qty
        });

        alert(`Berhasil! ${qty} meja dipesan atas nama ${name}.`);
        closeModal('booking-modal');

    } catch (e) {
        console.error("Booking Error:", e);
        alert("Gagal booking: " + e.message);
    } finally {
        btn.innerHTML = "Booking Sekarang";
        btn.disabled = false;
    }
}


/* =========================================
   6. SISTEM ADMIN (MITRA WARUNG)
   ========================================= */

// Isi dropdown warung di halaman login admin
function prepareAdminLogin() {
    const sel = document.getElementById('admin-select');
    sel.innerHTML = '<option value="">-- Pilih Warung Anda --</option>';
    warungData.forEach(w => {
        sel.innerHTML += `<option value="${w.id}">${w.name}</option>`;
    });
}

// Proses Login Admin
function adminLogin() {
    const id = parseInt(document.getElementById('admin-select').value);
    if(!id) return alert("Silakan pilih warung terlebih dahulu!");
    
    const w = warungData.find(item => item.id === id);
    if(w) {
        renderAdminDashboard(w);
        showPage('admin-dashboard');
    }
}

// Logout Admin
function adminLogout() {
    showPage('home');
}

// Render Dashboard Admin
function renderAdminDashboard(w) {
    document.getElementById('admin-title-text').innerText = `Admin: ${w.name}`;
    document.getElementById('stat-empty').innerText = w.total - w.booked;
    document.getElementById('stat-booked').innerText = w.booked;
    
    const list = document.getElementById('booking-list-admin');
    list.innerHTML = ''; // Bersihkan list

    if(w.bookings.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#666; padding:20px;">Belum ada tamu booking saat ini.</p>';
    } else {
        w.bookings.forEach((b, idx) => {
            list.innerHTML += `
            <div class="admin-book-item" style="background:#222; padding:10px; margin-bottom:10px; border-left:4px solid var(--accent); display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <b>${b.name}</b>
                    <br><small style="color:#aaa;">${b.qty} Meja • Pukul ${b.time}</small>
                </div>
                <button class="btn-small" style="background:#444; border:1px solid #666; color:white; cursor:pointer;" onclick="releaseTable(${w.id}, ${idx})">Selesai</button>
            </div>`;
        });
    }
}

// Kosongkan Meja (Tamu Pulang)
function releaseTable(warungId, bookingIndex) {
    if(!confirm("Apakah tamu sudah pulang? Meja akan dikosongkan.")) return;

    const w = warungData.find(item => item.id === warungId);
    if(w) {
        // Kembalikan jumlah meja
        w.booked -= w.bookings[bookingIndex].qty;
        // Hapus dari daftar booking
        w.bookings.splice(bookingIndex, 1);
        
        alert("Meja berhasil dikosongkan!");
        renderAdminDashboard(w); // Refresh tampilan admin
    }
}

/* =========================================
   7. FITUR LAIN (RATING, MODAL, DLL)
   ========================================= */

// Buka Modal Pelatihan
function openTrainingModal() {
    document.getElementById('training-modal').style.display = 'block';
}

// Logika Bintang Rating
function rateVenue(n) {
    const stars = document.querySelectorAll('#venue-stars i');
    stars.forEach((s, i) => {
        if(i < n) s.classList.add('gold');
        else s.classList.remove('gold');
    });
}

// Submit Kritik Saran
function submitVenueFeedback() {
    const text = document.getElementById('venue-feedback').value;
    if(!text) return alert("Mohon tulis kritik & saran!");
    
    alert("Terima kasih! Masukan Anda telah kami terima.");
    document.getElementById('venue-feedback').value = ''; // Kosongkan input
    rateVenue(0); // Reset bintang
}

/* =========================================
   8. INISIALISASI SAAT LOAD
   ========================================= */

// Jalankan saat web pertama dibuka
window.onload = function() {
    renderDashboard();
};

function openScheduleModal() {
    document.getElementById('schedule-modal').style.display = 'flex';
}
// Fungsi closeModal sudah ada di script sebelumnya, tidak perlu double.
