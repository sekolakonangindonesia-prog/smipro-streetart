/* =========================================
   1. DATABASE SIMULASI (DATA DUMMY)
   ========================================= */

// Data 5 Lokasi untuk Dashboard Utama
const dashboardVenues = [
    { id: 1, name: "Stadion Bayuangga Zone", active: true, desc: "Pusat Aktivitas Utama" },
    { id: 2, name: "Alun-Alun Kota", active: false, desc: "Segera Hadir" },
    { id: 3, name: "Benteng Mayangan", active: false, desc: "Segera Hadir" },
    { id: 4, name: "Museum Probolinggo", active: false, desc: "Segera Hadir" },
    { id: 5, name: "BJBR Mangrove", active: false, desc: "Segera Hadir" }
];

// Data Warung (Hanya muncul saat Stadion diklik)
// 'total': Total meja, 'booked': Meja terisi
let warungData = [
    { id: 101, name: "Warung Bu Sri", img: "https://images.unsplash.com/photo-1541544744-5e3a01998cd1?q=80&w=200", total: 15, booked: 5, bookings: [] },
    { id: 102, name: "Kopi Pakde Jono", img: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=200", total: 10, booked: 2, bookings: [] },
    { id: 103, name: "Angkringan Mas Boy", img: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=200", total: 20, booked: 18, bookings: [] },
    { id: 104, name: "Sate Taichan Pro", img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=200", total: 12, booked: 12, bookings: [] }, // Penuh
    { id: 105, name: "Ropang Gaul", img: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=200", total: 12, booked: 0, bookings: [] },
    { id: 106, name: "Bakso Cak Man", img: "https://images.unsplash.com/photo-1529042410759-befb1204b468?q=80&w=200", total: 15, booked: 4, bookings: [] }
];

// Data Top 5 Performer
const topPerf = [
    { name: "Rina Violin", img: "https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=150" },
    { name: "The Acoustic", img: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=150" },
    { name: "Rock Ballad", img: "https://images.unsplash.com/photo-1526218626217-dc65b9d6e630?q=80&w=150" },
    { name: "Siti Keroncong", img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150" },
    { name: "Solo Hudi", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150" }
];

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
   3. LOGIKA DASHBOARD (HOME)
   ========================================= */

function renderDashboard() {
    // A. Render 5 Lokasi Angkringan
    const vList = document.getElementById('venues-list');
    vList.innerHTML = ''; // Bersihkan dulu

    dashboardVenues.forEach(v => {
        // Tentukan style berdasarkan aktif/tidak
        let statusHtml = v.active ? `<span class="badge active">BUKA</span>` : `<span class="badge soon">SEGERA HADIR</span>`;
        let disabledClass = v.active ? '' : 'disabled';
        let icon = v.active ? 'fa-door-open' : 'fa-lock';
        
        // Tentukan aksi klik
        let clickAction = v.active ? 
            `onclick="openVenueDetail()"` : 
            `onclick="alert('Mohon maaf, lokasi ini Segera Hadir / Belum Dibuka!')"`;

        vList.innerHTML += `
        <div class="venue-card ${disabledClass}" ${clickAction}>
            <div style="font-size:1.5rem; color:${v.active ? 'var(--primary)' : '#555'}">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div style="flex:1;">
                <h3 style="margin:0; font-size:1rem;">${v.name} ${statusHtml}</h3>
                <p style="margin:0; font-size:0.8rem; color:#888;">${v.desc}</p>
            </div>
            <i class="fa-solid fa-chevron-right" style="color:#444;"></i>
        </div>`;
    });

    // B. Render Top 5 Performers
    const pList = document.getElementById('top-performers-list');
    pList.innerHTML = '';
    
    topPerf.forEach(p => {
        pList.innerHTML += `
        <div class="artist-card-ss1">
            <img src="${p.img}" class="artist-img-ss1">
            <h4>${p.name}</h4>
        </div>`;
    });
}

/* =========================================
   4. LOGIKA HALAMAN DETAIL (VENUES)
   ========================================= */

// Dipanggil saat Angkringan Utama diklik
function openVenueDetail() {
    showPage('detail');
    renderWarungs(); // Render grid warung
}

// Render Grid Warung dan Status Meja
function renderWarungs() {
    const grid = document.getElementById('warung-grid');
    grid.innerHTML = ''; // Reset isi grid
    
    warungData.forEach(w => {
        const sisa = w.total - w.booked;
        const isFull = sisa <= 0;
        
        // Tentukan tombol booking
        let btnHtml = isFull ? 
            `<button class="btn-book" disabled style="background:#555; cursor:not-allowed;">Penuh</button>` : 
            `<button class="btn-book" onclick="openBooking(${w.id})">Booking</button>`;
            
        let statusClass = isFull ? 'full' : '';

        grid.innerHTML += `
        <div class="warung-card">
            <img src="${w.img}" class="warung-img">
            <div style="padding:10px;">
                <span style="font-weight:bold; display:block; font-size:0.9rem;">${w.name}</span>
                <span class="table-status ${statusClass}" style="font-size:0.75rem; color:#aaa; display:block; margin:5px 0;">
                    <b>${isFull ? 0 : sisa}</b> / ${w.total} Meja
                </span>
                ${btnHtml}
            </div>
        </div>`;
    });
}

/* =========================================
   5. SISTEM BOOKING
   ========================================= */

let selectedWarung = null; // Menyimpan warung yang sedang dipilih

// Buka Modal Booking
function openBooking(id) {
    selectedWarung = warungData.find(w => w.id === id);
    if(selectedWarung) {
        document.getElementById('modal-warung-name').innerText = selectedWarung.name;
        document.getElementById('booking-modal').style.display = 'flex';
    }
}

// Tutup Modal (Apapun)
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
    
    // Reset form booking jika modal booking ditutup
    if(id === 'booking-modal') {
        document.getElementById('book-name').value = '';
        document.getElementById('book-qty').value = '1';
    }
}

// Proses Konfirmasi Booking
function confirmBooking() {
    const name = document.getElementById('book-name').value;
    const qty = parseInt(document.getElementById('book-qty').value);
    
    if(!name || !qty) return alert("Harap isi Nama dan Jumlah Meja!");
    if(qty < 1) return alert("Minimal 1 meja!");

    // Cek ketersediaan lagi (takutnya keduluan)
    if(selectedWarung.booked + qty > selectedWarung.total) {
        return alert("Maaf, meja tidak cukup untuk jumlah tersebut!");
    }

    // Update Data
    selectedWarung.booked += qty;
    selectedWarung.bookings.push({ 
        name: name, 
        qty: qty, 
        time: new Date().toLocaleTimeString() 
    });
    
    // Feedback User
    alert(`Berhasil Booking ${qty} Meja di ${selectedWarung.name} atas nama ${name}`);
    closeModal('booking-modal');
    renderWarungs(); // Refresh tampilan grid agar stok berkurang
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
