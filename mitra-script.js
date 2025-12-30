/* ========================
   DATA SIMULASI DATABASE
   ======================== */
let storeData = {
    isOpen: true,
    totalTables: 15,
    name: "Warung Bu Sri",
    phone: "08123456789",
    bookings: [
        { id: 1, table: "S-01", customer: "Budi Santoso", time: "19.00", status: "waiting" },
        { id: 2, table: "S-05", customer: "Siti Aminah", time: "18.30", status: "active" }
    ],
    menus: [
        { id: 101, name: "Nasi Kucing", price: 3000, desc: "Nasi porsi kecil sambal teri", img: "https://via.placeholder.com/60" },
        { id: 102, name: "Sate Usus", price: 2000, desc: "Sate usus bumbu bacem", img: "https://via.placeholder.com/60" }
    ]
};

/* ========================
   1. LOGIKA TAB NAVIGASI
   ======================== */
function switchTab(tabId) {
    // Sembunyikan semua tab content
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Matikan semua tombol aktif
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // Aktifkan yang dipilih
    document.getElementById('tab-' + tabId).classList.add('active');
    // Cari tombol yang diklik (menggunakan event)
    event.currentTarget.classList.add('active');
}

/* ========================
   2. LOGIKA BERANDA (MEJA)
   ======================== */
function toggleStoreStatus() {
    storeData.isOpen = !storeData.isOpen;
    const btn = document.getElementById('store-status-btn');
    const txt = document.getElementById('store-status-text');
    if (storeData.isOpen) {
        btn.className = "shop-switch open"; txt.innerText = "BUKA";
    } else {
        btn.className = "shop-switch closed"; txt.innerText = "TUTUP";
    }
}

function editTableCount() {
    let newCount = prompt("Masukkan jumlah total meja baru:", storeData.totalTables);
    if (newCount !== null) {
        newCount = parseInt(newCount);
        if (newCount > 0 && newCount <= 15) {
            storeData.totalTables = newCount;
            document.getElementById('total-table-count').innerText = newCount;
            alert("Jumlah meja diupdate!");
        } else if (newCount > 15) {
            alert("⚠️ Jumlah > 15 butuh verifikasi Admin.");
        }
    }
}

function renderBookings() {
    const container = document.getElementById('booking-container');
    container.innerHTML = '';
    let occupied = 0;

    storeData.bookings.forEach((b, index) => {
        occupied++;
        let cardHtml = '';
        if (b.status === 'waiting') {
            cardHtml = `
            <div class="card-booking waiting">
                <span class="table-badge">MEJA ${b.table}</span>
                <div style="font-weight:bold;">${b.customer}</div>
                <div style="font-size:0.9rem; color:#ccc;">${b.time} WIB</div>
                <div class="waiting-text"><i class="fa-solid fa-spinner fa-spin"></i> Menunggu Scan QR...</div>
            </div>`;
        } else {
            cardHtml = `
            <div class="card-booking active">
                <span class="table-badge">MEJA ${b.table}</span>
                <div style="font-weight:bold;">${b.customer}</div>
                <div class="active-text">Sedang Makan</div>
                <button class="btn-primary" style="margin-top:10px; background:white; color:red;" onclick="finishBooking(${index})">Selesai</button>
            </div>`;
        }
        container.innerHTML += cardHtml;
    });

    document.getElementById('occupied-count').innerText = occupied;
    if (occupied === 0) container.innerHTML = '<p style="text-align:center; color:#555;">Belum ada booking.</p>';
}

function finishBooking(index) {
    if (confirm("Kosongkan meja ini?")) {
        storeData.bookings.splice(index, 1);
        renderBookings();
    }
}

/* ========================
   3. LOGIKA KELOLA MENU
   ======================== */
function renderMenus() {
    const container = document.getElementById('menu-list-container');
    container.innerHTML = '';
    storeData.menus.forEach((m, index) => {
        container.innerHTML += `
        <div class="menu-item">
            <img src="${m.img}" class="menu-thumb">
            <div style="flex:1;">
                <h4 style="margin:0;">${m.name}</h4>
                <div style="color:var(--accent); font-weight:bold;">Rp ${m.price}</div>
                <small style="color:#aaa;">${m.desc}</small>
            </div>
            <button class="btn-delete" onclick="deleteMenu(${index})"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });
}

function deleteMenu(index) {
    if(confirm("Hapus menu ini?")) {
        storeData.menus.splice(index, 1);
        renderMenus();
    }
}

function openModalMenu() { document.getElementById('modal-menu').style.display = 'flex'; }
function closeModalMenu() { document.getElementById('modal-menu').style.display = 'none'; }

function addMenu() {
    const name = document.getElementById('new-menu-name').value;
    const price = document.getElementById('new-menu-price').value;
    const desc = document.getElementById('new-menu-desc').value;

    if(!name || !price) return alert("Isi nama dan harga!");

    storeData.menus.push({
        id: Date.now(),
        name: name,
        price: price,
        desc: desc,
        img: "https://via.placeholder.com/60" // Placeholder
    });

    alert("Menu ditambahkan!");
    closeModalMenu();
    renderMenus();
    
    // Reset Form
    document.getElementById('new-menu-name').value = '';
    document.getElementById('new-menu-price').value = '';
    document.getElementById('new-menu-desc').value = '';
}

/* ========================
   4. LOGIKA PROFIL
   ======================== */
function saveProfile() {
    const newName = document.getElementById('edit-name').value;
    storeData.name = newName;
    document.getElementById('shop-name-display').innerText = newName;
    alert("Profil Warung Berhasil Disimpan!");
}

/* ========================
   INIT LOAD
   ======================== */
renderBookings();
renderMenus();
