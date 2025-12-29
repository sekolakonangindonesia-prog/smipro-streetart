// DATA 5 LOKASI DASHBOARD
const dashboardVenues = [
    { id: 1, name: "Stadion Bayuangga Zone", active: true, desc: "Pusat Aktivitas Utama" },
    { id: 2, name: "Alun-Alun Kota", active: false, desc: "Segera Hadir" },
    { id: 3, name: "Benteng Mayangan", active: false, desc: "Segera Hadir" },
    { id: 4, name: "Museum Probolinggo", active: false, desc: "Segera Hadir" },
    { id: 5, name: "BJBR Mangrove", active: false, desc: "Segera Hadir" }
];

// DATA WARUNG (KHUSUS STADION)
let warungData = [
    { id: 101, name: "Warung Bu Sri", img: "https://images.unsplash.com/photo-1541544744-5e3a01998cd1?q=80&w=200", total: 15, booked: 5, bookings: [] },
    { id: 102, name: "Kopi Pakde Jono", img: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=200", total: 10, booked: 2, bookings: [] },
    { id: 103, name: "Angkringan Mas Boy", img: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=200", total: 20, booked: 18, bookings: [] },
    { id: 104, name: "Sate Taichan Pro", img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=200", total: 12, booked: 12, bookings: [] }, // Penuh
    { id: 105, name: "Ropang Gaul", img: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=200", total: 12, booked: 0, bookings: [] },
    { id: 106, name: "Bakso Cak Man", img: "https://images.unsplash.com/photo-1529042410759-befb1204b468?q=80&w=200", total: 15, booked: 4, bookings: [] }
];

// DATA TOP 5 PERFORMER
const topPerf = [
    { name: "Rina Violin", img: "https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=150" },
    { name: "The Acoustic", img: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=150" },
    { name: "Rock Ballad", img: "https://images.unsplash.com/photo-1526218626217-dc65b9d6e630?q=80&w=150" },
    { name: "Siti Keroncong", img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150" },
    { name: "Solo Hudi", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150" }
];

// --- FUNGSI UTAMA ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    window.scrollTo(0, 0);
}

// RENDER DASHBOARD
function renderDashboard() {
    // 1. Render Venues
    const vList = document.getElementById('venues-list');
    vList.innerHTML = '';
    dashboardVenues.forEach(v => {
        let statusHtml = v.active ? `<span class="badge active">BUKA</span>` : `<span class="badge soon">SEGERA HADIR</span>`;
        let disabledClass = v.active ? '' : 'disabled';
        let clickAction = v.active ? `onclick="showPage('detail'); renderWarungs();"` : `onclick="alert('Mohon maaf, lokasi ini Segera Hadir!')"`;
        let icon = v.active ? 'fa-door-open' : 'fa-lock';
        
        vList.innerHTML += `
        <div class="venue-card ${disabledClass}" ${clickAction}>
            <div style="font-size:1.5rem; color:${v.active ? 'var(--primary)' : '#555'}"><i class="fa-solid ${icon}"></i></div>
            <div style="flex:1;">
                <h3 style="margin:0; font-size:1rem;">${v.name} ${statusHtml}</h3>
                <p style="margin:0; font-size:0.8rem; color:#888;">${v.desc}</p>
            </div>
            <i class="fa-solid fa-chevron-right" style="color:#444;"></i>
        </div>`;
    });

    // 2. Render Top Performers
    const pList = document.getElementById('top-performers-list');
    pList.innerHTML = '';
    topPerf.forEach(p => {
        pList.innerHTML += `<div class="artist-card-ss1"><img src="${p.img}" class="artist-img-ss1"><h4>${p.name}</h4></div>`;
    });
}

// RENDER WARUNG (DETAIL PAGE)
function renderWarungs() {
    const grid = document.getElementById('warung-grid');
    grid.innerHTML = '';
    
    warungData.forEach(w => {
        const sisa = w.total - w.booked;
        const isFull = sisa <= 0;
        let btnHtml = isFull ? `<button class="btn-book" disabled>Penuh</button>` : `<button class="btn-book" onclick="openBooking(${w.id})">Booking</button>`;
        let statusClass = isFull ? 'full' : '';

        grid.innerHTML += `
        <div class="warung-card">
            <img src="${w.img}" class="warung-img">
            <div style="padding:10px;">
                <span style="font-weight:bold; display:block; font-size:0.9rem;">${w.name}</span>
                <span class="table-status ${statusClass}" style="font-size:0.75rem; color:#aaa;"><b>${isFull ? 0 : sisa}</b> / ${w.total} Meja</span>
                ${btnHtml}
            </div>
        </div>`;
    });
}

// BOOKING SYSTEM
let selectedWarung = null;
function openBooking(id) {
    selectedWarung = warungData.find(w => w.id === id);
    document.getElementById('modal-warung-name').innerText = selectedWarung.name;
    document.getElementById('booking-modal').style.display = 'flex';
}
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function confirmBooking() {
    const name = document.getElementById('book-name').value;
    const qty = parseInt(document.getElementById('book-qty').value);
    
    if(!name || !qty) return alert("Isi data dengan benar!");
    if(selectedWarung.booked + qty > selectedWarung.total) return alert("Meja tidak cukup!");

    selectedWarung.booked += qty;
    selectedWarung.bookings.push({ name: name, qty: qty });
    
    alert("Booking Berhasil!");
    closeModal('booking-modal');
    renderWarungs(); // Refresh grid
    document.getElementById('book-name').value = '';
}

// ADMIN SYSTEM
function adminLogin() {
    // Render select options
    const sel = document.getElementById('admin-select');
    sel.innerHTML = '<option value="">-- Pilih Warung --</option>';
    warungData.forEach(w => sel.innerHTML += `<option value="${w.id}">${w.name}</option>`);
    showPage('admin-login');
}
function adminLogout() { showPage('home'); }

// Tombol Masuk Dashboard Admin
document.querySelector('#page-admin-login button').onclick = function() {
    const id = parseInt(document.getElementById('admin-select').value);
    if(!id) return alert("Pilih warung!");
    const w = warungData.find(item => item.id === id);
    renderAdminDashboard(w);
    showPage('admin-dashboard');
}

function renderAdminDashboard(w) {
    document.getElementById('admin-title-text').innerText = `Admin: ${w.name}`;
    document.getElementById('stat-empty').innerText = w.total - w.booked;
    document.getElementById('stat-booked').innerText = w.booked;
    
    const list = document.getElementById('booking-list-admin');
    list.innerHTML = '';
    w.bookings.forEach((b, idx) => {
        list.innerHTML += `
        <div class="admin-book-item">
            <div><b>${b.name}</b><br><small>${b.qty} Meja</small></div>
            <button class="btn-small" onclick="releaseTable(${w.id}, ${idx})">Selesai</button>
        </div>`;
    });
    if(w.bookings.length === 0) list.innerHTML = '<p style="text-align:center; color:#666;">Belum ada tamu.</p>';
}

function releaseTable(wid, bidx) {
    const w = warungData.find(item => item.id === wid);
    w.booked -= w.bookings[bidx].qty;
    w.bookings.splice(bidx, 1);
    alert("Meja dikosongkan!");
    renderAdminDashboard(w);
}

// OTHER UTILS
function openTrainingModal() { document.getElementById('training-modal').style.display = 'block'; }
function rateVenue(n) { document.querySelectorAll('#venue-stars i').forEach((s,i) => i < n ? s.classList.add('gold') : s.classList.remove('gold')); }
function submitVenueFeedback() { alert("Feedback terkirim!"); document.getElementById('venue-feedback').value=''; }

// INIT
renderDashboard();
