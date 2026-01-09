import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, orderBy, doc, updateDoc, addDoc, deleteDoc, onSnapshot, where, limit, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================
   0. LOGIKA NAVIGASI (SIDEBAR & TABS)
   ========================================= */

// FUNGSI showView GABUNGAN (YANG BENAR)
window.showView = function(viewId, btn) {
    // 1. Sembunyikan semua view
    document.querySelectorAll('.admin-view').forEach(el => el.classList.add('hidden'));
    
    // 2. Tampilkan view yang dipilih
    const target = document.getElementById('view-' + viewId);
    if(target) target.classList.remove('hidden');
    
    // 3. Tambahan: Jika buka Finance, load datanya
    if(viewId === 'finance') renderFinanceData(); 

    // 4. Update status tombol aktif
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    if(btn) btn.classList.add('active');
}

window.switchCmsTab = function(tabId, btn) {
    document.querySelectorAll('.cms-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
}

window.adminLogout = function() {
    if(confirm("Keluar dari Panel Admin?")) {
        localStorage.removeItem('userLoggedIn');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('adminOrigin'); 
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
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            let statusBadge = `<span style="color:#00ff00;">Verified</span>`;
            let actionBtn = '';
            if (data.totalTables > 15 && !data.adminApproved) {
                statusBadge = `<span style="color:orange;">Butuh Approval</span>`;
                actionBtn = `<button class="btn-action btn-edit" onclick="approveTable('${id}')">Approve</button>`;
            }
            
            // TOMBOL MASUK DENGAN KLASIFIKASI TAB 'mitra'
            const impersonateBtn = `<button class="btn-action btn-view" onclick="loginAsMitra('${id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            
            tbody.innerHTML += `<tr><td><b>${data.name}</b></td><td>${data.owner||'-'}</td><td>${data.totalTables}</td><td>${statusBadge}</td><td>${impersonateBtn} ${actionBtn} <button class="btn-action btn-delete" onclick="deleteMitra('${id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        });
    });
}

// Login Mitra (Catat Jejak 'mitra')
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
            const btnLogin = `<button class="btn-action btn-view" onclick="loginAsPerf('${id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            const btnDel = `<button class="btn-action btn-delete" onclick="deletePerf('${id}')"><i class="fa-solid fa-trash"></i></button>`;
            tbody.innerHTML += `<tr><td><b>${data.name}</b></td><td>${data.genre}</td><td><span style="color:#00ff00;">Verified</span></td><td>${btnLogin} ${btnDel}</td></tr>`;
        });
    });
}

window.seedPerformer = async function() {
    await addDoc(collection(db, "performers"), {
        name: "The Acoustic Boys",
        genre: "Pop Jawa",
        verified: true,
        img: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=100",
        rating: 4.8
    });
    alert("Performer Dibuat! Silakan klik 'Masuk'.");
}

window.loginAsPerf = function(id, name) {
    if(confirm(`Masuk ke Studio ${name}?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'performer');
        localStorage.setItem('userName', name + " (Admin)");
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
        {
            name: "Bpk. Andigo",
            specialist: "Musik Management",
            img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200",
            portfolio: ["Manajer Band Indie 2010-2020", "Promotor Festival Jazz Jatim"],
            profession: ["Dosen Musik", "Event Organizer"]
        },
        {
            name: "Ibu Putri",
            specialist: "Stage Act & Koreo",
            img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200",
            portfolio: ["Koreografer Tari Nasional", "Mentor Idol 2019"],
            profession: ["Penari Profesional", "Guru Seni"]
        },
        {
            name: "Bpk. Ervan",
            specialist: "Visual Management",
            img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200",
            portfolio: ["Stage Designer Konser Amal", "Fotografer Event"],
            profession: ["Desainer Grafis", "Art Director"]
        }
    ];

    if(confirm("Generate 3 Data Mentor Dummy ke Database?")) {
        try {
            for (const m of mentorsData) {
                await addDoc(collection(db, "mentors"), m);
            }
            alert("Sukses! 3 Mentor telah ditambahkan.");
            loadMentorData(); 
        } catch (e) {
            alert("Gagal menambahkan data: " + e.message);
        }
    }
}

window.loginAsMentor = function(id, name) {
    if(confirm(`Masuk ke Dashboard ${name}?`)) {
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

// INIT
loadMitraData();
loadPerformerData();
loadMentorData();

/* =========================================
   4. MODUL KEUANGAN & LIVE COMMAND CENTER (FINAL)
   ========================================= */

// Expose fungsi ke window
window.loadFinanceStats = function() {
    renderFinanceData(); // Kolom Kanan
    renderLiveMonitor(); // Kolom Kiri
}

// A. LOGIKA KOLOM KANAN (STATISTIK & HISTORY)
let financeUnsubscribe = null;

async function renderFinanceData() {
    const filterType = document.getElementById('finance-filter').value; 
    const tbody = document.getElementById('finance-history-body');
    const perfContainer = document.getElementById('top-performer-list');
    const songContainer = document.getElementById('top-song-list');
    
    // Query data 'finished'
    const q = query(collection(db, "requests"), where("status", "==", "finished"), orderBy("timestamp", "desc"));

    if(financeUnsubscribe) financeUnsubscribe();

    financeUnsubscribe = onSnapshot(q, (snapshot) => {
        let totalMoney = 0;
        let totalCount = 0;
        let perfStats = {}; 
        let songStats = {}; 
        let historyHTML = '';

        const now = new Date();
        now.setHours(0,0,0,0); 

        snapshot.forEach(doc => {
            const d = doc.data();
            const date = d.timestamp.toDate(); 
            let include = false;

            // Filter Waktu
            if (filterType === 'all') include = true;
            else if (filterType === 'today') { if (date >= now) include = true; }
            else if (filterType === 'week') {
                const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
                if (date >= weekAgo) include = true;
            }
            else if (filterType === 'month') {
                const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
                if (date >= monthAgo) include = true;
            }

            if (include) {
                totalMoney += parseInt(d.amount);
                totalCount++;

                const pName = d.performer ? d.performer.trim() : "Unknown";
                if (!perfStats[pName]) perfStats[pName] = 0;
                perfStats[pName] += parseInt(d.amount);

                const displaySong = d.song; 
                if (!songStats[displaySong]) songStats[displaySong] = 0;
                songStats[displaySong] += 1;

                const dateStr = date.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
                historyHTML += `
                <tr>
                    <td>${dateStr}</td>
                    <td>${d.sender}</td>
                    <td>${d.song}</td>
                    <td>${d.performer}</td>
                    <td style="color:#00ff00;">Rp ${parseInt(d.amount).toLocaleString()}</td>
                </tr>`;
            }
        });

        document.getElementById('fin-total-amount').innerText = "Rp " + totalMoney.toLocaleString();
        document.getElementById('fin-total-req').innerText = totalCount;
        tbody.innerHTML = historyHTML || '<tr><td colspan="5" style="text-align:center; color:#555;">Belum ada data arsip.</td></tr>';

        // Render Top Perf
        const sortedPerf = Object.entries(perfStats).sort(([,a], [,b]) => b - a).slice(0, 3);
        perfContainer.innerHTML = '';
        sortedPerf.forEach(([name, amount], i) => {
            perfContainer.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span>${i+1}. ${name}</span><span style="color:gold;">Rp ${amount.toLocaleString()}</span></div>`;
        });

        // Render Top Song
        const sortedSong = Object.entries(songStats).sort(([,a], [,b]) => b - a).slice(0, 3);
        songContainer.innerHTML = '';
        sortedSong.forEach(([name, count], i) => {
            songContainer.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span>${i+1}. ${name}</span><span style="color:#aaa;">${count}x</span></div>`;
        });
    });
}

// B. LOGIKA KOLOM KIRI (LIVE MONITOR)
let liveUnsubscribe = null;

async function renderLiveMonitor() {
    const list = document.getElementById('admin-live-list');
    // Ambil Pending & Approved
    const q = query(collection(db, "requests"), where("status", "in", ["pending", "approved"]));

    if(liveUnsubscribe) liveUnsubscribe();

    liveUnsubscribe = onSnapshot(q, (snapshot) => {
        list.innerHTML = '';
        if(snapshot.empty) {
            list.innerHTML = '<p style="text-align:center; color:#444; margin-top:50px;">Tidak ada antrian.</p>';
            return;
        }

        // Sort Manual (Approved duluan)
        let requests = [];
        snapshot.forEach(doc => requests.push({id: doc.id, ...doc.data()}));
        requests.sort((a,b) => {
            if(a.status === b.status) return a.timestamp - b.timestamp;
            return a.status === 'approved' ? -1 : 1;
        });

        requests.forEach(d => {
            let btnAction = '';
            let statusText = '';

            if(d.status === 'pending') {
                statusText = '<span style="color:#ffeb3b; font-size:0.8rem;">⏳ MENUNGGU DANA</span>';
                btnAction = `<button class="btn-mini-action btn-acc" onclick="approveReq('${d.id}')">TERIMA DANA</button>`;
            } else {
                statusText = '<span style="color:#00ff00; font-size:0.8rem;">✅ LUNAS (ON AIR)</span>';
                btnAction = `<button class="btn-mini-action btn-finish" onclick="finishReq('${d.id}')">SELESAI / ARSIP</button>`;
            }

            list.innerHTML += `
            <div class="req-card-mini ${d.status}">
                <div class="mini-amount">Rp ${parseInt(d.amount).toLocaleString()}</div>
                <div>${statusText}</div>
                <h4 style="margin:5px 0; color:white;">${d.song}</h4>
                <small style="color:#aaa;">Dari: ${d.sender} • Untuk: ${d.performer}</small>
                ${btnAction}
            </div>`;
        });
    });
}

// C. FUNGSI AKSI (EXPORT KE WINDOW)
window.approveReq = async function(id) {
    if(confirm("Pastikan dana sudah masuk mutasi?")) {
        await updateDoc(doc(db, "requests", id), { status: 'approved' });
    }
}

window.finishReq = async function(id) {
    if(confirm("Arsipkan request ini ke Laporan?")) {
        // Pindah status jadi finished -> Otomatis hilang dari Kiri, muncul di Kanan
        await updateDoc(doc(db, "requests", id), { status: 'finished' });
    }
}

/* =========================================
   5. AUTO-RETURN TAB
   ========================================= */
setTimeout(() => {
    const lastTab = localStorage.getItem('adminReturnTab');
    if (lastTab) {
        console.log("Mencoba kembali ke tab:", lastTab);
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
