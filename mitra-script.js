// --- DATA MENU AWAL (SIMULASI) ---
let menus = [
    { id: 1, name: "Nasi Kucing", price: 3000, desc: "Nasi bungkus porsi kecil + sambal teri.", img: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=100" },
    { id: 2, name: "Sate Usus", price: 2000, desc: "Sate usus ayam bumbu bacem bakar.", img: "https://images.unsplash.com/photo-1529563021427-d8f8e08d4224?q=80&w=100" }
];

// --- FUNGSI TAB ---
function switchTab(tabName) {
    // Hide all
    document.querySelectorAll('.dashboard-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.mn-item').forEach(el => el.classList.remove('active'));
    
    // Show active
    document.getElementById('tab-' + tabName).classList.add('active');
    
    // Update nav style (simple logic)
    const navs = document.querySelectorAll('.mn-item');
    if(tabName == 'home') navs[0].classList.add('active');
    if(tabName == 'menu') navs[1].classList.add('active');
    if(tabName == 'profile') navs[2].classList.add('active');
}

// --- FUNGSI RENDER MENU ---
function renderMenus() {
    const container = document.getElementById('menu-container');
    container.innerHTML = '';
    
    menus.forEach(m => {
        container.innerHTML += `
        <div class="menu-list-item">
            <img src="${m.img}" class="menu-img">
            <div style="flex:1;">
                <h4 style="margin:0;">${m.name}</h4>
                <p style="margin:0; font-size:0.8rem; color:#aaa;">${m.desc}</p>
                <b style="color:var(--accent);">Rp ${m.price.toLocaleString()}</b>
            </div>
            <button class="btn-small" style="background:#444;" onclick="deleteMenu(${m.id})"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });
}

// --- FUNGSI TAMBAH MENU (LANGSUNG TAMPIL) ---
function saveMenu() {
    const name = document.getElementById('menu-name').value;
    const price = document.getElementById('menu-price').value;
    const desc = document.getElementById('menu-desc').value;

    if(!name || !price) return alert("Nama dan Harga wajib diisi!");

    // Tambah ke Array (Simulasi Database)
    menus.push({
        id: Date.now(),
        name: name,
        price: parseInt(price),
        desc: desc,
        img: "https://via.placeholder.com/100?text=Menu" // Placeholder gambar
    });

    alert("Menu Berhasil Ditambahkan!");
    closeModal('modal-add-menu');
    
    // Kosongkan form
    document.getElementById('menu-name').value = '';
    document.getElementById('menu-price').value = '';
    document.getElementById('menu-desc').value = '';

    renderMenus(); // Refresh tampilan
}

function deleteMenu(id) {
    if(confirm("Hapus menu ini?")) {
        menus = menus.filter(m => m.id !== id);
        renderMenus();
    }
}

// --- FUNGSI REQUEST MEJA (VERIFIKASI ADMIN) ---
function submitTableRequest() {
    const qty = document.getElementById('req-table-qty').value;
    if(!qty || qty <= 0) return alert("Masukkan jumlah yang benar!");

    // Tampilkan Notifikasi Pending
    document.getElementById('pending-msg').style.display = 'flex';
    document.querySelector('#pending-msg span').innerHTML = `Pengajuan tambah <b>${qty} Meja</b> sedang diverifikasi Admin.`;
    
    alert("Permintaan terkirim ke Admin. Mohon tunggu verifikasi.");
    closeModal('modal-add-table');
}

// --- UTILS MODAL ---
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// Init
renderMenus();
