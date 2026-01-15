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
    
    // Auto Load Data Khusus
    if(viewId === 'dashboard') loadDashboardOverview();
    if(viewId === 'finance') { renderFinanceData(); listenCommandCenter(); }
    if(viewId === 'cms') loadArtistDropdowns(); 
    if(viewId === 'students') loadStudentData();
    if(viewId === 'mitra') loadMitraData();
    if(viewId === 'performer') loadPerformerData();
    if(viewId === 'mentor') loadMentorData();
    if(viewId === 'cafe') { 
        loadCafeData();
        const tabBtn = document.querySelector('.sub-tab-btn');
        if(tabBtn) switchCafeTab('cafe-data', tabBtn); 
    }
     if(viewId === 'live') {
        loadCurrentLiveLink(); // Fungsi ini akan kita buat di bawah
        // Default buka tab pertama
        const btns = document.querySelectorAll('.sub-tab-btn');
        // Cari tombol Live di dalam view-live (index agak tricky, kita buat fungsi switchLiveTab handle null btn)
        switchLiveTab('panel-live', null);
    }

    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    if(btn) btn.classList.add('active');
}

window.switchCmsTab = function(tabId, btn) {
    document.querySelectorAll('.cms-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    
    if(btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    }
    if(btn) btn.classList.add('active');

    if(tabId === 'cms-schedule') loadActiveSchedules();
    
    if(tabId === 'cms-radio') {
        loadRadioSessionData(); 
        loadAllRadioSchedules();
    }
    
    if(tabId === 'cms-tour') {
        loadCafeDropdownForSchedule(); 
        loadActiveTourSchedules();    
        loadArtistDropdowns();
    }
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
   2. MODUL LAPORAN STATISTIK WARUNG
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

// --- FUNGSI CETAK PDF DETAIL (FIX FINAL: TANPA INDEX ERROR) ---
window.generateReportPDF = async function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const filter = document.getElementById('report-filter').value;
    const filterText = document.getElementById('report-filter').options[document.getElementById('report-filter').selectedIndex].text;

    document.body.style.cursor = 'wait';

    try {
        // 1. QUERY DATABASE (HANYA 'WHERE', TIDAK PAKAI 'ORDERBY')
        // Ini kuncinya agar tidak error Index
        const q = query(collection(db, "bookings"), where("status", "==", "finished"));
        const snapshot = await getDocs(q);

        // 2. KELOMPOKKAN DATA
        let groupedData = {};
        const now = new Date();
        
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            // Konversi Timestamp Firebase ke Date Javascript
            const date = d.finishedAt ? d.finishedAt.toDate() : (d.timestamp ? d.timestamp.toDate() : new Date());

            // FILTER WAKTU (LOGIC MANUAL)
            let include = false;
            if (filter === 'all') include = true;
            else if (filter === 'month') {
                if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) include = true;
            } 
            else if (filter === 'week') {
                const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                if (date >= oneWeekAgo) include = true;
            }
            else if (filter === 'today') {
                 if (date.getDate() === now.getDate() && date.getMonth() === now.getMonth()) include = true;
            }

            if (include) {
                const wName = d.warungName || "Unknown";
                if (!groupedData[wName]) groupedData[wName] = [];
                groupedData[wName].push({
                    date: date,
                    table: Array.isArray(d.tableNum) ? d.tableNum.join(",") : d.tableNum,
                    pax: d.pax,
                    revenue: parseInt(d.revenue || 0)
                });
            }
        });

        // 3. CETAK PDF
        let y = 20;

        doc.setFontSize(16); doc.setFont("helvetica", "bold");
        doc.text("LAPORAN DETAIL TRANSAKSI SMIPRO", 105, y, null, null, "center");
        y += 7;
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text(`Periode: ${filterText} | Dicetak: ${new Date().toLocaleString('id-ID')}`, 105, y, null, null, "center");
        y += 15;

        let grandTotal = 0;

        // Loop per Warung
        for (const [warungName, transactions] of Object.entries(groupedData)) {
            
            // --- URUTKAN DATA SECARA MANUAL DISINI (JAVASCRIPT SORT) ---
            transactions.sort((a, b) => a.date - b.date); 

            if (y > 250) { doc.addPage(); y = 20; }

            // Header Warung
            doc.setFontSize(12); doc.setFont("helvetica", "bold");
            doc.setFillColor(230, 230, 230);
            doc.rect(14, y-5, 182, 8, 'F');
            doc.text(`WARUNG: ${warungName.toUpperCase()}`, 15, y);
            y += 8;

            // Header Tabel
            doc.setFontSize(9); doc.setFont("helvetica", "bold");
            doc.text("Tanggal & Jam", 15, y);
            doc.text("Meja", 60, y);
            doc.text("Visitor", 90, y);
            doc.text("Nominal (Rp)", 160, y);
            doc.line(15, y+2, 195, y+2);
            y += 7;

            let subTotal = 0;
            doc.setFont("helvetica", "normal");

            // Tulis Baris Transaksi
            transactions.forEach(t => {
                const dateStr = t.date.toLocaleString('id-ID', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
                
                doc.text(dateStr, 15, y);
                doc.text(`No. ${t.table}`, 60, y);
                doc.text(`${t.pax} Org`, 90, y);
                doc.text(t.revenue.toLocaleString('id-ID'), 160, y);

                subTotal += t.revenue;
                y += 6;

                if (y > 270) { 
                    doc.addPage(); y = 20; 
                    doc.setFont("helvetica", "bold"); doc.text(`(Lanjutan ${warungName})...`, 15, y);
                    y += 10; doc.setFont("helvetica", "normal");
                }
            });

            // Subtotal
            y += 2; doc.line(100, y, 195, y); y += 5;
            doc.setFont("helvetica", "bold");
            doc.text("SUBTOTAL:", 100, y);
            doc.text(`Rp ${subTotal.toLocaleString('id-ID')}`, 160, y);
            
            grandTotal += subTotal;
            y += 15;
        }

        // Grand Total
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setLineWidth(0.5); doc.line(15, y, 195, y); y += 10;
        doc.setFontSize(14); doc.text("GRAND TOTAL OMZET:", 100, y);
        doc.setTextColor(0, 150, 0);
        doc.text(`Rp ${grandTotal.toLocaleString('id-ID')}`, 195, y, {align: "right"});
        doc.setTextColor(0, 0, 0);

        doc.save(`Laporan_Detail_SMIPRO_${filter}.pdf`);

    } catch (error) {
        console.error(error);
        alert("Gagal: " + error.message);
    } finally {
        document.body.style.cursor = 'default';
    }
}

/* =========================================
   3. MANAJEMEN PERFORMER
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
   4. MANAJEMEN MENTOR
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
   5. MANAJEMEN SISWA
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

    const mentorSnap = await getDocs(collection(db, "mentors"));
    const totalMentors = mentorSnap.size; 

    const q = query(collection(db, "students"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada siswa.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            const scores = data.scores || {};
            const jumlahDinilai = Object.keys(scores).length;
            
            let statusHTML = '';
            if (jumlahDinilai === 0) {
                statusHTML = `<span style="color:#888;">Belum ada nilai</span>`;
            } else if (jumlahDinilai < totalMentors) {
                statusHTML = `<span style="color:orange;">Proses: ${jumlahDinilai} / ${totalMentors} Mentor</span>`;
            } else {
                statusHTML = `<span style="color:#00ff00; font-weight:bold;">Selesai (${jumlahDinilai}/${totalMentors})</span>`;
            }

            const actionBtns = `
                <div style="display:flex; gap:5px;">
                    <button class="btn-action btn-view" onclick="openRaport('${id}')" title="Lihat Raport Detail"><i class="fa-solid fa-list-check"></i></button>
                    <button class="btn-action btn-delete" onclick="deleteStudent('${id}', '${data.name}')" title="Hapus Siswa"><i class="fa-solid fa-trash"></i></button>
                </div>`;

            const imgHTML = `<img src="${data.img}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #555;">`;
            
            tbody.innerHTML += `<tr><td>${imgHTML}</td><td><b>${data.name}</b></td><td>${data.genre}</td><td>${statusHTML}</td><td>${actionBtns}</td></tr>`;
        });
    });
}
window.deleteStudent = async function(id, name) {
    if(confirm(`YAKIN MENGHAPUS SISWA: ${name}?`)) await deleteDoc(doc(db, "students", id));
}

// --- FUNGSI LIHAT RAPORT DETAIL ---
window.openRaport = async function(studentId) {
    const modal = document.getElementById('modal-raport');
    const tbody = document.getElementById('raport-list-body');
    if(!modal) return alert("Error: Modal Raport belum ada.");

    modal.style.display = 'flex';
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Memuat Data...</td></tr>';

    try {
        const studentSnap = await getDoc(doc(db, "students", studentId));
        if(!studentSnap.exists()) return;
        const sData = studentSnap.data();
        const sScores = sData.scores || {};

        document.getElementById('rap-name').innerText = sData.name;
        document.getElementById('rap-genre').innerText = sData.genre;
        document.getElementById('rap-img').src = sData.img || "https://via.placeholder.com/150";

        const mentorSnap = await getDocs(collection(db, "mentors"));
        tbody.innerHTML = ''; 

        mentorSnap.forEach(mDoc => {
            const mData = mDoc.data();
            const mID = mDoc.id;
            const nilai = sScores[mID]; 
            
            let statusNilai = (nilai !== undefined) ? 
                (nilai >= 75 ? `<b style="color:#00ff00;">${nilai} (Lulus)</b>` : `<b style="color:red;">${nilai} (Remidi)</b>`) :
                `<span style="color:#ffeb3b; font-style:italic;">⏳ Belum Menilai</span>`;

            tbody.innerHTML += `<tr><td>${mData.name}</td><td><small style="color:#aaa;">${mData.specialist}</small></td><td>${statusNilai}</td></tr>`;
        });
    } catch (e) { console.error(e); }
}


/* =========================================
   6. CMS MODULE
   ========================================= */

// 1. DROPDOWN ARTIS
async function loadArtistDropdowns() {
    const selects = ['p1-name', 'p2-name', 'p3-name', 'radio-host', 'tour-perf-name'];
    const q = query(collection(db, "performers"), orderBy("name", "asc"));
    const snapshot = await getDocs(q);
    let optionsHTML = '<option value="">-- Pilih Artis --</option><option value="Lainnya">Lainnya / Band Luar</option>';
    
    snapshot.forEach(doc => { optionsHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`; });
    selects.forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = optionsHTML; });
}

// 2. SIMPAN JADWAL UTAMA
window.saveSchedule = async function() {
    const displayDate = document.getElementById('sched-display-date').value;
    const realDate = document.getElementById('sched-real-date').value;
    const location = document.getElementById('sched-location').value;
    
    const performers = [1,2,3].map(i => ({
        name: document.getElementById(`p${i}-name`).value,
        time: document.getElementById(`p${i}-time`).value,
        genre: "Live"
    })).filter(p => p.name);

    if(!displayDate || !realDate) return alert("Tanggal wajib diisi!");

    if(confirm("Publish Jadwal Utama?")) {
        await addDoc(collection(db, "events"), {
            type: "main", displayDate, date: realDate, location, performers
        });
        alert("Jadwal Utama Dipublish!");
    }
}

// 3. SIMPAN JADWAL TOUR
window.saveTourSchedule = async function() {
    const displayDate = document.getElementById('tour-display-date').value;
    const realDate = document.getElementById('tour-real-date').value;
    const location = document.getElementById('tour-location').value;
    const perfName = document.getElementById('tour-perf-name').value;
    const perfTime = document.getElementById('tour-perf-time').value;

    if(!displayDate || !realDate || !location || !perfName) return alert("Data Tour belum lengkap!");

    if(confirm("Publish Jadwal Tour?")) {
        await addDoc(collection(db, "events"), {
            type: "tour", 
            displayDate: displayDate,
            date: realDate,
            location: location,
            statusText: "ON TOUR",
            performers: [{ name: perfName, time: perfTime }] 
        });
        alert("Jadwal Tour Berhasil Dipublish!");
    }
}

// 4. LOAD DROPDOWN CAFE
async function loadCafeDropdownForSchedule() {
    const select = document.getElementById('tour-location');
    if(!select) return; 

    select.innerHTML = '<option value="">-- Pilih Lokasi Cafe --</option>';
    const q = query(collection(db, "venues_partner"), orderBy("name", "asc"));
    const snap = await getDocs(q);
    snap.forEach(doc => { select.innerHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`; });
}

// 5. LOAD ACTIVE TOUR
async function loadActiveTourSchedules() {
    const tbody = document.getElementById('cms-tour-list-body');
    if(!tbody) return;

    const q = query(collection(db, "events"), where("type", "==", "tour"), orderBy("date", "asc"));
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="3" align="center">Tidak ada jadwal tour.</td></tr>'; return; }
        
        snapshot.forEach(doc => {
            const d = doc.data();
            tbody.innerHTML += `
            <tr>
                <td><b>${d.displayDate}</b><br><small style="color:#888;">${d.date}</small></td>
                <td>${d.location}<br><small style="color:#ff9800;">${d.performers[0].name}</small></td>
                <td><button class="btn-action btn-delete" onclick="deleteSchedule('${doc.id}')">Hapus</button></td>
            </tr>`;
        });
    });
}

// 6. LOAD ACTIVE SCHEDULE MAIN
async function loadActiveSchedules() {
    const tbody = document.getElementById('cms-schedule-list-body');
    if(!tbody) return;

    const q = query(collection(db, "events"), orderBy("date", "asc"));
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        let hasData = false;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.type === 'main' || !data.type) { 
                hasData = true;
                tbody.innerHTML += `
                <tr>
                    <td><b>${data.displayDate}</b><br><small>${data.date}</small></td>
                    <td>${data.location}</td>
                    <td><button class="btn-action btn-delete" onclick="deleteSchedule('${doc.id}')">Hapus</button></td>
                </tr>`;
            }
        });

        if(!hasData) tbody.innerHTML = '<tr><td colspan="3" align="center">Tidak ada jadwal utama.</td></tr>';
    });
}
window.deleteSchedule = async function(id) { if(confirm("Hapus Jadwal?")) await deleteDoc(doc(db,"events",id)); }
    
// TOGGLE NEWS VS PODCAST
window.toggleContentForm = function() {
    const type = document.getElementById('content-category').value;
    document.getElementById('form-news-container').style.display = type === 'news' ? 'block' : 'none';
    document.getElementById('form-podcast-container').style.display = type === 'podcast' ? 'block' : 'none';
}

window.toggleNewsInput = function() {
    const type = document.getElementById('news-type').value;
    document.getElementById('news-input-external').style.display = type === 'external' ? 'block' : 'none';
    document.getElementById('news-input-internal').style.display = type === 'internal' ? 'block' : 'none';
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
            date: new Date().toLocaleDateString(),
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

// RADIO
let currentRadioDocId = null; 

window.loadRadioSessionData = async function() {
    const sessionName = document.getElementById('radio-session-select').value;
    const editArea = document.getElementById('radio-edit-area');
    
    if(!sessionName) {
        editArea.style.display = 'none';
        return;
    }
    editArea.style.display = 'block';

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
    } else {
        currentRadioDocId = null; 
        document.getElementById('radio-title').value = "";
    }
}

window.saveRadioUpdate = async function() {
    const sessionName = document.getElementById('radio-session-select').value;
    const dataPayload = {
        sessionName: sessionName,
        title: document.getElementById('radio-title').value,
        host: document.getElementById('radio-host').value,
        topic: document.getElementById('radio-topic').value,
        link: document.getElementById('radio-link').value,
        isLive: document.getElementById('radio-live-toggle').checked,
        order: sessionName === 'PAGI' ? 1 : (sessionName === 'SIANG' ? 2 : 3)
    };

    if(confirm("Simpan perubahan jadwal siaran?")) {
        if(currentRadioDocId) await updateDoc(doc(db, "broadcasts", currentRadioDocId), dataPayload);
        else await addDoc(collection(db, "broadcasts"), dataPayload);
        alert("Jadwal Radio Berhasil Disimpan!");
        loadAllRadioSchedules();
    }
}

async function loadAllRadioSchedules() {
    const tbody = document.getElementById('radio-list-body');
    if(!tbody) return; 

    const q = query(collection(db, "broadcasts"), orderBy("order", "asc"));
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="4" align="center">Belum ada jadwal radio.</td></tr>'; return; }
        snapshot.forEach(doc => {
            const d = doc.data();
            const status = d.isLive ? '<span style="color:#00ff00; font-weight:bold;">LIVE</span>' : '<span style="color:#888;">Offline</span>';
            tbody.innerHTML += `
            <tr>
                <td><b>${d.sessionName}</b></td>
                <td>${d.title}<br><small style="color:#00d2ff;">${d.host}</small></td>
                <td>${status}</td>
                <td><button class="btn-action btn-delete" onclick="deleteRadio('${doc.id}')">Hapus</button></td>
            </tr>`;
        });
    });
}
window.deleteRadio = async function(id) { if(confirm("Hapus?")) await deleteDoc(doc(db, "broadcasts", id)); }

/* =========================================
   7. COMMAND CENTER (LIVE MONITOR & STATISTIK)
   ========================================= */

// Variable Global untuk Listener
let monitorUnsubscribe = null;
let statsUnsubscribe = null;

// Fungsi ini dipanggil saat tab Finance dibuka
function listenCommandCenter() {
    const pendingContainer = document.getElementById('list-pending');
    const liveContainer = document.getElementById('list-approved');

    // Cek apakah elemen HTML ada?
    if(!pendingContainer || !liveContainer) {
        console.error("Error: Wadah Monitor tidak ditemukan di HTML.");
        return;
    }

    // Query: Ambil data 'requests' yang statusnya pending ATAU approved
    const q = query(collection(db, "requests"), where("status", "in", ["pending", "approved"]));

    // Matikan listener lama jika ada (biar gak dobel)
    if(monitorUnsubscribe) monitorUnsubscribe();

    // Jalankan Listener Realtime
    monitorUnsubscribe = onSnapshot(q, (snapshot) => {
        // 1. Bersihkan Tampilan Lama
        pendingContainer.innerHTML = '';
        liveContainer.innerHTML = '';
        
        let hasPending = false;
        let hasLive = false;

        // 2. Ambil Data & Urutkan Manual (Biar gak kena error Index Firebase)
        let requests = [];
        snapshot.forEach(doc => {
            requests.push({ id: doc.id, ...doc.data() });
        });
        
        // Urutkan berdasarkan waktu (Yang lama di atas/antrian)
        requests.sort((a,b) => {
            const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
            const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
            return timeA - timeB;
        });

        // 3. Render ke Kolom
        requests.forEach(d => {
            // Format Jam
            const timeStr = d.timestamp ? new Date(d.timestamp.toDate()).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-';
            
            // Template HTML Kartu
            const htmlItem = `
            <div class="req-item ${d.status}">
                <div class="req-amount">Rp ${parseInt(d.amount).toLocaleString()}</div>
                <small style="color:#888;">${timeStr} • Dari: <b style="color:#00d2ff;">${d.sender}</b></small>
                <h4 style="margin:5px 0; color:white;">${d.song}</h4>
                <p style="margin:0; font-size:0.8rem; color:#ccc;">"${d.message}"</p>
                <small style="color:#aaa;">Untuk: ${d.performer}</small>
                
                <div style="margin-top:10px;">
                    ${d.status === 'pending' ? 
                        // TOMBOL UNTUK STATUS PENDING (KOLOM KIRI)
                        `<button class="btn-control btn-approve" onclick="approveReq('${d.id}')">
                            <i class="fa-solid fa-check"></i> TERIMA DANA
                        </button>
                        <button class="btn-action btn-delete" onclick="deleteReq('${d.id}')" style="margin-top:5px; width:100%;">
                            <i class="fa-solid fa-trash"></i> Tolak
                        </button>` 
                        : 
                        // TOMBOL UNTUK STATUS APPROVED (KOLOM KANAN)
                        `<button class="btn-control btn-finish" onclick="finishReq('${d.id}')">
                            <i class="fa-solid fa-flag-checkered"></i> SELESAI (ARSIP)
                        </button>`
                    }
                </div>
            </div>`;

            // Pisahkan ke Kiri atau Kanan
            if(d.status === 'pending') {
                pendingContainer.innerHTML += htmlItem;
                hasPending = true;
            } else {
                liveContainer.innerHTML += htmlItem;
                hasLive = true;
            }
        });

        // 4. Pesan Kosong
        if(!hasPending) pendingContainer.innerHTML = '<p class="empty-state">Tidak ada request baru.</p>';
        if(!hasLive) liveContainer.innerHTML = '<p class="empty-state">Panggung sepi.</p>';
    });
}

function renderFinanceData() {
    const tbody = document.getElementById('table-history-body');
    if(!tbody) return;

    // Ambil data yang sudah SELESAI (finished)
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
            
            // Render Tabel Riwayat
            const dateStr = d.timestamp ? new Date(d.timestamp.toDate()).toLocaleTimeString() : '-';
            historyHTML += `
            <tr>
                <td>${dateStr}</td>
                <td><b>${d.song}</b><br><small>${d.performer}</small></td>
                <td style="color:#00ff00;">Rp ${parseInt(d.amount).toLocaleString()}</td>
            </tr>`;
        });

        // Update Angka Statistik
        const elMoney = document.getElementById('stat-total-money');
        const elReq = document.getElementById('stat-total-req');
        if(elMoney) elMoney.innerText = "Rp " + totalMoney.toLocaleString();
        if(elReq) elReq.innerText = totalReq;
        
        tbody.innerHTML = historyHTML || '<tr><td colspan="3" style="text-align:center;">Data kosong.</td></tr>';
    });
}

// C. ACTION BUTTONS (Fungsi Tombol)
window.approveReq = async function(id) {
    if(confirm("Uang masuk?")) await updateDoc(doc(db, "requests", id), { status: 'approved' });
}
window.finishReq = async function(id) {
    if(confirm("Arsipkan?")) await updateDoc(doc(db, "requests", id), { status: 'finished' });
}
window.deleteReq = async function(id) {
    if(confirm("Tolak?")) await deleteDoc(doc(db, "requests", id));
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
   8. DASHBOARD OVERVIEW (NOTIFIKASI)
   ========================================= */

async function loadDashboardOverview() {
    console.log("Memuat Data Overview...");

    // 1. STATISTIK
    const mitraSnap = await getDocs(collection(db, "warungs"));
    const perfSnap = await getDocs(collection(db, "performers"));
    
    document.getElementById('count-mitra').innerText = mitraSnap.size;
    document.getElementById('count-perf').innerText = perfSnap.size;

    const moneySnap = await getDocs(collection(db, "requests"));
    let totalPending = 0;
    moneySnap.forEach(doc => {
        if(doc.data().status === 'pending') totalPending += parseInt(doc.data().amount);
    });
    document.getElementById('total-revenue').innerText = "Rp " + totalPending.toLocaleString();

    // 3. NOTIFIKASI
    const notifArea = document.getElementById('admin-notification-area');
    if(!notifArea) return; 

    notifArea.innerHTML = ''; 
    let adaNotif = false;

    // A. CEK MITRA
    mitraSnap.forEach(doc => {
        const d = doc.data();
        if(d.totalTables > 15 && !d.adminApproved) {
            adaNotif = true;
            notifArea.innerHTML += `
            <div class="notif-card urgent">
                <div class="notif-content"><h4>Approval Mitra Besar</h4><p>${d.name}</p></div>
                <div class="notif-action"><button class="btn-action btn-view" onclick="showView('mitra')">Lihat</button></div>
            </div>`;
        }
    });

    // B. CEK SISWA
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
                    <div class="notif-content"><h4>Siswa Siap Lulus</h4><p>${d.name} (Rata-rata: ${avg.toFixed(1)})</p></div>
                    <div class="notif-action"><button class="btn-action btn-edit" onclick="luluskanSiswa('${doc.id}', '${d.name}', '${d.genre}')">Terbitkan</button></div>
                </div>`;
            }
        }
    });
    // C. CEK PENDAFTARAN MENTOR (BARU)
    const mentorSnap = await getDocs(collection(db, "mentors"));
    mentorSnap.forEach(doc => {
        const d = doc.data();
        // Cek jika statusnya masih 'pending'
        if(d.status === 'pending') {
            adaNotif = true;
            notifArea.innerHTML += `
            <div class="notif-card warning">
                <div class="notif-content">
                    <h4><i class="fa-solid fa-user-tie"></i> Pendaftaran Mentor Baru</h4>
                    <p><b>${d.name}</b> (${d.specialist}) mendaftar. Email: ${d.email}</p>
                </div>
                <div class="notif-action">
                    <button class="btn-action btn-edit" onclick="approveMentor('${doc.id}', '${d.name}')">Setujui</button>
                    <button class="btn-action btn-delete" onclick="deleteMentor('${doc.id}')">Tolak</button>
                </div>
            </div>`;
        }
    });

    if(!adaNotif) {
        notifArea.innerHTML = `<div class="empty-state-box"><p>Tidak ada notifikasi baru.</p></div>`;
    }
}

window.luluskanSiswa = async function(id, name, genre) {
    if(confirm(`Luluskan ${name}?`)) {
        await addDoc(collection(db, "performers"), {
            name: name, genre: genre, verified: true, 
            img: "https://via.placeholder.com/150", rating: 5.0, 
            gallery: [], certified_date: new Date()
        });
        await updateDoc(doc(db, "students", id), { status: 'graduated' });
        alert("Berhasil!");
        loadDashboardOverview(); 
    }
}
// Fungsi Approve Mentor Baru
window.approveMentor = async function(id, name) {
    if(confirm(`Setujui ${name} menjadi Mentor Resmi SMIPRO?`)) {
        // Update status jadi 'active' agar bisa login
        await updateDoc(doc(db, "mentors", id), { status: 'active' });
        
        alert("Mentor Disetujui! Sekarang dia bisa login.");
        loadDashboardOverview(); // Refresh notifikasi
    }
}

/* =========================================
   9. MODUL CAFE (MANAJEMEN & LAPORAN)
   ========================================= */
// Navigasi Tab Cafe
window.switchCafeTab = function(tabId, btn) {
    document.querySelectorAll('.cafe-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    
    if(btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    }
    if(btn) btn.classList.add('active');

    if(tabId === 'cafe-report') prepareReportFilters(); 
}

// A. MANAJEMEN CAFE
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
        if(confirm("Simpan perubahan?")) {
            const updateData = { name, address: addr };
            if(img) updateData.img = img; 
            await updateDoc(doc(db, "venues_partner", id), updateData);
            alert("Data Diperbarui!");
            resetCafeForm();
        }
    } else {
        if(confirm("Tambah Cafe?")) {
            await addDoc(collection(db, "venues_partner"), {
                name, address: addr, img: img || "https://via.placeholder.com/100?text=Cafe", type: 'cafe', joinedAt: new Date()
            });
            alert("Cafe Ditambahkan!");
            resetCafeForm();
        }
    }
}

async function loadCafeData() {
    const tbody = document.getElementById('cafe-table-body');
    if(!tbody) return;

    onSnapshot(collection(db, "venues_partner"), (snap) => {
        tbody.innerHTML = '';
        if(snap.empty) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada partner.</td></tr>'; return; }

        snap.forEach(doc => {
            const d = doc.data();
            const linkSawer = `cafe-live.html?loc=${encodeURIComponent(d.name)}`;
            
            const btnEdit = `<button class="btn-action btn-edit" onclick="editCafe('${doc.id}', '${d.name}', '${d.address}', '${d.img}')"><i class="fa-solid fa-pen"></i></button>`;
            const btnDel = `<button class="btn-action btn-delete" onclick="window.deleteCafe('${doc.id}')"><i class="fa-solid fa-trash"></i></button>`;

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

window.editCafe = function(id, name, addr, img) {
    document.getElementById('cafe-edit-id').value = id; 
    document.getElementById('new-cafe-name').value = name;
    document.getElementById('new-cafe-address').value = addr;
    document.getElementById('cafe-preview').src = img || "https://via.placeholder.com/100?text=Foto";
    currentCafeBase64 = null; 

    const btnSave = document.getElementById('btn-save-cafe');
    btnSave.innerText = "Simpan Perubahan";
    btnSave.style.background = "#FFD700"; 
    btnSave.style.color = "black";
    document.getElementById('btn-cancel-cafe').style.display = "inline-block"; 
}

window.deleteCafe = async function(id) { 
    if(confirm("Hapus Cafe ini?")) await deleteDoc(doc(db,"venues_partner",id)); 
}

// B. LAPORAN CAFE
async function prepareReportFilters() {
    const locSelect = document.getElementById('rep-loc');
    locSelect.innerHTML = `<option value="all">Semua Lokasi</option><option value="Stadion Bayuangga Zone">Stadion Pusat</option>`;
    
    const cafes = await getDocs(collection(db, "venues_partner"));
    cafes.forEach(doc => { locSelect.innerHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`; });

    const artSelect = document.getElementById('rep-art');
    artSelect.innerHTML = `<option value="all">Semua Artis</option>`;
    const perfs = await getDocs(collection(db, "performers"));
    perfs.forEach(doc => { artSelect.innerHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`; });
}

window.loadCafeReport = async function() {
    const loc = document.getElementById('rep-loc').value;
    const time = document.getElementById('rep-time').value;
    const art = document.getElementById('rep-art').value;
    const tbody = document.getElementById('rep-detail-body');

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Sedang menghitung data...</td></tr>';

    const reqSnap = await getDocs(query(collection(db, "requests"), where("status", "==", "finished")));
    
    let totalMoney = 0;
    let totalSongs = 0;
    let detailHTML = '';
    const now = new Date();

    reqSnap.forEach(doc => {
        const d = doc.data();
        const date = d.timestamp.toDate();
        let isValid = true;

        const dataLoc = d.location || "Stadion Bayuangga Zone"; 
        if(loc !== 'all' && dataLoc !== loc) isValid = false;
        if(time === 'today' && date.getDate() !== now.getDate()) isValid = false;
        if(art !== 'all' && d.performer !== art) isValid = false;

        if(isValid) {
            totalMoney += parseInt(d.amount);
            totalSongs++;
            detailHTML += `<tr><td>${date.toLocaleDateString()}</td><td>${dataLoc}</td><td>${d.performer}</td><td>${d.song}</td><td style="color:#00ff00;">Rp ${parseInt(d.amount).toLocaleString()}</td></tr>`;
        }
    });

    document.getElementById('rep-total-money').innerText = "Rp " + totalMoney.toLocaleString();
    document.getElementById('rep-total-song').innerText = totalSongs;
    document.getElementById('rep-total-pax').innerText = (loc === 'all' || loc === 'Stadion Bayuangga Zone') ? "Stadion Only" : "-";
    
    tbody.innerHTML = detailHTML || '<tr><td colspan="5" style="text-align:center;">Tidak ada data sesuai filter.</td></tr>';
}

/* =========================================
   10. MODUL KONTROL LAYAR & GALERI (NEW)
   ========================================= */

// A. NAVIGASI SUB-TAB
window.switchLiveTab = function(tabId, btn) {
    document.querySelectorAll('.live-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    
    // Reset tombol active (Hanya jika btn ada/diklik)
    if(btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    // Load Data
    if(tabId === 'panel-live') loadCurrentLiveLink();
    if(tabId === 'panel-galeri') loadGalleryList(); 
}

// B. LIVE STREAMING (VENUE)
window.updateLiveLink = async function() {
    const url = document.getElementById('main-live-link').value;
    
    if (!url) return alert("Link kosong!");
    if (!url.includes("youtu")) return alert("Harap masukkan link YouTube!");

    let videoId = "";
    if (url.includes("v=")) videoId = url.split('v=')[1].split('&')[0];
    else if (url.includes("youtu.be/")) videoId = url.split('youtu.be/')[1];
    else if (url.includes("live/")) videoId = url.split('live/')[1];

    if (!videoId) return alert("ID Video tidak valid.");

    await setDoc(doc(db, "system", "main_stage"), {
        youtubeId: videoId, fullUrl: url, updatedAt: new Date()
    });
    
    // Auto Refresh Monitor Admin
    loadCurrentLiveLink();
    alert("Layar Venue Telah Diupdate!");
}

async function loadCurrentLiveLink() {
    const docSnap = await getDoc(doc(db, "system", "main_stage"));
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('main-live-link').value = data.fullUrl || "";
        
        // Update Monitor Admin
        const monitor = document.getElementById('admin-monitor-frame');
        const placeholder = document.getElementById('admin-monitor-placeholder');
        
        if(data.youtubeId && monitor) {
            monitor.src = `https://www.youtube.com/embed/${data.youtubeId}?autoplay=0&mute=0&controls=1&origin=https://smipro-streetart.github.io`;
            monitor.style.display = 'block';
            if(placeholder) placeholder.style.display = 'none';
        }
    }
}

// C. MANAJEMEN GALERI VIDEO
window.saveGalleryVideo = async function() {
    const title = document.getElementById('vid-title').value;
    const creator = document.getElementById('vid-creator').value;
    const link = document.getElementById('vid-link').value;
    const category = document.getElementById('vid-category').value;
    const desc = document.getElementById('vid-desc').value;

    if(!title || !creator || !link) return alert("Data Wajib diisi!");

    let videoId = "";
    if (link.includes("v=")) videoId = link.split('v=')[1].split('&')[0];
    else if (link.includes("youtu.be/")) videoId = link.split('youtu.be/')[1];
    
    const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    if(confirm("Simpan ke Galeri?")) {
        await addDoc(collection(db, "content_gallery"), {
            title, creator, link, category, description: desc, thumbnail, timestamp: new Date()
        });
        alert("Video Masuk Galeri!");
        // Reset
        document.getElementById('vid-title').value = "";
        document.getElementById('vid-link').value = "";
        loadGalleryList();
    }
}

async function loadGalleryList() {
    const tbody = document.getElementById('gallery-list-body');
    if(!tbody) return;

    const q = query(collection(db, "content_gallery"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="4" align="center">Kosong.</td></tr>'; return; }

        snapshot.forEach(doc => {
            const d = doc.data();
            let catColor = d.category === 'Live Perform' ? '#E50914' : (d.category === 'Podcast' ? '#a855f7' : '#00d2ff');

            tbody.innerHTML += `
            <tr>
                <td><img src="${d.thumbnail}" style="width:60px; border-radius:5px;"></td>
                <td><b>${d.title}</b><br><small style="color:#888;">${d.creator}</small></td>
                <td><span style="color:${catColor}; font-weight:bold;">${d.category}</span></td>
                <td><button class="btn-action btn-delete" onclick="deleteGalleryVideo('${doc.id}')">Hapus</button></td>
            </tr>`;
        });
    });
}

window.deleteGalleryVideo = async function(id) {
    if(confirm("Hapus?")) await deleteDoc(doc(db, "content_gallery", id));
}

/* =========================================
   11. EKSEKUSI (PALING BAWAH)
   ========================================= */
window.onload = function() {
    loadDashboardOverview();
    
    // Background Load
    loadMitraData();
    loadPerformerData();
    loadMentorData();
    loadStudentData(); 
    loadCafeData();

    setTimeout(() => {
        const lastTab = localStorage.getItem('adminReturnTab');
        if (lastTab) {
            document.querySelectorAll('.menu-item').forEach(btn => {
                if (btn.getAttribute('onclick').includes(lastTab)) btn.click();
            });
            localStorage.removeItem('adminReturnTab');
        }
    }, 500);
}
