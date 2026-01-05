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

// FUNGSI SAKTI: LOGIN SEBAGAI MITRA
window.loginAsMitra = function(id, name) {
    if(confirm(`Masuk ke Dashboard ${name} sebagai Admin?`)) {
        // Timpa LocalStorage seolah-olah kita adalah Mitra tersebut
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'mitra');
        localStorage.setItem('userName', name + " (Mode Admin)");
        // Buka di tab baru agar panel admin tidak tertutup
        window.open('mitra-dashboard.html', '_blank');
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

window.loginAsPerf = function(name) {
    if(confirm(`Masuk ke Studio ${name}?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'performer');
        localStorage.setItem('userName', name + " (Admin)");
        window.open('performer-dashboard.html', '_blank');
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
   5. KEUANGAN & STATISTIK (UPDATE CANGGIH)
   ========================================= */
function listenFinance() {
    const list = document.getElementById('admin-req-list');
    const topPerfList = document.getElementById('top-perf-list');
    const topSongList = document.getElementById('top-song-list');

    const q = query(collection(db, "requests"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        list.innerHTML = '';
        
        // VARIABEL UNTUK HITUNG STATISTIK
        let perfStats = {};
        let songStats = {};

        if(snapshot.empty) list.innerHTML = '<p style="color:#555;">Belum ada request masuk.</p>';

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // 1. HITUNG STATISTIK (Hanya yang sudah approved/dibayar)
            if(data.status === 'approved' || data.status === 'done') {
                // Hitung Performer
                let pName = data.performer || "Unknown";
                if(!perfStats[pName]) perfStats[pName] = 0;
                perfStats[pName]++;

                // Hitung Lagu
                let sTitle = data.song || "Unknown";
                // Bersihkan judul (misal: "Nemen " jadi "Nemen") agar hitungannya akurat
                sTitle = sTitle.trim().toLowerCase(); 
                if(!songStats[sTitle]) songStats[sTitle] = 0;
                songStats[sTitle]++;
            }

            // 2. RENDER LIST REQUEST (Sama seperti sebelumnya)
            let btnAction = '';
            let statusColor = '#333';
            
            if(data.status === 'pending') {
                btnAction = `<button onclick="verifyPayment('${id}')" style="background:orange; border:none; padding:5px; border-radius:3px; cursor:pointer;">Verifikasi Pembayaran</button>`;
                statusColor = '#443300';
            } else {
                btnAction = `<span style="color:#00ff00;"><i class="fa-solid fa-check"></i> Lunas</span>`;
                statusColor = '#002200';
            }

            list.innerHTML += `
            <div style="background:${statusColor}; padding:10px; border-radius:5px; border:1px solid #444; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <b style="color:white;">${data.song}</b> <small style="color:#ccc;">(${data.sender})</small><br>
                    <small style="color:#00d2ff;">${data.performer}</small> • <b style="color:gold;">Rp ${parseInt(data.amount).toLocaleString()}</b>
                </div>
                <div>${btnAction}</div>
            </div>`;
        });

        // 3. RENDER HASIL STATISTIK KE TABEL
        renderStats(perfStats, topPerfList);
        renderStats(songStats, topSongList);
    });
}

// Fungsi Pembantu Render Statistik
function renderStats(statsObj, container) {
    // Ubah Object ke Array lalu Sortir dari yang terbesar
    const sorted = Object.entries(statsObj)
        .sort(([,a], [,b]) => b - a) // Urutkan angka terbesar
        .slice(0, 5); // Ambil Top 5 saja

    container.innerHTML = '';
    if(sorted.length === 0) {
        container.innerHTML = '<li>Belum ada data.</li>';
        return;
    }

    sorted.forEach(([key, val]) => {
        // Huruf besar di awal kata (Capitalize)
        const displayKey = key.replace(/\b\w/g, l => l.toUpperCase());
        container.innerHTML += `<li style="margin-bottom:5px;"><b>${displayKey}</b> <span style="color:#888;">(${val} request)</span></li>`;
    });
}

window.verifyPayment = async function(id) {
    if(confirm("Dana sudah masuk ke rekening Admin?")) {
        await updateDoc(doc(db, "requests", id), { status: 'approved' });
    }
}

// JALANKAN SAAT LOAD
loadStats();
loadMitraData();
loadPerformerDemo();
listenFinance();
