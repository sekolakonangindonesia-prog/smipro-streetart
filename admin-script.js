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
    if(viewId === 'cms') loadArtistDropdowns(); 
    if(viewId === 'students') loadStudentData(); // Pastikan siswa dimuat saat menu diklik

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

// --- FUNGSI SEED MENTOR (DATA REAL SESUAI WHATSAPP) ---
window.seedMentors = async function() {
    const mentorsData = [
        {
            name: "Andik Laksono",
            email: "andigomusicpro@gmail.com",
            phone: "082319867817",
            specialist: "Musik & Audio Engineering",
            img: "https://via.placeholder.com/150",
            portfolio: [
                "Owner AndiGO music Electronik",
                "SongWriter & Music Arranger",
                "Sound & Audio Engineers",
                "Audio & Music Recording",
                "Lead & Vocal instructor",
                "Audio, Sound & Music Conceptor",
                "" // Slot 7 Kosong
            ],
            profession: [
                "Music performer",
                "Audio engineer",
                "Store Owner of AndiGO Music Electronik",
                "", "", "", ""
            ]
        },
        {
            name: "Ervansyah",
            email: "yusufkonang33@gmail.com",
            phone: "085230659995",
            specialist: "Visual Management",
            img: "https://via.placeholder.com/150",
            portfolio: [
                "Owner CV. BRIEFCOM",
                "Fotografer",
                "Videografer",
                "Desain dan Percetakan",
                "", "", ""
            ],
            profession: [
                "Fotografer",
                "Videografer",
                "Design grafis",
                "Produser",
                "Sutradara",
                "Content Writer",
                "Editor"
            ]
        },
        {
            name: "Antony",
            email: "gustinara.top@gmail.com",
            phone: "085859823588",
            specialist: "Public Relations",
            img: "https://via.placeholder.com/150",
            portfolio: [
                "SongWriterr & Music Arranger",
                "Broadcasting Journalism",
                "Public speaking",
                "Public Relations",
                "", "", ""
            ],
            profession: [
                "Program Director",
                "Audio engineer",
                "Owner Sekola Konang Indonesia",
                "", "", "", ""
            ]
        }
    ];

    if(confirm("Hapus Data Lama & Masukkan 3 Mentor FIX (Andik, Ervan, Antony)?")) {
        try {
            // Kita loop untuk memasukkan data satu per satu
            for (const m of mentorsData) {
                await addDoc(collection(db, "mentors"), m);
            }
            alert("SUKSES! Data Mentor di Database sudah diperbarui sesuai WhatsApp.");
            loadMentorData(); 
        } catch (e) {
            alert("Gagal: " + e.message);
        }
    }
}

// --- FIX: LOGIN SEBAGAI MENTOR ---
window.loginAsMentor = function(id, name) {
    if(confirm(`Masuk ke Dashboard ${name}?`)) {
        // Hapus sisa-sisa login lama biar bersih
        localStorage.clear(); 
        
        // Set Data Baru
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userRole', 'mentor');
        localStorage.setItem('userName', name);
        localStorage.setItem('userLink', 'mentor-dashboard.html'); 
        
        // INI KUNCINYA: ID HARUS DISIMPAN SEBAGAI 'mentorId'
        localStorage.setItem('mentorId', id); 
        
        // Tanda kalau ini Admin yang nyamar
        localStorage.setItem('adminOrigin', 'true');
        localStorage.setItem('adminReturnTab', 'mentor');
        
        window.location.href = 'mentor-dashboard.html';
    }
}
window.deleteMentor = async function(id) { if(confirm("Hapus?")) await deleteDoc(doc(db, "mentors", id)); }

/* =========================================
   4. MANAJEMEN SISWA (BENGKEL)
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
        await addDoc(collection(db, "students"), {
            name: name,
            genre: genre,
            img: img,
            scores: {}, 
            status: "training", 
            timestamp: new Date()
        });
        
        alert("Siswa berhasil masuk Bengkel!");
        document.getElementById('new-student-name').value = '';
        document.getElementById('new-student-genre').value = '';
        document.getElementById('student-preview').src = "https://via.placeholder.com/100?text=Foto";
        currentStudentBase64 = null;
    }
}

async function loadStudentData() {
    const tbody = document.getElementById('student-table-body');
    if(!tbody) return;

    onSnapshot(query(collection(db, "students"), orderBy("timestamp", "desc")), (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada siswa dalam pelatihan.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const scores = Object.values(data.scores || {});
            let scoreText = `<span style="color:#888;">Belum dinilai</span>`;
            
            if(scores.length > 0) {
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                scoreText = `<b style="color:gold;">Rata-rata: ${avg.toFixed(1)}</b> (${scores.length} Mentor)`;
                if (scores.length >= 3 && avg >= 90) {
                    scoreText += `<br><span style="color:#00ff00; font-size:0.8rem;">SIAP LULUS!</span>`;
                }
            }

            const btnDel = `<button class="btn-action btn-delete" onclick="deleteStudent('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>`;
            const imgHTML = `<img src="${data.img}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #555;">`;

            tbody.innerHTML += `
            <tr>
                <td>${imgHTML}</td>
                <td><b>${data.name}</b></td>
                <td>${data.genre}</td>
                <td>${scoreText}</td>
                <td>${btnDel}</td>
            </tr>`;
        });
    });
}

window.deleteStudent = async function(id) {
    if(confirm("Hapus siswa dari Bengkel?")) await deleteDoc(doc(db, "students", id));
}

/* =========================================
   5. CMS MODULE (JADWAL, RADIO, BERITA)
   ========================================= */

// ISI DROPDOWN ARTIS OTOMATIS
async function loadArtistDropdowns() {
    const selects = ['p1-name', 'p2-name', 'p3-name'];
    const q = query(collection(db, "performers"), orderBy("name", "asc"));
    const snapshot = await getDocs(q);
    
    let optionsHTML = '<option value="">-- Pilih Artis --</option><option value="Lainnya">Lainnya / Band Luar</option>';
    
    snapshot.forEach(doc => {
        const data = doc.data();
        optionsHTML += `<option value="${data.name}">${data.name}</option>`;
    });

    selects.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = optionsHTML;
    });
}

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
    ].filter(p => p.name !== "" && p.name !== "Lainnya"); 

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

// RADIO
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

// BERITA
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

// --- FITUR BARU: TOGGLE FORM BERITA vs PODCAST ---
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

// --- FITUR BARU: SIMPAN PODCAST KE FIREBASE ---
window.savePodcast = async function() {
    const title = document.getElementById('pod-title').value;
    const host = document.getElementById('pod-host').value;
    const duration = document.getElementById('pod-duration').value;
    const link = document.getElementById('pod-link').value;
    const thumb = document.getElementById('pod-thumb').value;
    const order = parseInt(document.getElementById('pod-order').value) || 1;

    if(!title || !link) return alert("Judul dan Link wajib diisi!");

    if(confirm("Publish Episode Podcast ini?")) {
        try {
            await addDoc(collection(db, "podcasts"), {
                title: title,
                host: host || "Admin",
                duration: duration || "Unknown",
                link: link,
                thumb: thumb || "https://via.placeholder.com/300x200?text=Podcast",
                order: order,
                timestamp: new Date()
            });
            alert("Podcast Berhasil Dipublish!");
            // Reset Form
            document.getElementById('pod-title').value = '';
            document.getElementById('pod-link').value = '';
        } catch(e) {
            alert("Error: " + e.message);
        }
    }
}

/* =========================================
   6. MODUL KEUANGAN & LIVE COMMAND CENTER
   ========================================= */

window.loadFinanceStats = function() {
    renderFinanceData(); 
    renderLiveMonitor(); 
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

// LOGIKA KOLOM KIRI (LIVE MONITOR)
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
   7. SEED VENUES (Hanya Dipanggil Sekali)
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
   8. EKSEKUSI AWAL & AUTO RETURN
   ========================================= */
// Load data utama saat pertama kali dibuka
loadMitraData();
loadPerformerData();
loadMentorData();
loadStudentData(); // <-- JANGAN LUPA INI AGAR SISWA MUNCUL

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
