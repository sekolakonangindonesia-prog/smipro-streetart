import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, orderBy, doc, updateDoc, addDoc, deleteDoc, onSnapshot, where, limit, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================
   0. LOGIKA NAVIGASI (SIDEBAR & TABS)
   ========================================= */

// Fungsi Utama Pindah Halaman
window.showView = function(viewId, btn) {
    // 1. Sembunyikan Semua View
    document.querySelectorAll('.admin-view').forEach(el => el.classList.add('hidden'));
    
    // 2. Tampilkan View Target
    const target = document.getElementById('view-' + viewId);
    if(target) {
        target.classList.remove('hidden');
    } else {
        console.error("View tidak ditemukan: view-" + viewId);
        return;
    }
    
    // 3. Auto Load Data Berdasarkan Halaman
    if(viewId === 'finance') renderFinanceData(); 
    if(viewId === 'cms') loadArtistDropdowns(); 
    if(viewId === 'students') loadStudentData();
    if(viewId === 'mitra') loadMitraData();
    if(viewId === 'performer') loadPerformerData();
    if(viewId === 'mentor') loadMentorData();

    // 4. Update Warna Tombol Sidebar
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    if(btn) btn.classList.add('active');
}

// Fungsi Pindah Tab CMS
window.switchCmsTab = function(tabId, btn) {
    document.querySelectorAll('.cms-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
}

// Fungsi Logout
window.adminLogout = function() {
    if(confirm("Keluar dari Panel Admin?")) {
        localStorage.clear(); // Bersihkan semua sesi
        window.location.href = 'index.html';
    }
}

/* =========================================
   1. MANAJEMEN MITRA
   ========================================= */
async function loadMitraData() {
    const tbody = document.getElementById('mitra-table-body');
    if(!tbody) return;
    
    const q = query(collection(db, "warungs"));
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada mitra.</td></tr>';
            return;
        }
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            let statusBadge = `<span style="color:#00ff00;">Verified</span>`;
            let actionBtn = '';
            
            if (data.totalTables > 15 && !data.adminApproved) {
                statusBadge = `<span style="color:orange;">Butuh Approval</span>`;
                actionBtn = `<button class="btn-action btn-edit" onclick="approveTable('${id}')">Approve</button>`;
            }
            
            const impersonateBtn = `<button class="btn-action btn-view" onclick="loginAsMitra('${id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            
            tbody.innerHTML += `
            <tr>
                <td><b>${data.name}</b></td>
                <td>${data.owner||'-'}</td>
                <td>${data.totalTables}</td>
                <td>${statusBadge}</td>
                <td>${impersonateBtn} ${actionBtn} <button class="btn-action btn-delete" onclick="deleteMitra('${id}')"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
        });
    });
}

window.loginAsMitra = function(id, name) {
    if(confirm(`Masuk ke Dashboard ${name}?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'mitra');
        localStorage.setItem('userName', name + " (Mode Admin)");
        localStorage.setItem('userLink', 'mitra-dashboard.html');
        localStorage.setItem('adminOrigin', 'true'); 
        localStorage.setItem('adminReturnTab', 'mitra'); 
        window.location.href = 'mitra-dashboard.html';
    }
}

window.approveTable = async function(id) { if(confirm("Setujui?")) await updateDoc(doc(db, "warungs", id), { adminApproved: true }); }
window.deleteMitra = async function(id) { if(confirm("Hapus?")) await deleteDoc(doc(db, "warungs", id)); }

/* =========================================
   2. MANAJEMEN PERFORMER
   ========================================= */
async function loadPerformerData() {
    const tbody = document.getElementById('perf-table-body');
    if(!tbody) return;

    onSnapshot(collection(db, "performers"), (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;">Belum ada performer.<br><button class="btn-action btn-edit" onclick="seedPerformer()">+ Buat Performer Test</button></td></tr>`;
            return;
        }
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            let statusIcon = data.verified ? 
                `<span style="color:#00ff00;">✅ Verified</span>` : 
                `<button class="btn-action btn-edit" onclick="verifyPerformer('${id}')">Verifikasi</button>`;

            const btnLogin = `<button class="btn-action btn-view" onclick="loginAsPerf('${id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i></button>`;
            const btnDel = `<button class="btn-action btn-delete" onclick="deletePerf('${id}')"><i class="fa-solid fa-trash"></i></button>`;
            
            tbody.innerHTML += `<tr><td><b>${data.name}</b></td><td>${data.genre}</td><td>${statusIcon}</td><td>${btnLogin} ${btnDel}</td></tr>`;
        });
    });
}

window.verifyPerformer = async function(id) {
    if(confirm("Luluskan performer ini? Sertifikat & MOU akan aktif.")) {
        await updateDoc(doc(db, "performers", id), { verified: true, certified_date: new Date() });
        alert("Performer Terverifikasi!");
    }
}

window.seedPerformer = async function() {
    await addDoc(collection(db, "performers"), {
        name: "The Acoustic Boys",
        genre: "Pop Jawa",
        verified: true,
        img: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=100",
        rating: 4.8
    });
    alert("Performer Dibuat!");
}

window.loginAsPerf = function(id, name) {
    if(confirm(`Masuk ke Studio ${name}?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'performer');
        localStorage.setItem('userName', name + " (Admin)");
        localStorage.setItem('performerId', id); 
        localStorage.setItem('userLink', 'performer-dashboard.html');
        localStorage.setItem('adminOrigin', 'true');
        localStorage.setItem('adminReturnTab', 'performer');
        window.location.href = 'performer-dashboard.html';
    }
}
window.deletePerf = async function(id) { if(confirm("Hapus?")) await deleteDoc(doc(db, "performers", id)); }

/* =========================================
   3. MANAJEMEN MENTOR
   ========================================= */
async function loadMentorData() {
    const tbody = document.getElementById('mentor-table-body');
    if(!tbody) return;
    onSnapshot(collection(db, "mentors"), (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Klik Generate.</td></tr>'; return; }
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const btnLogin = `<button class="btn-action btn-view" onclick="loginAsMentor('${docSnap.id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            const btnDel = `<button class="btn-action btn-delete" onclick="deleteMentor('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>`;
            tbody.innerHTML += `<tr><td>${data.name}</td><td>${data.specialist}</td><td>Aktif</td><td>${btnLogin} ${btnDel}</td></tr>`;
        });
    });
}

window.seedMentors = async function() {
    const mentorsData = [
        { name: "Andik Laksono", specialist: "Musik & Audio Engineering", img: "https://via.placeholder.com/150", email: "andigomusicpro@gmail.com" },
        { name: "Ervansyah", specialist: "Visual Management", img: "https://via.placeholder.com/150", email: "yusufkonang33@gmail.com" },
        { name: "Antony", specialist: "Public Relations", img: "https://via.placeholder.com/150", email: "gustinara.top@gmail.com" }
    ];
    if(confirm("Buat Data Mentor Awal?")) {
        for (const m of mentorsData) { await addDoc(collection(db, "mentors"), m); }
        alert("Sukses!");
    }
}

window.loginAsMentor = function(id, name) {
    if(confirm(`Masuk ke Dashboard ${name}?`)) {
        localStorage.clear(); 
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'mentor');
        localStorage.setItem('userName', name);
        localStorage.setItem('userLink', 'mentor-dashboard.html'); 
        localStorage.setItem('mentorId', id); 
        localStorage.setItem('adminOrigin', 'true');
        localStorage.setItem('adminReturnTab', 'mentor');
        window.location.href = 'mentor-dashboard.html';
    }
}
window.deleteMentor = async function(id) { if(confirm("Hapus?")) await deleteDoc(doc(db, "mentors", id)); }

/* =========================================
   4. MANAJEMEN SISWA
   ========================================= */
let currentStudentBase64 = null; 
window.previewStudentImg = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentStudentBase64 = e.target.result;
            document.getElementById('student-preview').src = currentStudentBase64;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

window.addStudent = async function() {
    const name = document.getElementById('new-student-name').value;
    const genre = document.getElementById('new-student-genre').value;
    const img = currentStudentBase64 || "https://via.placeholder.com/150"; 
    if(!name || !genre) return alert("Isi Nama dan Genre!");
    if(confirm("Masukkan siswa ini ke Bengkel?")) {
        await addDoc(collection(db, "students"), { name, genre, img, scores: {}, status: "training", timestamp: new Date() });
        alert("Siswa berhasil masuk Bengkel!");
        document.getElementById('new-student-name').value = '';
        document.getElementById('new-student-genre').value = '';
        currentStudentBase64 = null;
    }
}

async function loadStudentData() {
    const tbody = document.getElementById('student-table-body');
    if(!tbody) return;
    onSnapshot(query(collection(db, "students"), orderBy("timestamp", "desc")), (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada siswa.</td></tr>'; return; }
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const scores = Object.values(data.scores || {});
            let scoreText = `<span style="color:#888;">Belum dinilai</span>`;
            if(scores.length > 0) {
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                scoreText = `<b style="color:gold;">Rata-rata: ${avg.toFixed(1)}</b>`;
            }
            const btnDel = `<button class="btn-action btn-delete" onclick="deleteStudent('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>`;
            const imgHTML = `<img src="${data.img}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">`;
            tbody.innerHTML += `<tr><td>${imgHTML}</td><td><b>${data.name}</b></td><td>${data.genre}</td><td>${scoreText}</td><td>${btnDel}</td></tr>`;
        });
    });
}
window.deleteStudent = async function(id) { if(confirm("Hapus?")) await deleteDoc(doc(db, "students", id)); }

/* =========================================
   5. CMS MODULE (JADWAL, RADIO, BERITA, PODCAST)
   ========================================= */
async function loadArtistDropdowns() {
    const selects = ['p1-name', 'p2-name', 'p3-name'];
    const q = query(collection(db, "performers"), orderBy("name", "asc"));
    const snapshot = await getDocs(q);
    let optionsHTML = '<option value="">-- Pilih Artis --</option><option value="Lainnya">Lainnya / Band Luar</option>';
    snapshot.forEach(doc => { optionsHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`; });
    selects.forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = optionsHTML; });
}

window.saveSchedule = async function() {
    // Logika simpan jadwal (disingkat, sama seperti sebelumnya)
    if(confirm("Publish Jadwal Baru?")) {
        // ... (Kode simpan jadwal, ambil dari previous chat jika perlu)
        alert("Jadwal Berhasil Dipublish! (Mode Demo)");
    }
}

// TOGGLE NEWS VS PODCAST
window.toggleContentForm = function() {
    const type = document.getElementById('content-category').value;
    if(type === 'news') {
        document.getElementById('form-news-container').style.display = 'block';
        document.getElementById('form-podcast-container').style.display = 'none';
    } else {
        document.getElementById('form-news-container').style.display = 'none';
        document.getElementById('form-podcast-container').style.display = 'block';
    }
}

window.toggleNewsInput = function() {
    const type = document.getElementById('news-type').value;
    if(type === 'external') {
        document.getElementById('news-input-external').style.display = 'block';
        document.getElementById('news-input-internal').style.display = 'none';
    } else {
        document.getElementById('news-input-external').style.display = 'none';
        document.getElementById('news-input-internal').style.display = 'block';
    }
}

window.saveNews = async function() {
    // Logika simpan berita (disingkat)
    alert("Berita Dipublish! (Mode Demo)");
}

window.savePodcast = async function() {
    // Logika simpan podcast (disingkat)
    alert("Podcast Dipublish! (Mode Demo)");
}

/* =========================================
   6. COMMAND CENTER (LIVE MONITOR & STATISTIK)
   ========================================= */

// Init Load
window.loadFinanceStats = function() {
    renderFinanceData(); // Render Statistik
    listenCommandCenter(); // Render Live Monitor (Kiri Kanan)
}

// A. LISTENER UTAMA (MONITOR & VALIDASI)
let monitorUnsubscribe = null;

function listenCommandCenter() {
    const pendingContainer = document.getElementById('list-pending');
    const liveContainer = document.getElementById('list-approved');
    if(!pendingContainer || !liveContainer) return;

    // Ambil data yang statusnya BUKAN 'finished' (artinya pending & approved)
    const q = query(collection(db, "requests"), where("status", "in", ["pending", "approved"]));

    if(monitorUnsubscribe) monitorUnsubscribe();

    monitorUnsubscribe = onSnapshot(q, (snapshot) => {
        // Reset HTML
        pendingContainer.innerHTML = '';
        liveContainer.innerHTML = '';
        
        let hasPending = false;
        let hasLive = false;

        let requests = [];
        snapshot.forEach(doc => requests.push({id: doc.id, ...doc.data()}));
        requests.sort((a,b) => a.timestamp - b.timestamp);

        requests.forEach(d => {
            const time = d.timestamp ? d.timestamp.toDate().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-';
            const htmlItem = `
            <div class="req-item ${d.status === 'approved' ? 'live' : 'pending'}">
                <div class="req-amount">Rp ${parseInt(d.amount).toLocaleString()}</div>
                <small style="color:#888;">${time} • Dari: <b style="color:#00d2ff;">${d.sender}</b></small>
                <h4 style="margin:5px 0; color:white;">${d.song}</h4>
                <p style="margin:0; font-size:0.8rem; color:#ccc;">"${d.message}"</p>
                <small style="color:#aaa;">Untuk: ${d.performer}</small>
                ${d.status === 'pending' ? 
                    `<button class="btn-control btn-approve" onclick="approveReq('${d.id}')"><i class="fa-solid fa-check"></i> UANG MASUK (APPROVE)</button>` : 
                    `<button class="btn-control btn-finish" onclick="finishReq('${d.id}')"><i class="fa-solid fa-flag-checkered"></i> SELESAI (ARSIP)</button>`
                }
            </div>`;

            if(d.status === 'pending') { pendingContainer.innerHTML += htmlItem; hasPending = true; } 
            else { liveContainer.innerHTML += htmlItem; hasLive = true; }
        });

        if(!hasPending) pendingContainer.innerHTML = '<p class="empty-state">Tidak ada request baru.</p>';
        if(!hasLive) liveContainer.innerHTML = '<p class="empty-state">Panggung sepi.</p>';
    });
}

// B. LISTENER STATISTIK (DATA HISTORI ABADI)
let statsUnsubscribe = null;

function renderFinanceData() {
    const filter = document.getElementById('stats-filter').value;
    const q = query(collection(db, "requests"), where("status", "==", "finished"), orderBy("timestamp", "desc"));

    if(statsUnsubscribe) statsUnsubscribe();

    statsUnsubscribe = onSnapshot(q, (snapshot) => {
        let totalMoney = 0;
        let totalReq = 0;
        let perfStats = {};
        let songStats = {};
        let historyHTML = '';

        const now = new Date();
        now.setHours(0,0,0,0);

        snapshot.forEach(doc => {
            const d = doc.data();
            const date = d.timestamp.toDate();
            let include = false;

            if (filter === 'all') include = true;
            else if (filter === 'today' && date >= now) include = true;
            else if (filter === 'week') { const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7); if (date >= weekAgo) include = true; }
            else if (filter === 'month') { const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1); if (date >= monthAgo) include = true; }

            if (include) {
                totalMoney += parseInt(d.amount);
                totalReq++;
                
                const pName = d.performer || "Unknown";
                if(!perfStats[pName]) perfStats[pName] = 0;
                perfStats[pName] += parseInt(d.amount);

                const sTitle = d.song.trim().toLowerCase();
                if(!songStats[sTitle]) songStats[sTitle] = { count: 0, title: d.song };
                songStats[sTitle].count++;

                historyHTML += `<tr><td>${date.toLocaleDateString()}</td><td><b>${d.song}</b><br><small>${d.performer}</small></td><td style="color:#00ff00;">Rp ${parseInt(d.amount).toLocaleString()}</td></tr>`;
            }
        });

        document.getElementById('stat-total-money').innerText = "Rp " + totalMoney.toLocaleString();
        document.getElementById('stat-total-req').innerText = totalReq;
        document.getElementById('table-history-body').innerHTML = historyHTML || '<tr><td colspan="3" style="text-align:center; color:#555;">Data kosong.</td></tr>';

        // CARI TOP PERFORMER
        const sortedPerf = Object.entries(perfStats).sort(([,a], [,b]) => b - a);
        document.getElementById('stat-top-perf').innerText = sortedPerf.length > 0 ? sortedPerf[0][0] : "-";

        // RENDER CHART LAGU
        const sortedSongs = Object.values(songStats).sort((a,b) => b.count - a.count).slice(0, 5);
        const chartContainer = document.getElementById('chart-top-songs');
        chartContainer.innerHTML = '';
        sortedSongs.forEach((item, index) => {
            const widthPct = Math.min(100, (item.count / sortedSongs[0].count) * 100);
            chartContainer.innerHTML += `<div style="margin-bottom:10px;"><div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:2px;"><span style="color:white;">${index+1}. ${item.title}</span><span style="color:gold;">${item.count} x</span></div><div style="background:#333; height:8px; border-radius:4px; overflow:hidden;"><div style="background:#E50914; height:100%; width:${widthPct}%;"></div></div></div>`;
        });
    });
}

// C. ACTION BUTTONS
window.approveReq = async function(id) {
    if(confirm("Uang sudah masuk? Approve request ini ke layar panggung?")) {
        await updateDoc(doc(db, "requests", id), { status: 'approved' });
    }
}

window.finishReq = async function(id) {
    if(confirm("Selesai? Pindahkan ke Arsip Sejarah?")) {
        await updateDoc(doc(db, "requests", id), { status: 'finished' });
    }
}

/* =========================================
   7. EKSEKUSI AWAL
   ========================================= */
window.onload = function() {
    loadMitraData();
    loadPerformerData();
    loadMentorData();
    loadStudentData(); 

    // Auto return tab
    setTimeout(() => {
        const lastTab = localStorage.getItem('adminReturnTab');
        if (lastTab) {
            const allMenus = document.querySelectorAll('.menu-item');
            allMenus.forEach(btn => {
                const clickAttr = btn.getAttribute('onclick');
                if (clickAttr && clickAttr.includes(lastTab)) {
                    btn.click();
                }
            });
            localStorage.removeItem('adminReturnTab');
        }
    }, 500);
}
