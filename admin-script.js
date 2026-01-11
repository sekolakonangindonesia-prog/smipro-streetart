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
    else console.error("View tidak ditemukan: " + viewId);
    
    // Auto Load Data Khusus
    if(viewId === 'finance') loadFinanceStats(); 
    if(viewId === 'cms') loadArtistDropdowns(); 
    if(viewId === 'students') loadStudentData();
    if(viewId === 'mitra') loadMitraData();
    if(viewId === 'performer') loadPerformerData();
    if(viewId === 'mentor') loadMentorData();

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
        localStorage.clear();
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
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum ada performer.<br><button class="btn-action btn-edit" onclick="seedPerformer()">+ Buat Performer Test</button></td></tr>`;
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
    if(confirm("Luluskan performer ini?")) {
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
   5. CMS MODULE
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
    const displayDate = document.getElementById('sched-display-date').value;
    const realDate = document.getElementById('sched-real-date').value;
    const location = document.getElementById('sched-location').value;
    
    // Simplifikasi performer
    const performers = [1,2,3].map(i => ({
        name: document.getElementById(`p${i}-name`).value,
        time: document.getElementById(`p${i}-time`).value,
        genre: "Live Music"
    })).filter(p => p.name);

    if(confirm("Publish Jadwal?")) {
        await addDoc(collection(db, "events"), {
            type: "main", displayDate, date: realDate, location, performers
        });
        alert("Jadwal Dipublish!");
    }
}

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
    if(confirm("Publish Berita?")) {
        await addDoc(collection(db, "news"), {
            title: document.getElementById('news-title').value,
            tag: document.getElementById('news-tag').value,
            thumb: document.getElementById('news-thumb').value,
            type: document.getElementById('news-type').value,
            url: document.getElementById('news-url').value,
            content: document.getElementById('news-content').value,
            date: new Date().toLocaleDateString('id-ID'),
            timestamp: new Date()
        });
        alert("Berita Terbit!");
    }
}

window.savePodcast = async function() {
    if(confirm("Publish Podcast?")) {
        await addDoc(collection(db, "podcasts"), {
            title: document.getElementById('pod-title').value,
            host: document.getElementById('pod-host').value,
            duration: document.getElementById('pod-duration').value,
            link: document.getElementById('pod-link').value,
            thumb: document.getElementById('pod-thumb').value,
            order: parseInt(document.getElementById('pod-order').value),
            timestamp: new Date()
        });
        alert("Podcast Terbit!");
    }
}

/* =========================================
   6. COMMAND CENTER (LIVE MONITOR & STATISTIK)
   ========================================= */

window.loadFinanceStats = function() {
    renderFinanceData(); 
    listenCommandCenter(); 
}

// A. LISTENER UTAMA (MONITOR & VALIDASI)
let monitorUnsubscribe = null;

function listenCommandCenter() {
    const pendingContainer = document.getElementById('list-pending');
    const liveContainer = document.getElementById('list-approved');
    if(!pendingContainer || !liveContainer) return;

    const q = query(collection(db, "requests"), where("status", "in", ["pending", "approved"]));

    if(monitorUnsubscribe) monitorUnsubscribe();

    monitorUnsubscribe = onSnapshot(q, (snapshot) => {
        pendingContainer.innerHTML = '';
        liveContainer.innerHTML = '';
        
        let hasPending = false;
        let hasLive = false;

        let requests = [];
        snapshot.forEach(doc => requests.push({id: doc.id, ...doc.data()}));
        requests.sort((a,b) => a.timestamp - b.timestamp);

        requests.forEach(d => {
            const time = d.timestamp ? new Date(d.timestamp.toDate()).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-';
            const htmlItem = `
            <div class="req-item ${d.status}">
                <div class="req-amount">Rp ${parseInt(d.amount).toLocaleString()}</div>
                <small style="color:#888;">${time} • Dari: <b style="color:#00d2ff;">${d.sender}</b></small>
                <h4 style="margin:5px 0; color:white;">${d.song}</h4>
                <p style="margin:0; font-size:0.8rem; color:#ccc;">"${d.message}"</p>
                <small style="color:#aaa;">Untuk: ${d.performer}</small>
                <div style="margin-top:10px;">
                ${d.status === 'pending' ? 
                    `<button class="btn-control btn-approve" onclick="approveReq('${d.id}')"><i class="fa-solid fa-check"></i> TERIMA DANA</button>
                     <button class="btn-action btn-delete" onclick="deleteReq('${d.id}')" style="margin-top:5px; width:100%;"><i class="fa-solid fa-trash"></i> Tolak</button>` : 
                    `<button class="btn-control btn-finish" onclick="finishReq('${d.id}')"><i class="fa-solid fa-flag-checkered"></i> SELESAI (ARSIP)</button>`
                }
                </div>
            </div>`;

            if(d.status === 'pending') { pendingContainer.innerHTML += htmlItem; hasPending = true; } 
            else { liveContainer.innerHTML += htmlItem; hasLive = true; }
        });

        if(!hasPending) pendingContainer.innerHTML = '<p class="empty-state">Tidak ada request baru.</p>';
        if(!hasLive) liveContainer.innerHTML = '<p class="empty-state">Panggung sepi.</p>';
    });
}

// B. STATISTIK
let statsUnsubscribe = null;

function renderFinanceData() {
    const filter = document.getElementById('stats-filter').value;
    const tbody = document.getElementById('table-history-body');
    const q = query(collection(db, "requests"), where("status", "==", "finished"), orderBy("timestamp", "desc"));

    if(statsUnsubscribe) statsUnsubscribe();

    statsUnsubscribe = onSnapshot(q, (snapshot) => {
        let totalMoney = 0;
        let totalReq = 0;
        let historyHTML = '';

        snapshot.forEach(doc => {
            const d = doc.data();
            totalMoney += parseInt(d.amount);
            totalReq++;
            historyHTML += `<tr><td>-</td><td><b>${d.song}</b></td><td style="color:#00ff00;">Rp ${parseInt(d.amount).toLocaleString()}</td></tr>`;
        });

        document.getElementById('stat-total-money').innerText = "Rp " + totalMoney.toLocaleString();
        document.getElementById('stat-total-req').innerText = totalReq;
        tbody.innerHTML = historyHTML || '<tr><td colspan="3">Kosong.</td></tr>';
    });
}

// C. ACTION BUTTONS
window.approveReq = async function(id) {
    if(confirm("Uang masuk?")) await updateDoc(doc(db, "requests", id), { status: 'approved' });
}
window.finishReq = async function(id) {
    if(confirm("Arsipkan?")) await updateDoc(doc(db, "requests", id), { status: 'finished' });
}
window.deleteReq = async function(id) {
    if(confirm("Tolak?")) await deleteDoc(doc(db, "requests", id));
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
