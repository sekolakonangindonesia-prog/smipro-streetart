<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Mitra - SMIPRO</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
    <style>
        /* CSS KHUSUS DASHBOARD MITRA */
        .dash-header { background: #1a0000; padding: 20px; border-bottom: 2px solid var(--primary); display: flex; justify-content: space-between; align-items: center; }
        .warung-status { font-size: 0.8rem; background: #00ff00; color: black; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
        
        .mitra-nav { display: flex; background: #111; overflow-x: auto; padding: 10px; border-bottom: 1px solid #333; }
        .mn-item { padding: 8px 15px; color: #888; cursor: pointer; white-space: nowrap; }
        .mn-item.active { color: white; border-bottom: 2px solid var(--accent); font-weight: bold; }

        .dashboard-section { display: none; padding: 20px; animation: fadeIn 0.3s; }
        .dashboard-section.active { display: block; }

        /* Card Menu */
        .menu-list-item { display: flex; gap: 15px; background: #222; padding: 10px; border-radius: 10px; margin-bottom: 10px; align-items: center; }
        .menu-img { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; background: #444; }
        
        /* Stats */
        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .stat-box { background: #222; padding: 15px; border-radius: 10px; text-align: center; border: 1px solid #333; }
        .stat-box h2 { margin: 0; color: var(--primary); font-size: 2rem; }

        /* Notifikasi Pending */
        .pending-alert { background: #332b00; color: #ffeb3b; padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #ffeb3b; display: flex; align-items: center; gap: 10px; font-size: 0.9rem; display: none; }
    </style>
</head>
<body>

    <!-- HEADER DASHBOARD -->
    <div class="dash-header">
        <div>
            <h3 style="margin:0;">Warung Bu Sri</h3>
            <span class="warung-status">BUKA • ONLINE</span>
        </div>
        <button onclick="location.href='index.html'" class="btn-small" style="background:#333;">Logout</button>
    </div>

    <!-- MENU NAVIGASI -->
    <div class="mitra-nav">
        <div class="mn-item active" onclick="switchTab('home')">🏠 Beranda & Meja</div>
        <div class="mn-item" onclick="switchTab('menu')">🍔 Kelola Menu</div>
        <div class="mn-item" onclick="switchTab('profile')">⚙️ Profil Warung</div>
    </div>

    <!-- TAB 1: BERANDA & MEJA -->
    <div id="tab-home" class="dashboard-section active">
        <!-- Notifikasi Pengajuan Meja -->
        <div id="pending-msg" class="pending-alert">
            <i class="fa-solid fa-clock"></i> 
            <span>Pengajuan tambah <b>5 Meja</b> sedang diverifikasi Admin.</span>
        </div>

        <div class="stat-grid">
            <div class="stat-box">
                <h2 id="total-tables">15</h2>
                <small>Total Meja Aktif</small>
            </div>
            <div class="stat-box">
                <h2 id="filled-tables" style="color:white;">5</h2>
                <small>Meja Terisi</small>
            </div>
        </div>

        <!-- Tombol Request Meja -->
        <div style="background:#222; padding:15px; border-radius:10px; margin-bottom:20px;">
            <h4 style="margin:0 0 10px 0;">Manajemen Kapasitas</h4>
            <p style="font-size:0.8rem; color:#aaa;">Ingin menambah kapasitas meja? Tim kami akan survey lokasi Anda.</p>
            <button class="btn-primary" onclick="openModal('modal-add-table')"><i class="fa-solid fa-plus"></i> Request Tambah Meja</button>
        </div>

        <h4>Booking Aktif (Hari Ini)</h4>
        <div id="booking-list">
            <!-- Diisi JS -->
            <p style="text-align:center; color:#555; margin-top:20px;">Belum ada booking baru.</p>
        </div>
    </div>

    <!-- TAB 2: KELOLA MENU (Tanpa Verifikasi) -->
    <div id="tab-menu" class="dashboard-section">
        <button class="btn-primary" onclick="openModal('modal-add-menu')" style="margin-bottom:20px;">
            <i class="fa-solid fa-plus"></i> Tambah Menu Baru
        </button>

        <div id="menu-container">
            <!-- List Menu akan muncul disini -->
        </div>
    </div>

    <!-- TAB 3: PROFIL -->
    <div id="tab-profile" class="dashboard-section">
        <h3>Profil Warung</h3>
        <p>Edit Nama, Foto Warung, dan Jam Buka.</p>
        <button class="btn-small" onclick="alert('Fitur Edit Profil')">Edit Profil</button>
    </div>

    <!-- MODAL 1: REQUEST MEJA (VERIFIKASI) -->
    <div id="modal-add-table" class="modal-overlay">
        <div class="modal-box">
            <h3>Ajukan Penambahan Meja</h3>
            <p style="color:#aaa; font-size:0.9rem;">Penambahan butuh verifikasi admin (1x24 Jam).</p>
            <input type="number" id="req-table-qty" class="input-request" placeholder="Jumlah meja tambahan">
            <div style="display:flex; gap:10px;">
                <button class="btn-small" style="background:#444;" onclick="closeModal('modal-add-table')">Batal</button>
                <button class="btn-small" style="background:var(--primary);" onclick="submitTableRequest()">Ajukan</button>
            </div>
        </div>
    </div>

    <!-- MODAL 2: TAMBAH MENU (LANGSUNG) -->
    <div id="modal-add-menu" class="modal-overlay">
        <div class="modal-box">
            <h3>Tambah Menu Baru</h3>
            <input type="text" id="menu-name" class="input-request" placeholder="Nama Makanan/Minuman">
            <input type="number" id="menu-price" class="input-request" placeholder="Harga (Rp)">
            <textarea id="menu-desc" class="input-request" placeholder="Deskripsi singkat..." style="height:60px;"></textarea>
            <!-- Simulasi Upload Foto -->
            <div style="background:#222; padding:10px; border:1px dashed #555; text-align:center; margin-bottom:15px; border-radius:5px; cursor:pointer;" onclick="alert('Pilih Foto dari Galeri HP')">
                <i class="fa-solid fa-camera"></i> Upload Foto
            </div>
            
            <div style="display:flex; gap:10px;">
                <button class="btn-small" style="background:#444;" onclick="closeModal('modal-add-menu')">Batal</button>
                <button class="btn-small" style="background:var(--primary);" onclick="saveMenu()">Simpan & Tampilkan</button>
            </div>
        </div>
    </div>

    <script src="mitra-script.js"></script>
</body>
</html>
