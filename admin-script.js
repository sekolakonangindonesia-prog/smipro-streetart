import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, orderBy, doc, updateDoc, addDoc, deleteDoc, onSnapshot, where, limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================
   1. INIT & OVERVIEW STATS
   ========================================= */
async function loadStats() {
    // Hitung Mitra
    const mitraSnap = await getDocs(collection(db, "warungs"));
    document.getElementById('count-mitra').innerText = mitraSnap.size;

    // Hitung Performer (Simulasi jika ada koleksi performers)
    // Untuk demo, kita set statis atau ambil dari dummy nanti
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
    
    // Realtime Listener agar kalau ada Mitra daftar, admin langsung tahu
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Cek jika meja > 15 tapi belum diverifikasi (Simulasi logic)
            let statusBadge = `<span style="color:#00ff00;">Verified</span>`;
            let actionBtn = '';

            if (data.totalTables > 15 && !data.adminApproved) {
                statusBadge = `<span style="color:orange;">Butuh Approval (>15 Meja)</span>`;
                actionBtn = `<button class="btn-action btn-edit" onclick="approveTable('${id}')">Approve</button>`;
            }

            // Tombol Login Sebagai (Impersonate)
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

// FUNGSI SAKTI: LOGIN SEBAGAI MITRA (REVISI)
window.loginAsMitra = function(id, name) {
    if(confirm(`Masuk ke Dashboard ${name} sebagai Admin?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'mitra');
        localStorage.setItem('userName', name + " (Mode Admin)");
        
        // REVISI: Tambahkan ini agar tidak Error 404 di Index
        localStorage.setItem('userLink', 'mitra-dashboard.html'); 
        
        window.location.href = 'mitra-dashboard.html';
    }
}

// APPROVE MEJA > 15
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
// Kita buat data dummy performer di table untuk demo
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

// FUNGSI SAKTI: LOGIN SEBAGAI PERFORMER (REVISI)
window.loginAsPerf = function(name) {
    if(confirm(`Masuk ke Studio ${name}?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'performer');
        localStorage.setItem('userName', name + " (Admin)");
        
        // REVISI: Tambahkan ini agar tidak Error 404
        localStorage.setItem('userLink', 'performer-dashboard.html');
        
        window.location.href = 'performer-dashboard.html';
    }
}
/* =========================================
   4. CMS: UPDATE JADWAL & BERITA
   ========================================= */
window.saveSchedule = async function() {
    const displayDate = document.getElementById('sched-display-date').value;
    const location = document.getElementById('sched-location').value;

    // Ambil data 3 artis dari form
    let performers = [];
    
    // Artis 1
    if(document.getElementById('p1-name').value) {
        performers.push({
            name: document.getElementById('p1-name').value,
            time: document.getElementById('p1-time').value,
            genre: document.getElementById('p1-genre').value,
            img: "https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=100" // Default img
        });
    }
    // Artis 2
    if(document.getElementById('p2-name').value) {
        performers.push({
            name: document.getElementById('p2-name').value,
            time: document.getElementById('p2-time').value,
            genre: document.getElementById('p2-genre').value,
            img: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=100"
        });
    }
    // Artis 3
    if(document.getElementById('p3-name').value) {
        performers.push({
            name: document.getElementById('p3-name').value,
            time: document.getElementById('p3-time').value,
            genre: document.getElementById('p3-genre').value,
            img: "https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?q=80&w=100"
        });
    }

    if(!displayDate) return alert("Tanggal wajib diisi!");

    // STRATEGI: Cari event 'main' yang lama, update isinya. Kalau gak ada, buat baru.
    const q = query(collection(db, "events"), where("type", "==", "main"));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        // Update yang ada
        const docId = snapshot.docs[0].id;
        await updateDoc(doc(db, "events", docId), {
            displayDate: displayDate,
            location: location,
            performers: performers
        });
        alert("Jadwal Berhasil Diupdate!");
    } else {
        // Buat baru
        await addDoc(collection(db, "events"), {
            type: "main",
            date: new Date().toISOString().split('T')[0], // Tgl hari ini
            displayDate: displayDate,
            location: location,
            statusText: "ON SCHEDULE",
            performers: performers
        });
        alert("Jadwal Baru Dibuat!");
    }
}

window.saveNews = async function() {
    const title = document.getElementById('news-title').value;
    const tag = document.getElementById('news-tag').value;
    
    if(!title) return alert("Judul berita kosong!");

    await addDoc(collection(db, "news"), {
        title: title,
        tag: tag || "INFO",
        date: "Baru saja",
        thumb: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=100"
    });
    alert("Berita diterbitkan ke Halaman Depan!");
}

/* =========================================
   5. KEUANGAN & LIVE MONITOR (INTEGRATED)
   ========================================= */
let allHistoryData = []; // Simpan data lokal untuk filtering

function listenFinance() {
    const liveList = document.getElementById('live-req-list');
    const historyList = document.getElementById('history-req-list');
    const totalLabel = document.getElementById('total-revenue-live');

    // Ambil data request diurutkan waktu terbaru
    const q = query(collection(db, "requests"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        liveList.innerHTML = '';
        allHistoryData = []; // Reset data lokal
        let totalDuit = 0;

        if(snapshot.empty) {
            liveList.innerHTML = '<p style="color:#555; text-align:center;">Belum ada data.</p>';
            historyList.innerHTML = '<p style="color:#555; text-align:center;">Kosong.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;

            // HITUNG TOTAL PENDAPATAN (Hanya yang status approved/done)
            if(data.status === 'approved' || data.status === 'done') {
                totalDuit += parseInt(data.amount || 0);
            }

            // --- PISAHKAN TAMPILAN ---
            
            // 1. JIKA STATUS PENDING (Masuk Kolom KIRI)
            if (data.status === 'pending') {
                liveList.innerHTML += `
                <div style="background:#332b00; padding:10px; border-radius:5px; border-left:4px solid #FFD700; animation:slideIn 0.3s;">
                    <div style="display:flex; justify-content:space-between;">
                        <b style="color:white;">${data.song}</b>
                        <span style="background:#FFD700; color:black; padding:2px 5px; border-radius:3px; font-weight:bold;">Rp ${parseInt(data.amount).toLocaleString()}</span>
                    </div>
                    <p style="color:#ccc; font-size:0.9rem; margin:5px 0;">"${data.message}"</p>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <small style="color:#aaa;">Utk: ${data.performer}</small>
                        <div>
                            <button onclick="deleteReq('${id}')" style="background:#333; color:red; border:1px solid #555; cursor:pointer; padding:5px;"><i class="fa-solid fa-trash"></i></button>
                            <button onclick="verifyPayment('${id}')" style="background:var(--green); color:black; border:none; padding:5px 10px; border-radius:3px; font-weight:bold; cursor:pointer;">TERIMA</button>
                        </div>
                    </div>
                </div>`;
            } 
            
            // 2. JIKA STATUS APPROVED/DONE (Masuk Array Data utk Kolom KANAN)
            else {
                // Simpan ke array dulu biar bisa difilter
                allHistoryData.push({ id, ...data });
            }
        });

        // Update Label Total
        if(totalLabel) totalLabel.innerText = "Rp " + totalDuit.toLocaleString('id-ID');

        // Render Riwayat Awal (Mode All)
        filterHistory();
    });
}

// LOGIKA FILTER RIWAYAT
window.filterHistory = function() {
    const filter = document.getElementById('history-filter').value; // all, today, week, month
    const historyList = document.getElementById('history-req-list');
    historyList.innerHTML = '';

    const now = new Date();
    
    // Filter Data
    const filtered = allHistoryData.filter(item => {
        if (!item.timestamp) return true; // Kalau gak ada tanggal, tampilkan aja
        const itemDate = item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
        
        if (filter === 'all') return true;
        if (filter === 'today') {
            return itemDate.toDateString() === now.toDateString();
        }
        if (filter === 'month') {
            return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        }
        return true;
    });

    // Render Hasil Filter
    if(filtered.length === 0) {
        historyList.innerHTML = '<p style="color:#555; text-align:center;">Tidak ada data pada periode ini.</p>';
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

window.deleteReq = async function(id) {
    if(confirm("Hapus / Tolak request ini?")) {
        await deleteDoc(doc(db, "requests", id));
    }
}

// Pastikan import deleteDoc ditambahkan di paling atas file admin-script.js jika belum ada

// JALANKAN SAAT LOAD
loadStats();
loadMitraData();
loadPerformerDemo();
listenFinance();
