import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, orderBy, doc, updateDoc, addDoc, deleteDoc, onSnapshot, where, limit, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================
   0. LOGIKA NAVIGASI (SIDEBAR & TABS)
   ========================================= */

window.showView = function(viewId, btn) {
    document.querySelectorAll('.admin-view').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('view-' + viewId);
    if(target) target.classList.remove('hidden');
    
    // Auto Load Data Khusus
    if(viewId === 'finance') renderFinanceData(); 
    if(viewId === 'cms') loadArtistDropdowns(); // <--- TAMBAHAN: Isi Dropdown Artis

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
            const impersonateBtn = `<button class="btn-action btn-view" onclick="loginAsMitra('${id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            tbody.innerHTML += `<tr><td><b>${data.name}</b></td><td>${data.owner||'-'}</td><td>${data.totalTables}</td><td>${statusBadge}</td><td>${impersonateBtn} ${actionBtn} <button class="btn-action btn-delete" onclick="deleteMitra('${id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
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
        {
            name: "Bpk. Andigo",
            specialist: "Musik Management",
            img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200",
            portfolio: ["Manajer Band Indie 2010-2020", "Promotor Festival Jazz Jatim"],
            profession: ["Dosen Musik", "Event Organizer"]
        },
        {
            name: "Bpk. Anton",
            specialist: "Public Speaking", 
            img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=200",
            portfolio: ["MC Kondang Jawa Timur", "Trainer Komunikasi"],
            profession: ["Broadcaster", "MC Professional"]
        },
        {
            name: "Bpk. Ervan",
            specialist: "Visual Management",
            img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200",
            portfolio: ["Stage Designer Konser Amal", "Fotografer Event"],
            profession: ["Desainer Grafis", "Art Director"]
        }
    ];

    if(confirm("Generate Data Mentor (Andigo, Anton, Ervan)?")) {
        try {
            for (const m of mentorsData) {
                await addDoc(collection(db, "mentors"), m);
            }
            alert("Sukses! Data Masuk.");
            loadMentorData(); 
        } catch (e) {
            alert("Gagal: " + e.message);
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

/* =========================================
   4. CMS MODULE (JADWAL, RADIO, BERITA)
   ========================================= */

// --- BARU: ISI DROPDOWN ARTIS OTOMATIS ---
async function loadArtistDropdowns() {
    const selects = ['p1-name', 'p2-name', 'p3-name'];
    const q = query(collection(db, "performers"), orderBy("name", "asc"));
    const snapshot = await getDocs(q);
    
    // Simpan opsi HTML dalam variabel
    let optionsHTML = '<option value="">-- Pilih Artis --</option><option value="Lainnya">Lainnya / Band Luar</option>';
    
    snapshot.forEach(doc => {
        const data = doc.data();
        optionsHTML += `<option value="${data.name}">${data.name}</option>`;
    });

    // Masukkan ke 3 dropdown
    selects.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = optionsHTML;
    });
}

// 1. SAVE SCHEDULE (JADWAL)
window.saveSchedule = async function() {
    const displayDate = document.getElementById('sched-display-date').value;
    const realDate = document.getElementById('sched-real-date').value;
    const location = document.getElementById('sched-location').value;
    
    const performers = [
        {
            name: document.getElementById('p1-name').value,
            time: document.getElementById('p1-time').value,
            genre: document.getElementById('p1-genre').value,
            img: "https://via.placeholder.com/100" 
        },
        {
            name: document.getElementById('p2-name').value,
            time: document.getElementById('p2-time').value,
            genre: document.getElementById('p2-genre').value,
            img: "https://via.placeholder.com/100"
        },
        {
            name: document.getElementById('p3-name').value,
            time: document.getElementById('p3-time').value,
            genre: document.getElementById('p3-genre').value,
            img: "https://via.placeholder.com/100"
        }
    ].filter(p => p.name !== "" && p.name !== "Lainnya"); // Filter

    if(!displayDate || !realDate) return alert("Tanggal wajib diisi!");

    if(confirm("Publish Jadwal Baru?")) {
        await addDoc(collection(db, "events"), {
            type: "main",
            displayDate: displayDate,
            date: realDate,
            location: location,
            statusText: "ON SCHEDULE",
            performers: performers,
            timestamp: new Date()
        });
        alert("Jadwal Berhasil Dipublish!");
    }
}

// 2. RADIO SYSTEM (LOAD & UPDATE)
let currentRadioDocId = null; 

window.loadRadioSessionData = async function() {
    const sessionName = document.getElementById('radio-session-select').value;
    const editArea = document.getElementById('radio-edit-area');
    
    if(!sessionName) {
        editArea.style.display = 'none';
        return;
    }

    const q = query(collection(db, "broadcasts"), where("sessionName", "==", sessionName), limit(1));
    const querySnapshot = await getDocs(q);

    if(!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        currentRadioDocId = docSnap.id; 

        document.getElementById('radio-title').value = data.title;
        document.getElementById('radio-host').value = data.host;
        document.getElementById('radio-topic').value = data.topic;
        document.getElementById('radio-link').value = data.link;
        document.getElementById('radio-live-toggle').checked = data.isLive;

        editArea.style.display = 'block';
    } else {
        alert("Data Sesi belum ada. Harap hubungi developer untuk 'Seed Radio'.");
        editArea.style.display = 'none';
    }
}

window.saveRadioUpdate = async function() {
    if(!currentRadioDocId) return;

    if(confirm("Simpan perubahan jadwal siaran?")) {
        await updateDoc(doc(db, "broadcasts", currentRadioDocId), {
            title: document.getElementById('radio-title').value,
            host: document.getElementById('radio-host').value,
            topic: document.getElementById('radio-topic').value,
            link: document.getElementById('radio-link').value,
            isLive: document.getElementById('radio-live-toggle').checked
        });
        alert("Jadwal Radio Diupdate!");
    }
}

// 3. BERITA SYSTEM (HYBRID)
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
    const title = document.getElementById('news-title').value;
    const tag = document.getElementById('news-tag').value;
    const thumb = document.getElementById('news-thumb').value;
    const type = document.getElementById('news-type').value;
    
    let newsData = {
        title: title,
        tag: tag,
        thumb: thumb || "https://via.placeholder.com/150",
        type: type,
        date: new Date().toLocaleDateString('id-ID'), 
        timestamp: new Date() 
    };

    if (type === 'external') {
        newsData.url = document.getElementById('news-url').value;
        if(!newsData.url) return alert("Link Berita wajib diisi!");
    } else {
        newsData.content = document.getElementById('news-content').value;
        if(!newsData.content) return alert("Isi Berita wajib diisi!");
    }

    if(!title) return alert("Judul wajib diisi!");

    if(confirm("Publish Berita ini?")) {
        await addDoc(collection(db, "news"), newsData);
        alert("Berita Berhasil Dipublish!");
        document.getElementById('news-title').value = '';
    }
}

/* =========================================
   5. MODUL KEUANGAN & LIVE COMMAND CENTER
   ========================================= */

window.loadFinanceStats = function() {
    renderFinanceData(); // Kolom Kanan
    renderLiveMonitor(); // Kolom Kiri
}

let financeUnsubscribe = null;

async function renderFinanceData() {
    const filterType = document.getElementById('finance-filter').value; 
    const tbody = document.getElementById('finance-history-body');
    const perfContainer = document.getElementById('top-performer-list');
    const songContainer = document.getElementById('top-song-list');
    
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

        const sortedPerf = Object.entries(perfStats).sort(([,a], [,b]) => b - a).slice(0, 5);
        perfContainer.innerHTML = '';
        sortedPerf.forEach(([name, amount], index) => {
            const rankColor = index === 0 ? '#FFD700' : (index === 1 ? 'silver' : '#cd7f32');
            const borderStyle = index < 3 ? `border-left: 3px solid ${rankColor};` : '';
            perfContainer.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:10px; background:#222; margin-bottom:5px; border-radius:5px; ${borderStyle}">
                <span><b>#${index+1}</b> ${name}</span>
                <span style="color:#00ff00;">Rp ${amount.toLocaleString()}</span>
            </div>`;
        });

        const sortedSong = Object.entries(songStats).sort(([,a], [,b]) => b - a).slice(0, 5);
        songContainer.innerHTML = '';
        sortedSong.forEach(([name, count], index) => {
            songContainer.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:10px; background:#222; margin-bottom:5px; border-radius:5px;">
                <span>${name}</span>
                <span style="background:#333; padding:2px 8px; border-radius:10px; font-size:0.8rem;">${count} x</span>
            </div>`;
        });
    });
}

// B. LOGIKA KOLOM KIRI (LIVE MONITOR)
let liveUnsubscribe = null;

async function renderLiveMonitor() {
    const list = document.getElementById('admin-live-list');
    const q = query(collection(db, "requests"), where("status", "in", ["pending", "approved"]));

    if(liveUnsubscribe) liveUnsubscribe();

    liveUnsubscribe = onSnapshot(q, (snapshot) => {
        list.innerHTML = '';
        if(snapshot.empty) {
            list.innerHTML = '<p style="text-align:center; color:#444; margin-top:50px;">Tidak ada antrian.</p>';
            return;
        }

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

window.approveReq = async function(id) {
    if(confirm("Pastikan dana sudah masuk mutasi?")) {
        await updateDoc(doc(db, "requests", id), { status: 'approved' });
    }
}

window.finishReq = async function(id) {
    if(confirm("Arsipkan request ini ke Laporan?")) {
        await updateDoc(doc(db, "requests", id), { status: 'finished' });
    }
}

/* =========================================
   6. SETUP DATA LOKASI (SEEDING)
   ========================================= */
window.seedVenues = async function() {
    const venuesData = [
        { name: "Stadion Bayuangga Zone", status: "open", icon: "fa-door-open", order: 1, desc: "Pusat Kuliner & Seni Utama" },
        { name: "Angkringan TWSL", status: "closed", icon: "fa-tree", order: 2, desc: "Taman Wisata Studi Lingkungan" },
        { name: "Angkringan Siaman", status: "closed", icon: "fa-mug-hot", order: 3, desc: "Suasana Klasik Kota" },
        { name: "Angkringan A. Yani", status: "closed", icon: "fa-road", order: 4, desc: "Pinggir Jalan Protokol" },
        { name: "Angkringan GOR Mastrip", status: "closed", icon: "fa-volleyball", order: 5, desc: "Area Olahraga & Santai" }
    ];

    if(confirm("Buat Data 5 Lokasi Awal di Database?")) {
        for (const v of venuesData) {
            await addDoc(collection(db, "venues"), v);
        }
        alert("Berhasil! 5 Lokasi telah dibuat.");
    }
}

/* =========================================
   7. AUTO-RETURN TAB & INIT
   ========================================= */
loadMitraData();
loadPerformerData();
loadMentorData();

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
