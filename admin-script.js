import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, orderBy, doc, updateDoc, addDoc, deleteDoc, onSnapshot, where, limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================
   0. LOGIKA NAVIGASI (SIDEBAR & TABS) - PERBAIKAN
   ========================================= */

// Fungsi Ganti Halaman (Sidebar)
window.showView = function(viewId, btn) {
    // 1. Sembunyikan semua view
    document.querySelectorAll('.admin-view').forEach(el => el.classList.add('hidden'));
    
    // 2. Tampilkan view yang dipilih
    const target = document.getElementById('view-' + viewId);
    if(target) {
        target.classList.remove('hidden');
    } else {
        console.error("View tidak ditemukan: " + viewId);
    }
    
    // 3. Atur tombol aktif di sidebar
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    if(btn) btn.classList.add('active');
}

// Fungsi Ganti Tab CMS (Jadwal/Radio/Berita)
window.switchCmsTab = function(tabId, btn) {
    document.querySelectorAll('.cms-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
}

// Fungsi Logout
window.adminLogout = function() {
    if(confirm("Keluar dari Panel Admin?")) {
        localStorage.removeItem('userLoggedIn');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        window.location.href = 'index.html';
    }
}

/* =========================================
   1. INIT & OVERVIEW STATS
   ========================================= */
async function loadStats() {
    // Hitung Mitra
    const mitraSnap = await getDocs(collection(db, "warungs"));
    document.getElementById('count-mitra').innerText = mitraSnap.size;

    // Hitung Performer (Dummy)
    document.getElementById('count-perf').innerText = "5"; 

    // Hitung Total Saweran (Pending + Approved)
    const reqSnap = await getDocs(collection(db, "requests"));
    let total = 0;
    reqSnap.forEach(doc => total += parseInt(doc.data().amount || 0));
    document.getElementById('total-revenue').innerText = "Rp " + total.toLocaleString('id-ID');
}

/* =========================================
   2. MANAJEMEN MITRA (SUPER USER)
   ========================================= */
async function loadMitraData() {
    const tbody = document.getElementById('mitra-table-body');
    const q = query(collection(db, "warungs"));
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            let statusBadge = `<span style="color:#00ff00;">Verified</span>`;
            let actionBtn = '';

            if (data.totalTables > 15 && !data.adminApproved) {
                statusBadge = `<span style="color:orange;">Butuh Approval (>15 Meja)</span>`;
                actionBtn = `<button class="btn-action btn-edit" onclick="approveTable('${id}')">Approve</button>`;
            }

            const impersonateBtn = `<button class="btn-action btn-view" onclick="loginAsMitra('${id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            
            tbody.innerHTML += `
            <tr>
                <td><b>${data.name}</b></td>
                <td>${data.owner || 'Pemilik Warung'}</td>
                <td>${data.totalTables}</td>
                <td>${statusBadge}</td>
                <td>
                    ${impersonateBtn}
                    ${actionBtn}
                    <button class="btn-action btn-delete" onclick="deleteMitra('${id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        });
    });
}

// FUNGSI SAKTI: LOGIN SEBAGAI MITRA (FIXED)
window.loginAsMitra = function(id, name) {
    if(confirm(`Masuk ke Dashboard ${name} sebagai Admin?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'mitra');
        localStorage.setItem('userName', name + " (Mode Admin)");
        localStorage.setItem('userLink', 'mitra-dashboard.html'); // Link penting agar tidak 404
        window.open('mitra-dashboard.html', '_blank');
    }
}

window.approveTable = async function(id) {
    if(confirm("Setujui permintaan penambahan meja?")) {
        await updateDoc(doc(db, "warungs", id), { adminApproved: true });
        alert("Status Disetujui!");
    }
}

window.deleteMitra = async function(id) {
    if(confirm("Hapus Data Mitra Ini?")) await deleteDoc(doc(db, "warungs", id));
}

/* =========================================
   3. MANAJEMEN PERFORMER
   ========================================= */
window.loadPerformerDemo = function() {
    const tbody = document.getElementById('perf-table-body');
    const performers = [
        { id: 'perf1', name: 'The Acoustic Boys', genre: 'Pop Jawa', certified: true },
        { id: 'perf2', name: 'Rina Violin', genre: 'Instrumental', certified: true },
        { id: 'perf3', name: 'Band Pemula', genre: 'Rock', certified: false }
    ];

    tbody.innerHTML = '';
    performers.forEach(p => {
        const certStatus = p.certified ? 
            '<span style="color:#00ff00;">Certified <i class="fa-solid fa-check"></i></span>' : 
            '<button class="btn-action btn-edit" onclick="alert(\'Sertifikat diterbitkan!\')">Approve Lulus</button>';

        tbody.innerHTML += `
        <tr>
            <td>${p.name}</td>
            <td>${p.genre}</td>
            <td>${certStatus}</td>
            <td>
                <button class="btn-action btn-view" onclick="loginAsPerf('${p.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk Dashboard</button>
            </td>
        </tr>`;
    });
}

// FUNGSI SAKTI: LOGIN SEBAGAI PERFORMER (FIXED)
window.loginAsPerf = function(name) {
    if(confirm(`Masuk ke Studio ${name}?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'performer');
        localStorage.setItem('userName', name + " (Admin)");
        localStorage.setItem('userLink', 'performer-dashboard.html'); // Link penting
        window.open('performer-dashboard.html', '_blank');
    }
}

/* =========================================
   4. CMS: UPDATE JADWAL & BERITA
   ========================================= */
window.saveSchedule = async function() {
    const displayDate = document.getElementById('sched-display-date').value;
    const location = document.getElementById('sched-location').value;

    let performers = [];
    if(document.getElementById('p1-name').value) {
        performers.push({
            name: document.getElementById('p1-name').value,
            time: document.getElementById('p1-time').value,
            genre: document.getElementById('p1-genre').value,
            img: "https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=100"
        });
    }
    if(document.getElementById('p2-name').value) {
        performers.push({
            name: document.getElementById('p2-name').value,
            time: document.getElementById('p2-time').value,
            genre: document.getElementById('p2-genre').value,
            img: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=100"
        });
    }
    if(document.getElementById('p3-name').value) {
        performers.push({
            name: document.getElementById('p3-name').value,
            time: document.getElementById('p3-time').value,
            genre: document.getElementById('p3-genre').value,
            img: "https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?q=80&w=100"
        });
    }

    if(!displayDate) return alert("Tanggal wajib diisi!");

    const q = query(collection(db, "events"), where("type", "==", "main"));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        await updateDoc(doc(db, "events", docId), { displayDate, location, performers });
        alert("Jadwal Berhasil Diupdate!");
    } else {
        await addDoc(collection(db, "events"), {
            type: "main",
            date: new Date().toISOString().split('T')[0],
            displayDate, location, statusText: "ON SCHEDULE", performers
        });
        alert("Jadwal Baru Dibuat!");
    }
}

window.saveNews = async function() {
    const title = document.getElementById('news-title').value;
    const tag = document.getElementById('news-tag').value;
    
    if(!title) return alert("Judul berita kosong!");

    await addDoc(collection(db, "news"), {
        title: title, tag: tag || "INFO", date: "Baru saja",
        thumb: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=100"
    });
    alert("Berita diterbitkan!");
}

/* =========================================
   5. KEUANGAN & LIVE MONITOR (INTEGRATED)
   ========================================= */
let allHistoryData = []; 

function listenFinance() {
    const liveList = document.getElementById('live-req-list');
    const historyList = document.getElementById('history-req-list');
    const totalLabel = document.getElementById('total-revenue-live');
    const topPerfList = document.getElementById('top-perf-list');
    const topSongList = document.getElementById('top-song-list');

    const q = query(collection(db, "requests"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        liveList.innerHTML = '';
        allHistoryData = []; 
        let totalDuit = 0;
        let perfStats = {};
        let songStats = {};

        if(snapshot.empty) {
            liveList.innerHTML = '<p style="color:#555; text-align:center;">Belum ada data.</p>';
            historyList.innerHTML = '<p style="color:#555; text-align:center;">Kosong.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;

            // HITUNG STATISTIK (Hanya yang Approved)
            if(data.status === 'approved' || data.status === 'done') {
                totalDuit += parseInt(data.amount || 0);
                
                // Hitung Performer
                let pName = data.performer || "Unknown";
                if(!perfStats[pName]) perfStats[pName] = 0;
                perfStats[pName]++;

                // Hitung Lagu
                let sTitle = data.song || "Unknown";
                sTitle = sTitle.trim().toLowerCase(); 
                if(!songStats[sTitle]) songStats[sTitle] = 0;
                songStats[sTitle]++;
            }

            // PISAHKAN PENDING vs RIWAYAT
            if (data.status === 'pending') {
                liveList.innerHTML += `
                <div style="background:#332b00; padding:10px; border-radius:5px; border-left:4px solid #FFD700; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between;">
                        <b style="color:white;">${data.song}</b>
                        <span style="background:#FFD700; color:black; padding:2px 5px; border-radius:3px; font-weight:bold;">Rp ${parseInt(data.amount).toLocaleString()}</span>
                    </div>
                    <p style="color:#ccc; font-size:0.9rem; margin:5px 0;">"${data.message}"</p>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <small style="color:#aaa;">Utk: ${data.performer}</small>
                        <div>
                            <button onclick="deleteReq('${id}')" style="background:#333; color:red; border:1px solid #555; cursor:pointer; padding:5px; margin-right:5px;"><i class="fa-solid fa-trash"></i></button>
                            <button onclick="verifyPayment('${id}')" style="background:var(--green); color:black; border:none; padding:5px 10px; border-radius:3px; font-weight:bold; cursor:pointer;">TERIMA</button>
                        </div>
                    </div>
                </div>`;
            } else {
                allHistoryData.push({ id, ...data });
            }
        });

        if(totalLabel) totalLabel.innerText = "Rp " + totalDuit.toLocaleString('id-ID');
        
        filterHistory(); // Refresh riwayat
        
        // Render Statistik jika elemennya ada (di View Keuangan)
        if(topPerfList) renderStats(perfStats, topPerfList);
        if(topSongList) renderStats(songStats, topSongList);
    });
}

// Fungsi Helper Statistik
function renderStats(statsObj, container) {
    const sorted = Object.entries(statsObj).sort(([,a], [,b]) => b - a).slice(0, 5);
    container.innerHTML = '';
    if(sorted.length === 0) container.innerHTML = '<li>Belum ada data.</li>';
    sorted.forEach(([key, val]) => {
        const displayKey = key.replace(/\b\w/g, l => l.toUpperCase());
        container.innerHTML += `<li style="margin-bottom:5px;"><b>${displayKey}</b> <span style="color:#888;">(${val})</span></li>`;
    });
}

// Filter Riwayat
window.filterHistory = function() {
    const filter = document.getElementById('history-filter') ? document.getElementById('history-filter').value : 'all';
    const historyList = document.getElementById('history-req-list');
    
    // Pastikan elemen ada (karena mungkin sedang di tab lain)
    if(!historyList) return;

    historyList.innerHTML = '';
    const now = new Date();
    
    const filtered = allHistoryData.filter(item => {
        if (!item.timestamp) return true;
        const itemDate = item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
        if (filter === 'all') return true;
        if (filter === 'today') return itemDate.toDateString() === now.toDateString();
        if (filter === 'month') return itemDate.getMonth() === now.getMonth();
        return true;
    });

    if(filtered.length === 0) {
        historyList.innerHTML = '<p style="color:#555; text-align:center;">Tidak ada data.</p>';
        return;
    }

    filtered.forEach(data => {
        historyList.innerHTML += `
        <div style="background:#1a1a1a; padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <b style="color:white; font-size:0.9rem;">${data.song}</b>
                <br><small style="color:#00d2ff;">${data.performer}</small>
                <span style="color:#555; font-size:0.7rem;"> • ${data.sender}</span>
            </div>
            <div style="text-align:right;">
                <b style="color:var(--green);">+ ${parseInt(data.amount).toLocaleString()}</b>
                <br><small style="color:#aaa;">Lunas</small>
            </div>
        </div>`;
    });
}

window.verifyPayment = async function(id) {
    if(confirm("Dana sudah masuk ke rekening Admin?")) await updateDoc(doc(db, "requests", id), { status: 'approved' });
}

window.deleteReq = async function(id) {
    if(confirm("Hapus request ini?")) await deleteDoc(doc(db, "requests", id));
}

// JALANKAN SAAT LOAD
loadStats();
loadMitraData();
loadPerformerDemo();
listenFinance();
