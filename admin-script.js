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
    
    // Khusus CMS Radio, render form jika belum ada
    if(viewId === 'cms') renderRadioForm();

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
        localStorage.removeItem('adminOrigin'); // Bersihkan jejak admin
        window.location.href = 'index.html';
    }
}

/* =========================================
   1. INIT & OVERVIEW STATS (REALTIME)
   ========================================= */
function initStats() {
    // 1. Hitung Mitra
    onSnapshot(collection(db, "warungs"), (snap) => {
        const el = document.getElementById('count-mitra');
        if(el) el.innerText = snap.size;
        
        // Cek Approval di sini sekalian
        const pending = snap.docs.filter(d => d.data().totalTables > 15 && !d.data().adminApproved).length;
        const notifArea = document.getElementById('pending-actions-list');
        if(notifArea) {
            notifArea.innerHTML = pending > 0 
                ? `<span style="color:orange;">${pending} Mitra butuh approval meja. Cek menu Data Mitra.</span>` 
                : `<span style="color:#888; font-style:italic;">Tidak ada request pending.</span>`;
        }
    });

    // 2. Hitung Mentor
    onSnapshot(collection(db, "mentors"), (snap) => {
        const el = document.getElementById('count-perf'); // Pakai slot performer sementara
        if(el) el.innerText = snap.size + " Mentor";
    });

    // 3. Hitung Total Saweran (Status: approved/done)
    const qSawer = query(collection(db, "requests")); // Ambil semua
    onSnapshot(qSawer, (snap) => {
        let total = 0;
        snap.forEach(doc => {
            const d = doc.data();
            if(d.status === 'approved' || d.status === 'done') {
                total += parseInt(d.amount || 0);
            }
        });
        const el = document.getElementById('total-revenue');
        if(el) el.innerText = "Rp " + total.toLocaleString('id-ID');
    });
}

/* =========================================
   2. MANAJEMEN MITRA
   ========================================= */
async function loadMitraData() {
    const tbody = document.getElementById('mitra-table-body');
    if(!tbody) return;

    const q = query(collection(db, "warungs"));
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada data mitra.</td></tr>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            let statusBadge = `<span style="color:#00ff00;">Verified</span>`;
            let actionBtn = '';

            // Logic Approval Meja > 15
            if (data.totalTables > 15 && !data.adminApproved) {
                statusBadge = `<span style="color:orange;">Menunggu Approval (${data.totalTables} Meja)</span>`;
                actionBtn = `<button class="btn-action btn-edit" onclick="approveTable('${id}')">Approve</button>`;
            }

            const impersonateBtn = `<button class="btn-action btn-view" onclick="loginAsMitra('${id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            
            tbody.innerHTML += `
            <tr>
                <td><b>${data.name}</b></td>
                <td>${data.owner || '-'}</td>
                <td>${data.totalTables}</td>
                <td>${statusBadge}</td>
                <td style="display:flex; gap:5px;">
                    ${impersonateBtn}
                    ${actionBtn}
                    <button class="btn-action btn-delete" onclick="deleteMitra('${id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        });
    });
}

window.loginAsMitra = function(id, name) {
    if(confirm(`Masuk ke Dashboard ${name} sebagai Admin?`)) {
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'mitra');
        localStorage.setItem('userName', name + " (Mode Admin)");
        localStorage.setItem('userLink', 'mitra-dashboard.html');
        // FLAG PENTING: Agar nanti muncul tombol 'Kembali ke Admin'
        localStorage.setItem('adminOrigin', 'true'); 
        window.open('mitra-dashboard.html', '_blank');
    }
}

window.approveTable = async function(id) {
    if(confirm("Setujui penambahan meja mitra ini?")) {
        await updateDoc(doc(db, "warungs", id), { adminApproved: true });
    }
}

window.deleteMitra = async function(id) {
    if(confirm("Hapus Permanen Data Mitra Ini?")) await deleteDoc(doc(db, "warungs", id));
}

/* =========================================
   3. MANAJEMEN MENTOR
   ========================================= */
async function loadMentorData() {
    const tbody = document.getElementById('mentor-table-body');
    if(!tbody) return;

    onSnapshot(collection(db, "mentors"), (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada data. Klik Generate.</td></tr>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const btnDel = `<button class="btn-action btn-delete" onclick="deleteMentor('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>`;

            tbody.innerHTML += `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${data.img || 'https://via.placeholder.com/40'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #555;">
                        <b>${data.name}</b>
                    </div>
                </td>
                <td><span style="color:#FFD700;">${data.specialist}</span></td>
                <td><span style="color:#00ff00;">Aktif</span></td>
                <td>${btnDel}</td>
            </tr>`;
        });
    });
}

window.seedMentors = async function() {
    const dataMentors = [
        { id: "1", name: "Andik Laksono", specialist: "Music Director & Audio Engineer", email: "andigomusicpro@gmail.com", phone: "082319867817", img: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300", portfolio: ["Owner AndiGO Music Electronik", "Song Maker & Music Arranger"], profession: ["Music Performer", "Audio Engineer"] },
        { id: "2", name: "Ervansyah", specialist: "Visual Director & Multimedia", email: "yusufkonang33@gmail.com", phone: "085230659995", img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=300", portfolio: ["Owner CV. BRIEFCOM", "Fotografer & Videografer"], profession: ["Fotografer", "Desain Grafis"] },
        { id: "3", name: "Anton", specialist: "Public Speaking & Communication", email: "anton.public@smipro.id", phone: "081xxxxxxxxx", img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=300", portfolio: ["MC Event Nasional", "Trainer Komunikasi"], profession: ["Public Speaker", "Event Host"] }
    ];
    try {
        for (const m of dataMentors) await setDoc(doc(db, "mentors", m.id), m);
        alert("Data Mentor Berhasil Diupdate!");
    } catch (e) { alert("Error: " + e.message); }
}

window.deleteMentor = async function(id) {
    if(confirm("Hapus Mentor ini?")) await deleteDoc(doc(db, "mentors", id));
}

/* =========================================
   4. CMS: RADIO & JADWAL
   ========================================= */
// INI YANG BELUM ADA DI KODE LAMA ANDA
window.renderRadioForm = function() {
    const container = document.getElementById('cms-radio');
    if(!container || container.innerHTML.length > 50) return; // Mencegah render ulang

    container.innerHTML = `
    <div class="cms-form-group">
        <h4 style="margin-top:0; color:#00d2ff;">Update Jadwal Siaran (TikTok)</h4>
        
        <label class="cms-label">Sesi Siaran</label>
        <select id="radio-session" class="cms-input">
            <option value="PAGI">Pagi (09:00)</option>
            <option value="SIANG">Siang (14:00)</option>
            <option value="MALAM">Malam (19:00)</option>
        </select>

        <label class="cms-label">Judul Topik / Acara</label>
        <input type="text" id="radio-title" class="cms-input" placeholder="Contoh: Bincang Santai">

        <label class="cms-label">Nama Host</label>
        <input type="text" id="radio-host" class="cms-input" placeholder="Nama Penyiar">

        <label class="cms-label">Topik Pembahasan</label>
        <input type="text" id="radio-topic" class="cms-input" placeholder="Deskripsi Singkat">

        <div style="margin:15px 0;">
            <label style="color:white; display:flex; align-items:center; gap:10px;">
                <input type="checkbox" id="radio-live"> 
                Set sebagai <b>LIVE SEKARANG</b> (Akan muncul tombol Gabung)
            </label>
        </div>

        <button class="btn-action btn-view" onclick="saveRadioSchedule()" style="width:100%; padding:10px;">UPDATE JADWAL RADIO</button>
    </div>`;
}

window.saveRadioSchedule = async function() {
    const session = document.getElementById('radio-session').value;
    const time = session === 'PAGI' ? '09:00' : session === 'SIANG' ? '14:00' : '19:00';
    const order = session === 'PAGI' ? 1 : session === 'SIANG' ? 2 : 3;
    const theme = session === 'PAGI' ? 'morning' : session === 'SIANG' ? 'afternoon' : 'night';

    const data = {
        sessionName: session,
        time: time,
        order: order,
        theme: theme,
        title: document.getElementById('radio-title').value,
        host: document.getElementById('radio-host').value,
        topic: document.getElementById('radio-topic').value,
        isLive: document.getElementById('radio-live').checked,
        link: "https://tiktok.com/@smipro" // Default link
    };

    if(!data.title) return alert("Judul siaran harus diisi!");

    // Kita cari dulu apakah dokumen sesi ini sudah ada, kalau ada update, kalau tidak buat baru
    // Untuk simplifikasi, kita addDoc saja, nanti di radio.html kita limit/order.
    // TAPI LEBIH BAIK: Kita update berdasarkan ID sesi (agar tidak numpuk sampah)
    // Skenario simpel: Add baru saja.
    await addDoc(collection(db, "broadcasts"), data);
    alert(`Jadwal ${session} Berhasil Diupdate!`);
}

window.saveSchedule = async function() {
    const displayDate = document.getElementById('sched-display-date').value;
    const location = document.getElementById('sched-location').value;
    let performers = [];
    ['p1','p2','p3'].forEach(p => {
        const name = document.getElementById(p+'-name').value;
        if(name) {
            performers.push({
                name: name,
                time: document.getElementById(p+'-time').value,
                genre: document.getElementById(p+'-genre').value,
                img: "https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=100"
            });
        }
    });

    if(!displayDate) return alert("Tanggal wajib diisi!");

    // Cari jadwal main yang ada, update. Jika tidak ada, buat baru.
    const q = query(collection(db, "events"), where("type", "==", "main"));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        await updateDoc(doc(db, "events", snapshot.docs[0].id), { displayDate, location, performers });
        alert("Jadwal Utama Diupdate!");
    } else {
        await addDoc(collection(db, "events"), {
            type: "main", date: new Date().toISOString(), displayDate, location, statusText: "ON SCHEDULE", performers
        });
        alert("Jadwal Baru Dibuat!");
    }
}

window.saveNews = async function() {
    const title = document.getElementById('news-title').value;
    const tag = document.getElementById('news-tag').value;
    if(!title) return alert("Isi judul berita!");
    
    await addDoc(collection(db, "news"), {
        title, tag: tag || "INFO", date: "Baru saja",
        thumb: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=100"
    });
    alert("Berita Terbit!");
}

/* =========================================
   5. KEUANGAN & STATISTIK (NEW FEATURE)
   ========================================= */
function listenFinance() {
    const liveList = document.getElementById('live-req-list');
    const historyList = document.getElementById('history-req-list');
    
    // Tambahkan wadah statistik jika belum ada di HTML
    let statsContainer = document.getElementById('stats-container');
    if(!statsContainer && historyList) {
        // Inject HTML Statistik di atas riwayat
        const wrapper = document.createElement('div');
        wrapper.id = 'stats-container';
        wrapper.style.marginBottom = '20px';
        wrapper.style.padding = '15px';
        wrapper.style.background = '#222';
        wrapper.style.borderRadius = '10px';
        wrapper.innerHTML = `
            <h4 style="margin-top:0; color:gold;">🏆 Top Statistik Bulan Ini</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div>
                    <small style="color:#aaa;">Paling Banyak Disawer</small>
                    <div id="top-performer-stat" style="font-weight:bold; color:white;">-</div>
                </div>
                <div>
                    <small style="color:#aaa;">Lagu Terlaris</small>
                    <div id="top-song-stat" style="font-weight:bold; color:white;">-</div>
                </div>
            </div>
        `;
        historyList.parentNode.insertBefore(wrapper, historyList);
    }

    const q = query(collection(db, "requests"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        liveList.innerHTML = '';
        historyList.innerHTML = '';
        
        let totalDuit = 0;
        let perfStats = {};
        let songStats = {};

        if(snapshot.empty) {
            liveList.innerHTML = '<p style="text-align:center; color:#555;">Belum ada request.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;

            // Logika Statistik (Hanya yang Approved/Done)
            if(data.status === 'approved' || data.status === 'done') {
                totalDuit += parseInt(data.amount || 0);
                
                // Hitung Performer
                const p = data.performer || "Unknown";
                perfStats[p] = (perfStats[p] || 0) + 1;

                // Hitung Lagu
                const s = (data.song || "Unknown").trim().toLowerCase();
                songStats[s] = (songStats[s] || 0) + 1;
            }

            // Render List Live (Pending)
            if (data.status === 'pending') {
                liveList.innerHTML += `
                <div style="background:#332b00; padding:10px; margin-bottom:10px; border-left:4px solid #FFD700; border-radius:5px;">
                    <div style="display:flex; justify-content:space-between;">
                        <b style="color:white;">${data.song}</b>
                        <span style="background:gold; color:black; padding:2px 5px; border-radius:3px; font-weight:bold;">Rp ${parseInt(data.amount).toLocaleString()}</span>
                    </div>
                    <p style="color:#ccc; font-size:0.9rem; margin:5px 0;">"${data.message}"</p>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <small style="color:#aaa;">Utk: ${data.performer}</small>
                        <div>
                            <button onclick="deleteReq('${id}')" style="background:#333; color:red; border:1px solid #555; cursor:pointer; padding:5px;"><i class="fa-solid fa-trash"></i></button>
                            <button onclick="verifyPayment('${id}')" style="background:#2ecc71; border:none; padding:5px 10px; border-radius:3px; font-weight:bold; cursor:pointer;">ACC</button>
                        </div>
                    </div>
                </div>`;
            } else {
                // Render Riwayat
                historyList.innerHTML += `
                <div style="border-bottom:1px solid #333; padding:10px 0; display:flex; justify-content:space-between;">
                    <div><b style="color:white;">${data.song}</b><br><small style="color:#00d2ff;">${data.performer}</small></div>
                    <div style="text-align:right;"><span style="color:#2ecc71;">+ ${parseInt(data.amount).toLocaleString()}</span><br><small style="color:#555;">${data.status}</small></div>
                </div>`;
            }
        });

        // Update Total
        document.getElementById('total-revenue-live').innerText = "Rp " + totalDuit.toLocaleString('id-ID');

        // Update Statistik
        updateStatUI('top-performer-stat', perfStats);
        updateStatUI('top-song-stat', songStats);
    });
}

function updateStatUI(elementId, statsObj) {
    const el = document.getElementById(elementId);
    if(!el) return;
    
    // Cari yang terbanyak
    let maxKey = "-";
    let maxVal = 0;
    
    for (const [key, value] of Object.entries(statsObj)) {
        if(value > maxVal) {
            maxVal = value;
            maxKey = key;
        }
    }
    
    if(maxVal > 0) {
        // Capitalize string
        const display = maxKey.replace(/\b\w/g, l => l.toUpperCase());
        el.innerText = `${display} (${maxVal})`;
    } else {
        el.innerText = "-";
    }
}

window.verifyPayment = async function(id) {
    if(confirm("Konfirmasi dana masuk?")) await updateDoc(doc(db, "requests", id), { status: 'approved' });
}

window.deleteReq = async function(id) {
    if(confirm("Hapus request?")) await deleteDoc(doc(db, "requests", id));
}

// JALANKAN SAAT LOAD
initStats();
loadMitraData();
loadMentorData();
listenFinance();
