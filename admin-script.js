import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, orderBy, doc, updateDoc, addDoc, deleteDoc, onSnapshot, where, limit, setDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================
   0. LOGIKA NAVIGASI (SIDEBAR & TABS)
   ========================================= */

window.showView = function(viewId, btn) {
    document.querySelectorAll('.admin-view').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('view-' + viewId);
    if(target) target.classList.remove('hidden');
    else console.error("View tidak ditemukan: " + viewId);
    
    // --- UPDATED: Panggil Overview saat dashboard diklik ---
    if(viewId === 'dashboard') loadDashboardOverview(); 
    
    if(viewId === 'finance') { renderFinanceData(); listenCommandCenter(); }
    if(viewId === 'cms') loadArtistDropdowns(); 
    if(viewId === 'students') loadStudentData();
    if(viewId === 'mitra') loadMitraData();
    if(viewId === 'performer') loadPerformerData();
    if(viewId === 'mentor') loadMentorData();
    if(viewId === 'cafe') { loadCafeData();
        // Reset sub tab ke data
        switchCafeTab('cafe-data', document.querySelector('.sub-tab-btn')); 
    }

    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    if(btn) btn.classList.add('active');
}

window.switchCmsTab = function(tabId, btn) {
    document.querySelectorAll('.cms-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    if(tabId === 'cms-schedule') loadActiveSchedules();
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

    // 1. Cek dulu: Ada berapa Total Mentor di sistem?
    const mentorSnap = await getDocs(collection(db, "mentors"));
    const totalMentors = mentorSnap.size; 

    // 2. Ambil data Siswa
    const q = query(collection(db, "students"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        
        if(snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#666;">Belum ada siswa di bengkel.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Hitung berapa mentor yang sudah nilai
            // data.scores bentuknya object: { "id_mentor_A": 90, "id_mentor_B": 80 }
            const scores = data.scores || {};
            const jumlahDinilai = Object.keys(scores).length;
            
            // Status Progress
            let statusHTML = '';
            if (jumlahDinilai === 0) {
                statusHTML = `<span style="color:#888;">Belum ada nilai</span>`;
            } else if (jumlahDinilai < totalMentors) {
                statusHTML = `<span style="color:orange;">Proses: ${jumlahDinilai} / ${totalMentors} Mentor</span>`;
            } else {
                statusHTML = `<span style="color:#00ff00; font-weight:bold;">Selesai (${jumlahDinilai}/${totalMentors})</span>`;
            }

            // Tombol Aksi (Lihat Raport & Hapus)
            // Tombol 'Lihat Raport' saya siapkan kerangkanya dulu (onclick dummy)
            const actionBtns = `
                <div style="display:flex; gap:5px;">
                    <button class="btn-action btn-view" onclick="openRaport('${id}')" title="Lihat Raport Detail">
                        <i class="fa-solid fa-list-check"></i>
                    </button>
                    
                    <button class="btn-action btn-delete" onclick="deleteStudent('${id}', '${data.name}')" title="Hapus Siswa">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            const imgHTML = `<img src="${data.img}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #555;">`;

            tbody.innerHTML += `
            <tr>
                <td>${imgHTML}</td>
                <td><b>${data.name}</b></td>
                <td>${data.genre}</td>
                <td>${statusHTML}</td>
                <td>${actionBtns}</td>
            </tr>`;
        });
    });
}

// --- FUNGSI LIHAT RAPORT DETAIL ---
window.openRaport = async function(studentId) {
    const modal = document.getElementById('modal-raport');
    const tbody = document.getElementById('raport-list-body');
    
    // 1. Ambil Data Siswa
    const studentSnap = await getDoc(doc(db, "students", studentId));
    if(!studentSnap.exists()) return alert("Data siswa tidak ditemukan!");
    const sData = studentSnap.data();
    const sScores = sData.scores || {};

    // Isi Header Modal
    document.getElementById('rap-name').innerText = sData.name;
    document.getElementById('rap-genre').innerText = sData.genre;
    document.getElementById('rap-img').src = sData.img;

    // 2. Ambil Semua Data Mentor
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Memuat Data Mentor...</td></tr>';
    modal.style.display = 'flex'; // Tampilkan modal dulu

    const mentorSnap = await getDocs(collection(db, "mentors"));
    tbody.innerHTML = ''; // Bersihkan loading

    // 3. Loop Mentor & Cek Nilai
    mentorSnap.forEach(mDoc => {
        const mData = mDoc.data();
        const mID = mDoc.id;
        
        // Cek apakah mentor ini ada di daftar nilai siswa?
        const nilai = sScores[mID]; 
        
        let statusNilai = '';
        
        if (nilai !== undefined) {
            // Mentor SUDAH Menilai
            if(nilai >= 75) {
                statusNilai = `<b style="color:#00ff00;">${nilai} (Lulus)</b>`;
            } else {
                statusNilai = `<b style="color:red;">${nilai} (Remidi)</b>`;
            }
        } else {
            // Mentor BELUM Menilai
            statusNilai = `<span style="color:#ffeb3b; font-style:italic;">⏳ Belum Menilai</span>`;
        }

        tbody.innerHTML += `
        <tr>
            <td>${mData.name}</td>
            <td><small style="color:#aaa;">${mData.specialist}</small></td>
            <td>${statusNilai}</td>
        </tr>`;
    });
}

window.deleteStudent = async function(id, name) {
    // Konfirmasi ganda biar aman
    if(confirm(`YAKIN MENGHAPUS SISWA: ${name}?\n\nData nilai dan foto akan hilang permanen.`)) {
        try {
            await deleteDoc(doc(db, "students", id));
            // Tidak perlu alert sukses, karena tabel otomatis update (realtime)
        } catch (e) {
            alert("Gagal menghapus: " + e.message);
        }
    }
}

// --- FUNGSI LIHAT RAPORT DETAIL (POP-UP) ---
window.openRaport = async function(studentId) {
    const modal = document.getElementById('modal-raport');
    const tbody = document.getElementById('raport-list-body');
    
    // Cek apakah Modal HTML sudah ada?
    if(!modal) {
        alert("Error: Kode HTML Modal Raport belum dipasang di admin-dashboard.html");
        return;
    }

    // 1. Tampilkan Modal & Loading
    modal.style.display = 'flex';
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Memuat Data...</td></tr>';

    try {
        // 2. Ambil Data Siswa
        const studentSnap = await getDoc(doc(db, "students", studentId));
        if(!studentSnap.exists()) {
            alert("Data siswa tidak ditemukan!");
            modal.style.display = 'none';
            return;
        }
        const sData = studentSnap.data();
        const sScores = sData.scores || {};

        // Isi Header Modal
        document.getElementById('rap-name').innerText = sData.name;
        document.getElementById('rap-genre').innerText = sData.genre;
        document.getElementById('rap-img').src = sData.img || "https://via.placeholder.com/150";

        // 3. Ambil Semua Data Mentor untuk dibandingkan
        const mentorSnap = await getDocs(collection(db, "mentors"));
        tbody.innerHTML = ''; // Bersihkan loading

        // 4. Loop Mentor & Cek Nilai
        mentorSnap.forEach(mDoc => {
            const mData = mDoc.data();
            const mID = mDoc.id;
            
            // Cek apakah mentor ini ada di daftar nilai siswa?
            const nilai = sScores[mID]; 
            
            let statusNilai = '';
            
            if (nilai !== undefined) {
                // Mentor SUDAH Menilai
                if(nilai >= 75) {
                    statusNilai = `<b style="color:#00ff00;">${nilai} (Lulus)</b>`;
                } else {
                    statusNilai = `<b style="color:red;">${nilai} (Remidi)</b>`;
                }
            } else {
                // Mentor BELUM Menilai
                statusNilai = `<span style="color:#ffeb3b; font-style:italic;">⏳ Belum Menilai</span>`;
            }

            tbody.innerHTML += `
            <tr>
                <td>${mData.name}</td>
                <td><small style="color:#aaa;">${mData.specialist}</small></td>
                <td>${statusNilai}</td>
            </tr>`;
        });
    } catch (e) {
        console.error(e);
        alert("Gagal memuat raport: " + e.message);
    }
}

/* =========================================
   5. CMS MODULE (JADWAL, RADIO, BERITA, PODCAST)
   ========================================= */

// ISI DROPDOWN ARTIS OTOMATIS (Jadwal Utama & Radio)
async function loadArtistDropdowns() {
    console.log("Mengambil data artis dari database...");
    
    // Ambil data dari Firebase
    const q = query(collection(db, "performers"), orderBy("name", "asc"));
    const snapshot = await getDocs(q);
    
    // Buat HTML Option
    let optionsHTML = '<option value="">-- Pilih Artis / Host --</option>';
    
    snapshot.forEach(doc => {
        const data = doc.data();
        optionsHTML += `<option value="${data.name}">${data.name}</option>`;
    });

    // Tambahan Opsi Manual (jika hostnya bukan artis terdaftar)
    optionsHTML += '<option value="Admin / DJ Tamu">Admin / DJ Tamu</option>';

    // --- BAGIAN PENTING: Masukkan opsi ke ID-ID dropdown ini ---
    const targetDropdowns = ['p1-name', 'p2-name', 'p3-name', 'radio-host']; // 'radio-host' ditambahkan disini
    
    targetDropdowns.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.innerHTML = optionsHTML;
        }
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
// MEMUAT LIST JADWAL AGAR BISA DIHAPUS
async function loadActiveSchedules() {
    const tbody = document.getElementById('cms-schedule-list-body');
    if(!tbody) return;

    // Ambil data events, urutkan dari tanggal terdekat
    const q = query(collection(db, "events"), orderBy("date", "asc"));
    
    // Gunakan onSnapshot agar kalau dihapus langsung hilang dari tabel tanpa refresh
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="3" align="center">Tidak ada jadwal aktif.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            // Tombol Hapus Merah
            const btnDelete = `
            <button class="btn-action btn-delete" onclick="deleteSchedule('${doc.id}')" title="Batalkan Jadwal">
                <i class="fa-solid fa-trash"></i> Hapus
            </button>`;

            tbody.innerHTML += `
            <tr>
                <td>
                    <b>${data.displayDate}</b><br>
                    <small style="color:#888;">${data.date}</small>
                </td>
                <td>${data.location}</td>
                <td>${btnDelete}</td>
            </tr>`;
        });
    });
}

// FUNGSI HAPUS JADWAL
window.deleteSchedule = async function(id) {
    if(confirm("Yakin ingin MEMBATALKAN/MENGHAPUS jadwal ini? Data akan hilang dari website utama.")) {
        await deleteDoc(doc(db, "events", id));
        // Tidak perlu alert, karena onSnapshot akan otomatis update tabel
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

// PODCAST
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
    // Load Data Awal
    loadDashboardOverview(); // <-- PENTING: Agar angka tidak 0 saat pertama buka
    
    // Load data lain di background agar cepat saat pindah tab
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

/* =========================================
   8. LOGIC OVERVIEW & NOTIFIKASI (BARU)
   ========================================= */

async function loadDashboardOverview() {
    console.log("Memuat Data Overview...");

    // 1. HITUNG DATA STATISTIK (Mitra & Performer)
    const mitraSnap = await getDocs(collection(db, "warungs"));
    const perfSnap = await getDocs(collection(db, "performers"));
    
    // Update Angka di Kotak Atas
    const elMitra = document.getElementById('count-mitra');
    const elPerf = document.getElementById('count-perf');
    const elRev = document.getElementById('total-revenue');

    if(elMitra) elMitra.innerText = mitraSnap.size;
    if(elPerf) elPerf.innerText = perfSnap.size;

    // 2. HITUNG TOTAL SAWERAN (Hanya untuk Angka di Kotak Atas)
    const moneySnap = await getDocs(collection(db, "requests"));
    let totalPending = 0;
    moneySnap.forEach(doc => {
        if(doc.data().status === 'pending') {
            totalPending += parseInt(doc.data().amount);
        }
    });
    if(elRev) elRev.innerText = "Rp " + totalPending.toLocaleString();


    // 3. GENERATE NOTIFIKASI OTOMATIS (Tanpa Saweran)
    const notifArea = document.getElementById('admin-notification-area');
    if(!notifArea) return; // Jaga-jaga error

    notifArea.innerHTML = ''; // Bersihkan dulu
    let adaNotif = false;

    // A. CEK MITRA (Meja > 15 & Belum Approved)
    mitraSnap.forEach(doc => {
        const d = doc.data();
        if(d.totalTables > 15 && !d.adminApproved) {
            adaNotif = true;
            notifArea.innerHTML += `
            <div class="notif-card urgent">
                <div class="notif-content">
                    <h4><i class="fa-solid fa-store"></i> Approval Mitra Besar</h4>
                    <p><b>${d.name}</b> mendaftarkan ${d.totalTables} meja. Perlu persetujuan Admin.</p>
                </div>
                <div class="notif-action">
                    <button class="btn-action btn-view" onclick="showView('mitra')">Lihat Detail</button>
                </div>
            </div>`;
        }
    });

    // B. CEK SISWA BENGKEL (Nilai Rata-rata >= 90 & Belum Lulus)
    const siswaSnap = await getDocs(collection(db, "students"));
    siswaSnap.forEach(doc => {
        const d = doc.data();
        const scores = Object.values(d.scores || {});
        if(scores.length > 0) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            
            if(avg >= 90 && d.status === 'training') {
                adaNotif = true;
                notifArea.innerHTML += `
                <div class="notif-card success">
                    <div class="notif-content">
                        <h4><i class="fa-solid fa-graduation-cap"></i> Siswa Siap Lulus</h4>
                        <p><b>${d.name}</b> nilai rata-rata <b>${avg.toFixed(1)}</b>. Terbitkan Sertifikat?</p>
                    </div>
                    <div class="notif-action">
                        <button class="btn-action btn-edit" onclick="luluskanSiswa('${doc.id}', '${d.name}', '${d.genre}')">Terbitkan</button>
                    </div>
                </div>`;
            }
        }
    });

    // Jika Tidak Ada Notif
    if(!adaNotif) {
        notifArea.innerHTML = `
        <div class="empty-state-box">
            <i class="fa-solid fa-check-circle" style="font-size:2rem; color:#333; margin-bottom:10px;"></i>
            <p>Semua aman. Tidak ada notifikasi baru.</p>
        </div>`;
    }
}

// Fungsi Helper untuk Luluskan Siswa
window.luluskanSiswa = async function(id, name, genre) {
    if(confirm(`Luluskan ${name} dan jadikan Performer Resmi?`)) {
        await addDoc(collection(db, "performers"), {
            name: name, genre: genre, verified: true, 
            img: "https://via.placeholder.com/150", rating: 5.0, 
            gallery: [], certified_date: new Date()
        });
        await updateDoc(doc(db, "students", id), { status: 'graduated' });
        alert("Berhasil! Siswa kini menjadi Performer Resmi.");
        loadDashboardOverview(); 
    }
}

/* =========================================
   9. MODUL LAPORAN STATISTIK WARUNG
   ========================================= */

// Fungsi Pindah Tab Mitra
window.switchMitraTab = function(tabId, btn) {
    document.querySelectorAll('.mitra-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    // Reset active class tombol (manual selector karena class sama)
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Jika buka tab statistik, load datanya
    if(tabId === 'mitra-stats') loadWarungStatistics();
}

async function loadWarungStatistics() {
    const filter = document.getElementById('report-filter').value;
    const tbody = document.getElementById('warung-ranking-body');
    
    // Ambil SEMUA data booking yang sudah selesai (finished)
    const q = query(collection(db, "bookings"), where("status", "==", "finished"));
    const snapshot = await getDocs(q);

    let totalVisitor = 0;
    let totalTrx = 0;
    let totalOmzet = 0;
    let warungStats = {}; // Object untuk menampung data per warung

    const now = new Date();
    
    snapshot.forEach(doc => {
        const d = doc.data();
        const date = d.finishedAt ? d.finishedAt.toDate() : new Date(); // Fallback date
        
        // Filter Waktu
        let include = false;
        if(filter === 'all') include = true;
        else if (filter === 'month') {
            if(date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) include = true;
        } 
        else if (filter === 'week') {
            const oneWeekAgo = new Date(); 
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            if(date >= oneWeekAgo) include = true;
        }

        if(include) {
            // Hitung Global
            totalVisitor += parseInt(d.pax || 0);
            totalTrx++;
            totalOmzet += parseInt(d.revenue || 0);

            // Hitung Per Warung
            const wName = d.warungName || "Unknown";
            if(!warungStats[wName]) {
                warungStats[wName] = { name: wName, trx: 0, pax: 0, omzet: 0 };
            }
            warungStats[wName].trx++;
            warungStats[wName].pax += parseInt(d.pax || 0);
            warungStats[wName].omzet += parseInt(d.revenue || 0);
        }
    });

    // Update Angka Atas
    document.getElementById('stat-total-visitor').innerText = totalVisitor;
    document.getElementById('stat-total-trx').innerText = totalTrx;
    document.getElementById('stat-total-omzet').innerText = "Rp " + totalOmzet.toLocaleString();

    // Render Tabel Ranking
    tbody.innerHTML = '';
    
    // Convert Object to Array & Sort by Omzet (Tertinggi)
    const sortedWarung = Object.values(warungStats).sort((a,b) => b.omzet - a.omzet);

    if(sortedWarung.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada data transaksi.</td></tr>';
        return;
    }

    sortedWarung.forEach((w, index) => {
        let rankBadge = index + 1;
        if(index === 0) rankBadge = '🥇';
        if(index === 1) rankBadge = '🥈';
        if(index === 2) rankBadge = '🥉';

        tbody.innerHTML += `
        <tr>
            <td style="font-size:1.2rem; text-align:center;">${rankBadge}</td>
            <td><b>${w.name}</b></td>
            <td>${w.trx}</td>
            <td>${w.pax} Orang</td>
            <td style="color:#00ff00;">Rp ${w.omzet.toLocaleString()}</td>
        </tr>`;
    });
}

// Fungsi Cetak PDF (Menggunakan jsPDF)
window.generateReportPDF = function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("LAPORAN STATISTIK UMKM SMIPRO", 105, 20, null, null, "center");
    
    doc.setFontSize(12);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 105, 30, null, null, "center");

    // Ambil data dari HTML Tabel (Sederhana)
    let y = 50;
    doc.text("Peringkat  |  Nama Warung  |  Transaksi  |  Omzet", 20, y);
    doc.line(20, y+2, 190, y+2);
    
    const rows = document.querySelectorAll('#warung-ranking-body tr');
    rows.forEach(row => {
        y += 10;
        const cols = row.querySelectorAll('td');
        if(cols.length > 1) { // Hindari baris "kosong"
            const txt = `${cols[0].innerText}   ${cols[1].innerText}   (${cols[2].innerText})   ${cols[4].innerText}`;
            doc.text(txt, 20, y);
        }
    });

    doc.save("Laporan_UMKM_SMIPRO.pdf");
}

/* =========================================
   10. MODUL CAFE & PUSAT KONTROL TOUR
   ========================================= */

// Navigasi Tab Cafe
window.switchCafeTab = function(tabId, btn) {
    document.querySelectorAll('.cafe-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');

    if(tabId === 'cafe-report') prepareReportFilters(); 
}

// --- A. MANAJEMEN CAFE ---
let currentCafeBase64 = null;

window.previewCafeImg = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentCafeBase64 = e.target.result;
            document.getElementById('cafe-preview').src = currentCafeBase64;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

window.saveCafe = async function() {
    const id = document.getElementById('cafe-edit-id').value; 
    const name = document.getElementById('new-cafe-name').value;
    const addr = document.getElementById('new-cafe-address').value;
    const img = currentCafeBase64; 

    if(!name) return alert("Nama Cafe wajib diisi!");

    if(id) {
        // --- MODE EDIT (UPDATE) ---
        if(confirm("Simpan perubahan data cafe ini?")) {
            const updateData = { name: name, address: addr };
            if(img) updateData.img = img; 
            
            await updateDoc(doc(db, "venues_partner", id), updateData);
            alert("Data Cafe Diperbarui!");
            resetCafeForm();
        }
    } else {
        // --- MODE BARU (ADD) ---
        if(confirm("Tambah Cafe Partner Baru?")) {
            await addDoc(collection(db, "venues_partner"), {
                name: name,
                address: addr,
                img: img || "https://via.placeholder.com/100?text=Cafe", 
                type: 'cafe',
                joinedAt: new Date()
            });
            alert("Cafe Partner Ditambahkan!");
            resetCafeForm();
        }
    }
}

async function loadCafeData() {
    const tbody = document.getElementById('cafe-table-body');
    if(!tbody) return;

    onSnapshot(collection(db, "venues_partner"), (snap) => {
        tbody.innerHTML = '';
        if(snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada partner.</td></tr>';
            return;
        }

        snap.forEach(doc => {
            const d = doc.data();
            const linkSawer = `cafe-live.html?loc=${encodeURIComponent(d.name)}`;
            
            // --- PERBAIKAN DISINI ---
            // Tombol Edit memanggil editCafe
            const btnEdit = `<button class="btn-action btn-edit" onclick="editCafe('${doc.id}', '${d.name}', '${d.address}', '${d.img}')"><i class="fa-solid fa-pen"></i></button>`;
            
            // Tombol Hapus SEKARANG MEMANGGIL deleteCafe (Bukan deleteDocItem lagi)
            const btnDel = `<button class="btn-action btn-delete" onclick="deleteCafe('${doc.id}')"><i class="fa-solid fa-trash"></i></button>`;

            tbody.innerHTML += `
            <tr>
                <td><img src="${d.img || 'https://via.placeholder.com/50'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;"></td>
                <td><b>${d.name}</b></td>
                <td>${d.address}</td>
                <td><a href="${linkSawer}" target="_blank" style="color:#00d2ff;">Link Live</a></td>
                <td>${btnEdit} ${btnDel}</td>
            </tr>`;
        });
    });
}

// FUNGSI EDIT (Mengisi Form kembali)
window.editCafe = function(id, name, addr, img) {
    document.getElementById('cafe-edit-id').value = id; 
    document.getElementById('new-cafe-name').value = name;
    document.getElementById('new-cafe-address').value = addr;
    
    document.getElementById('cafe-preview').src = img || "https://via.placeholder.com/100?text=Foto";
    currentCafeBase64 = null; 

    // Ubah Tombol jadi Edit
    const btnSave = document.getElementById('btn-save-cafe');
    btnSave.innerText = "Simpan Perubahan";
    btnSave.style.background = "#FFD700"; 
    btnSave.style.color = "black";
    document.getElementById('btn-cancel-cafe').style.display = "inline-block"; 
}

// FUNGSI RESET FORM (Balik ke Mode Tambah)
window.resetCafeForm = function() {
    document.getElementById('cafe-edit-id').value = ""; 
    document.getElementById('new-cafe-name').value = "";
    document.getElementById('new-cafe-address').value = "";
    document.getElementById('cafe-preview').src = "https://via.placeholder.com/100?text=Foto";
    currentCafeBase64 = null;
    
    const btnSave = document.getElementById('btn-save-cafe');
    btnSave.innerText = "+ Simpan Partner";
    btnSave.style.background = ""; 
    btnSave.style.color = "white";
    document.getElementById('btn-cancel-cafe').style.display = "none";
}

// Hapus Cafe
window.deleteCafe = async (id) => { if(confirm("Hapus Cafe ini?")) await deleteDoc(doc(db,"venues_partner",id)); }


// --- B. PUSAT KONTROL (LAPORAN) ---

// 1. Siapkan Dropdown (Isi nama cafe & artis ke filter)
async function prepareReportFilters() {
    // Isi Lokasi
    const locSelect = document.getElementById('rep-loc');
    // Reset tapi sisakan opsi pertama & kedua (All & Stadion)
    locSelect.innerHTML = `
        <option value="all">Semua Lokasi (Stadion & Cafe)</option>
        <option value="Stadion Bayuangga Zone">Stadion Pusat</option>
    `;
    
    const cafes = await getDocs(collection(db, "venues_partner"));
    cafes.forEach(doc => {
        const name = doc.data().name;
        locSelect.innerHTML += `<option value="${name}">${name}</option>`;
    });

    // Isi Artis
    const artSelect = document.getElementById('rep-art');
    artSelect.innerHTML = `<option value="all">Semua Artis</option>`;
    
    const perfs = await getDocs(collection(db, "performers"));
    perfs.forEach(doc => {
        const name = doc.data().name;
        artSelect.innerHTML += `<option value="${name}">${name}</option>`;
    });
}

// 2. Logic Filter Utama
window.loadCafeReport = async function() {
    const loc = document.getElementById('rep-loc').value;
    const time = document.getElementById('rep-time').value;
    const art = document.getElementById('rep-art').value;
    const tbody = document.getElementById('rep-detail-body');

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Sedang menghitung data...</td></tr>';

    // Ambil Data REQUEST (Saweran)
    // Kita ambil SEMUA yang finished dulu, baru filter di JS (karena Firestore limitasi query index)
    const reqSnap = await getDocs(query(collection(db, "requests"), where("status", "==", "finished")));
    
    let totalMoney = 0;
    let totalSongs = 0;
    let detailHTML = '';

    const now = new Date();

    reqSnap.forEach(doc => {
        const d = doc.data();
        const date = d.timestamp.toDate();
        let isValid = true;

        // 1. Filter Lokasi
        // Catatan: Data request lama mungkin gak punya field 'location'. Kita anggap default 'Stadion'.
        const dataLoc = d.location || "Stadion Bayuangga Zone"; 
        if(loc !== 'all' && dataLoc !== loc) isValid = false;

        // 2. Filter Waktu
        if(time === 'today' && date.getDate() !== now.getDate()) isValid = false;
        if(time === 'month' && date.getMonth() !== now.getMonth()) isValid = false;
        
        // 3. Filter Artis
        if(art !== 'all' && d.performer !== art) isValid = false;

        if(isValid) {
            totalMoney += parseInt(d.amount);
            totalSongs++;
            detailHTML += `
            <tr>
                <td>${date.toLocaleDateString()}</td>
                <td>${dataLoc}</td>
                <td>${d.performer}</td>
                <td>${d.song}</td>
                <td style="color:#00ff00;">Rp ${parseInt(d.amount).toLocaleString()}</td>
            </tr>`;
        }
    });

    // Ambil Data PENGUNJUNG (Khusus Stadion)
    // Cafe tidak punya data pax, jadi 0
    let totalPax = 0;
    if(loc === 'all' || loc === 'Stadion Bayuangga Zone') {
        const bookSnap = await getDocs(query(collection(db, "bookings"), where("status", "==", "finished")));
        bookSnap.forEach(doc => {
            const d = doc.data();
            // Filter waktu yang sama
            const date = d.finishedAt ? d.finishedAt.toDate() : new Date();
            let isTimeValid = true;
            if(time === 'today' && date.getDate() !== now.getDate()) isTimeValid = false;
            // ... (logika waktu lain disederhanakan)

            if(isTimeValid) {
                totalPax += parseInt(d.pax || 0);
            }
        });
    }
    
    // Tampilkan
    document.getElementById('rep-total-money').innerText = "Rp " + totalMoney.toLocaleString();
    document.getElementById('rep-total-song').innerText = totalSongs;
    document.getElementById('rep-total-pax').innerText = (loc === 'all' || loc === 'Stadion Bayuangga Zone') ? totalPax : "-";
    
    tbody.innerHTML = detailHTML || '<tr><td colspan="5" style="text-align:center;">Tidak ada data sesuai filter.</td></tr>';
}
