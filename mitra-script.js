// --- DATA SIMULASI ---
let storeData = {
    isOpen: true,
    totalTables: 15,
    bookings: [
        // Status: 'waiting' (Kuning, Belum Scan) | 'active' (Merah, Sudah Scan)
        { id: 1, table: "S-01", customer: "Budi Santoso", time: "19.00", status: "waiting" },
        { id: 2, table: "S-05", customer: "Siti Aminah", time: "18.30", status: "active" } // Sudah datang
    ]
};

// --- 1. TOGGLE BUKA / TUTUP ---
function toggleStoreStatus() {
    storeData.isOpen = !storeData.isOpen;
    const btn = document.getElementById('store-status-btn');
    const txt = document.getElementById('store-status-text');

    if (storeData.isOpen) {
        btn.classList.remove('closed');
        btn.classList.add('open');
        txt.innerText = "BUKA";
    } else {
        btn.classList.remove('open');
        btn.classList.add('closed');
        txt.innerText = "TUTUP";
    }
}

// --- 2. EDIT JUMLAH MEJA ---
function editTableCount() {
    // Tanya jumlah baru
    let newCount = prompt("Masukkan jumlah total meja baru:", storeData.totalTables);
    
    if (newCount !== null) {
        newCount = parseInt(newCount);
        
        // Cek Logika Threshold
        if (newCount > 0 && newCount <= 15) {
            // Jika <= 15: Langsung Update (Hijau)
            storeData.totalTables = newCount;
            document.getElementById('total-table-count').innerText = newCount;
            alert("Jumlah meja berhasil diperbarui!");
        } else if (newCount > 15) {
            // Jika > 15: Minta Verifikasi (Kuning/Pending)
            alert("⚠️ Permintaan meja di atas 15 butuh verifikasi Admin. Tim kami akan menghubungi Anda untuk survey lokasi.");
        } else {
            alert("Angka tidak valid!");
        }
    }
}

// --- 3. RENDER KARTU BOOKING ---
function renderBookings() {
    const container = document.getElementById('booking-container');
    container.innerHTML = '';
    
    let occupied = 0;

    storeData.bookings.forEach((b, index) => {
        // Hitung meja yang statusnya aktif (merah) atau waiting (kuning) sebagai terisi
        occupied++; 

        let cardHtml = '';

        if (b.status === 'waiting') {
            // KONDISI A: MENUNGGU SCAN (KUNING) - Tanpa Tombol
            cardHtml = `
            <div class="card-booking waiting">
                <span class="table-badge">MEJA ${b.table}</span>
                <div style="font-size:1.1rem; font-weight:bold;">${b.customer}</div>
                <div style="font-size:0.9rem; color:#ccc;">Jadwal: ${b.time} WIB</div>
                
                <div class="waiting-text">
                    <i class="fa-solid fa-spinner fa-spin"></i> Menunggu Scan QR Tamu...<br>
                    (Hangus otomatis jam 20.30)
                </div>
            </div>`;
        } else if (b.status === 'active') {
            // KONDISI B: SUDAH DATANG (MERAH) - Ada Tombol Selesai
            cardHtml = `
            <div class="card-booking active">
                <span class="table-badge">MEJA ${b.table}</span>
                <div style="font-size:1.1rem; font-weight:bold;">${b.customer}</div>
                <div class="active-text">
                    <i class="fa-solid fa-circle-check"></i> Tamu Sedang Makan
                </div>
                
                <button class="btn-primary" style="margin-top:15px; background:white; color:red;" onclick="finishBooking(${index})">
                    Selesai / Kosongkan Meja
                </button>
            </div>`;
        }

        container.innerHTML += cardHtml;
    });

    // Update Statistik Angka di atas
    document.getElementById('occupied-count').innerText = occupied;

    // Jika kosong
    if (occupied === 0) {
        container.innerHTML = '<p style="text-align:center; color:#555; grid-column:1/-1;">Belum ada booking aktif saat ini.</p>';
    }
}

// --- 4. SELESAI / KOSONGKAN MEJA ---
function finishBooking(index) {
    if (confirm("Apakah tamu sudah pulang dan meja sudah bersih?")) {
        // Hapus dari data (Simulasi Database)
        storeData.bookings.splice(index, 1);
        renderBookings(); // Render ulang agar kartu hilang
        alert("Meja berhasil dikosongkan dan siap dipesan kembali.");
    }
}

// Jalankan fungsi saat halaman dibuka
renderBookings();
