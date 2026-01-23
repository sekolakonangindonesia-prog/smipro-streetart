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
    if(viewId === 'cms') loadArtistDropdowns(); 
    if(viewId === 'students') loadStudentData();    
    if(viewId === 'performer') loadPerformerData();
    if(viewId === 'mentor') loadMentorData();      
    if(viewId === 'venue') loadVenueManagement();
    
    if(viewId === 'mitra') { 
        loadMitraData(); 
        populateVenueFilters(); 
    }
    if(viewId === 'cafe') { 
        loadCafeData();
        const tabBtn = document.querySelector('.sub-tab-btn');
        if(tabBtn) switchCafeTab('cafe-data', tabBtn); 
    }
     if(viewId === 'live') {
        populateLiveVenueOptions();
       
        switchLiveTab('panel-live', null);
    }
    
    if(viewId === 'finance') { 
        window.initFinanceSystem();       
        listenCommandCenter(); 
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
// ISI DROPDOWN FILTER VENUE (UNTUK KEDUA TAB)
async function populateVenueFilters() {
    // KITA ISI DUA DROPDOWN SEKALIGUS
    const ids = ['filter-warung-venue', 'filter-stats-venue'];
    
    const q = query(collection(db, "venues"), orderBy("name", "asc"));
    const snap = await getDocs(q);
    
    // Opsi Default
    let opts = '<option value="all">Semua Venue</option>';
    
    // Tambahkan Stadion Manual (Jaga-jaga)
    opts += '<option value="Stadion Bayuangga Zone">Stadion Bayuangga Zone</option>';

    snap.forEach(doc => {
        const v = doc.data();
        // Cek agar tidak dobel jika Stadion sdh ada di database
        if(v.name && v.name !== "Stadion Bayuangga Zone") {
            opts += `<option value="${v.name}">${v.name}</option>`;
        }
    });

    // MASUKKAN KE HTML
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.innerHTML = opts;
            // Jika ini filter statistik, tambahkan event listener agar grafik berubah saat diganti
            if(id === 'filter-stats-venue') {
                el.onchange = function() { loadWarungStatistics(); };
            }
        }
    });
}
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
        localStorage.setItem('mitraId', id); 
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

// MODUL LAPORAN STATISTIK WARUNG (VERSI FILTER VENUE)
async function loadWarungStatistics() {
    // 1. Ambil Nilai dari Dropdown Filter
    const elVenue = document.getElementById('filter-stats-venue');
    const elTime = document.getElementById('report-filter');
    const tbody = document.getElementById('warung-ranking-body');

    if(!tbody) return;

    // Default 'all' jika elemen belum siap
    const venueFilter = elVenue ? elVenue.value : 'all';
    const timeFilter = elTime ? elTime.value : 'all';

    // 2. Ambil Data
    const q = query(collection(db, "bookings"), where("status", "==", "finished"));
    const snapshot = await getDocs(q);

    let totalVisitor = 0;
    let totalTrx = 0;
    let totalOmzet = 0;
    let warungStats = {}; 

    const now = new Date();
    
    snapshot.forEach(doc => {
        const d = doc.data();
        
        // Konversi Tanggal (Biar aman)
        let date = new Date();
        if(d.finishedAt && d.finishedAt.toDate) date = d.finishedAt.toDate();
        else if(d.timestamp && d.timestamp.toDate) date = d.timestamp.toDate();
        else if(d.timestamp) date = new Date(d.timestamp);
        
        // Asumsi lokasi. Jika di data booking gak ada nama venue, anggap data lama (Stadion)
        // Nanti Bapak bisa update sistem booking agar menyimpan nama venue juga.
        const dVenue = d.venueName || "Stadion Bayuangga Zone";

        // --- FILTER ---
        let include = true;

        // 1. Filter Venue
        if (venueFilter !== 'all' && dVenue !== venueFilter) include = false;

        // 2. Filter Waktu
        if (timeFilter !== 'all') {
            const checkDate = new Date(date);
            checkDate.setHours(0,0,0,0);
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const diffTime = Math.abs(today - checkDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

            if (timeFilter === 'today' && diffDays !== 0) include = false;
            if (timeFilter === 'week' && diffDays > 7) include = false;
            if (timeFilter === 'month' && diffDays > 30) include = false;
        }
           
        if (include) {
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
    
    const sortedWarung = Object.values(warungStats).sort((a,b) => b.omzet - a.omzet);

    if(sortedWarung.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Data kosong sesuai filter.</td></tr>';
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

// --- FUNGSI CETAK PDF LAPORAN FINAL (HEADER REPEATED + FOOTER + LOGO KECIL) ---
window.generateReportPDF = async function() {
    // 1. Cek Library
    if (typeof jspdf === 'undefined') { alert("Library PDF belum siap!"); return; }
    
    // 2. Ambil Filter
    const filterVenueEl = document.getElementById('filter-stats-venue');
    const filterTimeEl = document.getElementById('report-filter');
    const selectedVenueVal = filterVenueEl ? filterVenueEl.value : 'all';
    const selectedVenueText = filterVenueEl ? filterVenueEl.options[filterVenueEl.selectedIndex].text : 'Semua Venue';
    const selectedTimeVal = filterTimeEl ? filterTimeEl.value : 'all';
    const selectedTimeText = filterTimeEl ? filterTimeEl.options[filterTimeEl.selectedIndex].text : 'Semua Waktu';
    const printTime = new Date().toLocaleString('id-ID');

    document.body.style.cursor = 'wait';

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageHeight = doc.internal.pageSize.height || 297;

        // --- A. LOAD LOGO ---
        const getBase64FromUrl = async (url) => {
            try {
                const res = await fetch(url);
                const blob = await res.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => resolve(reader.result);
                });
            } catch (error) { return null; }
        };
        const logoUrl = "https://raw.githubusercontent.com/sekolakonangindonesia-prog/smipro-streetart/main/Logo_Stretart.png";
        const logoBase64 = await getBase64FromUrl(logoUrl);

        // --- B. AMBIL DATA ---
        const q = query(collection(db, "bookings"), where("status", "==", "finished"));
        const snapshot = await getDocs(q);

        // --- C. FILTER & GROUPING ---
        let groupedData = {}; 
        
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const date = d.finishedAt ? d.finishedAt.toDate() : (d.timestamp ? d.timestamp.toDate() : new Date());
            let vName = (d.venueName || "Stadion Bayuangga Zone").trim();

            // Filter Venue
            if (selectedVenueVal !== 'all' && vName !== selectedVenueVal) return;

            // Filter Waktu
            const checkDate = new Date(date); checkDate.setHours(0,0,0,0);
            const today = new Date(); today.setHours(0,0,0,0);
            let includeTime = false;
            
            if (selectedTimeVal === 'all') includeTime = true;
            else if (selectedTimeVal === 'today' && checkDate.getTime() === today.getTime()) includeTime = true;
            else if (selectedTimeVal === 'week') {
                const oneWeekAgo = new Date(today); oneWeekAgo.setDate(today.getDate() - 7);
                if (checkDate >= oneWeekAgo) includeTime = true;
            } else if (selectedTimeVal === 'month' && checkDate.getMonth() === today.getMonth() && checkDate.getFullYear() === today.getFullYear()) includeTime = true;

            if (!includeTime) return;

            const wName = d.warungName || "Unknown Warung";
            if (!groupedData[vName]) groupedData[vName] = {};
            if (!groupedData[vName][wName]) groupedData[vName][wName] = [];

            groupedData[vName][wName].push({
                date: date,
                table: Array.isArray(d.tableNum) ? d.tableNum.join(",") : d.tableNum,
                pax: d.pax,
                revenue: parseInt(d.revenue || 0)
            });
        });

        // --- D. FUNGSI GAMBAR HEADER & FOOTER ---
        // Ini fungsi sakti biar header muncul di tiap halaman
        const drawHeader = () => {
            // Logo (Ukuran diperkecil: 18x18)
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', 15, 10, 18, 18); 
            }

            // Judul (2 Baris)
            doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0,0,0);
            doc.text("LAPORAN DETAIL TRANSAKSI", 40, 18); 
            doc.text("MITRA ANGKRINGAN SMIPRO", 40, 24);
            
            // Info Filter
            doc.setFontSize(9); doc.setFont("helvetica", "normal");
            doc.text(`Lokasi: ${selectedVenueText}`, 40, 31);
            doc.text(`Periode: ${selectedTimeText} | Cetak: ${printTime}`, 40, 36);

            // Garis Pembatas Header
            doc.setLineWidth(0.5); doc.setDrawColor(0,0,0);
            doc.line(15, 42, 195, 42); 
        };

        const drawFooter = () => {
            doc.setFontSize(8); 
            doc.setTextColor(150, 150, 150); // Abu-abu samar
            doc.text("@ Yayasan Sekola Konang Indonesia - SMIPRO StreetArt.id", 105, pageHeight - 10, null, null, "center");
            doc.setTextColor(0,0,0); // Balikin jadi hitam
        };

        // --- E. MULAI CETAK ---
        let y = 50; // Posisi Y Awal (di bawah header)
        
        // Cetak Header Halaman 1
        drawHeader();
        drawFooter();

        if (Object.keys(groupedData).length === 0) {
            doc.text("Tidak ada data transaksi sesuai filter.", 105, 60, null, null, "center");
            doc.save(`Laporan_Kosong.pdf`);
            document.body.style.cursor = 'default';
            return;
        }

        let grandTotal = 0;
        const sortedVenues = Object.keys(groupedData).sort();
        
        for (const venueKey of sortedVenues) {
            let venueTotal = 0;

            // Cek Ganti Halaman (Venue)
            if (y > 250) { 
                doc.addPage(); 
                drawHeader(); 
                drawFooter(); 
                y = 50; 
            }

            // HEADER VENUE
            doc.setFillColor(30, 30, 30); 
            doc.rect(15, y, 180, 10, 'F');
            doc.setTextColor(255, 215, 0); 
            doc.setFontSize(12); doc.setFont("helvetica", "bold");
            doc.text(`LOKASI: ${venueKey.toUpperCase()}`, 18, y + 7);
            doc.setTextColor(0, 0, 0);
            y += 15;

            const sortedWarungs = Object.keys(groupedData[venueKey]).sort();

            for (const warungKey of sortedWarungs) {
                const transactions = groupedData[venueKey][warungKey];
                transactions.sort((a, b) => a.date - b.date);

                if (y > 250) { 
                    doc.addPage(); 
                    drawHeader(); 
                    drawFooter(); 
                    y = 50; 
                }

                // Header Warung
                doc.setFillColor(230, 230, 230);
                doc.rect(15, y, 180, 7, 'F');
                doc.setFontSize(10); doc.setFont("helvetica", "bold");
                doc.text(`Warung: ${warungKey}`, 18, y + 5);
                y += 10;

                // Header Tabel
                doc.setFontSize(8); doc.setFont("helvetica", "bold");
                doc.text("Tgl & Jam", 18, y);
                doc.text("Meja", 60, y);
                doc.text("Pax", 90, y);
                doc.text("Nominal (Rp)", 160, y);
                doc.line(15, y+2, 195, y+2);
                y += 5;

                let warungSubtotal = 0;
                doc.setFont("helvetica", "normal");

                transactions.forEach(t => {
                    // Cek Ganti Halaman (Baris Transaksi)
                    if (y > 275) { 
                        doc.addPage(); 
                        drawHeader(); 
                        drawFooter();
                        y = 50; 
                        doc.setFontSize(8); doc.setFont("helvetica", "italic");
                        doc.text(`(Lanjutan ${warungKey})...`, 18, y);
                        y+=5;
                        doc.setFont("helvetica", "normal");
                    }
                    
                    const dateStr = t.date.toLocaleString('id-ID', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
                    doc.text(dateStr, 18, y);
                    doc.text(`No. ${t.table}`, 60, y);
                    doc.text(`${t.pax}`, 90, y);
                    doc.text(t.revenue.toLocaleString('id-ID'), 160, y);
                    
                    warungSubtotal += t.revenue;
                    y += 5;
                });

                // Subtotal Warung
                y += 2; doc.line(100, y, 195, y); y += 5;
                doc.setFont("helvetica", "bold");
                doc.text(`Total ${warungKey}:`, 100, y);
                doc.text(`Rp ${warungSubtotal.toLocaleString('id-ID')}`, 160, y);
                y += 10;

                venueTotal += warungSubtotal;
            }

            // Subtotal Venue
            if (y > 260) { doc.addPage(); drawHeader(); drawFooter(); y = 50; }
            
            doc.setFontSize(11); 
            doc.setFillColor(255, 248, 220); 
            doc.rect(15, y-5, 180, 10, 'F');
            doc.text(`TOTAL OMZET ${venueKey.toUpperCase()}`, 18, y+2);
            doc.text(`Rp ${venueTotal.toLocaleString('id-ID')}`, 160, y+2);
            y += 15;

            grandTotal += venueTotal;
        }

        // --- F. GRAND TOTAL ---
        if (y > 260) { doc.addPage(); drawHeader(); drawFooter(); y = 50; }
        
        y += 5; doc.setLineWidth(1); doc.line(15, y, 195, y); y += 10;
        
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text("GRAND TOTAL SEMUA:", 80, y);
        doc.setTextColor(0, 150, 0); 
        doc.text(`Rp ${grandTotal.toLocaleString('id-ID')}`, 195, y, {align: "right"});
        
        const fileName = `Laporan_Mitra_${selectedVenueVal === 'all' ? 'SemuaVenue' : selectedVenueText}_${new Date().getTime()}.pdf`;
        doc.save(fileName);

    } catch (error) {
        console.error("PDF Error:", error);
        alert("Gagal mencetak PDF: " + error.message);
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
            
             tbody.innerHTML += `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${data.img || 'https://via.placeholder.com/50'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #333;">
                        <b>${data.name}</b>
                    </div>
                </td>
                <td>${data.genre}</td>
                <td>${statusIcon}</td>
                <td>${btnLogin} ${btnDel}</td>
            </tr>`;
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

             const statusLabel = (data.status === 'pending') 
                ? '<span style="color:orange;">Menunggu</span>' 
                : '<span style="color:#00ff00;">Aktif</span>';
            
            const btnLogin = `<button class="btn-action btn-view" onclick="loginAsMentor('${docSnap.id}', '${data.name}')"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>`;
            const btnDel = `<button class="btn-action btn-delete" onclick="deleteMentor('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>`;
            tbody.innerHTML += `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${data.img || 'https://via.placeholder.com/50'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #333;">
                        <b>${data.name}</b>
                    </div>
                </td>
                <td>${data.specialist || data.specialty}</td>
                <td>${statusLabel}</td>
                <td>${btnLogin} ${btnDel}</td>
            </tr>`;
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

            // Cek Status Kelengkapan Nilai
            const isComplete = (totalMentors > 0 && jumlahDinilai >= totalMentors);
            
            let statusHTML = '';
            // Variabel Tombol Print (Default Kosong)
            let btnPrint = '';

            if (jumlahDinilai === 0) {
                statusHTML = `<span style="color:#888;">Belum ada nilai</span>`;
            } else if (isComplete) {
                statusHTML = `<span style="color:#00ff00; font-weight:bold;">Selesai (${jumlahDinilai}/${totalMentors})</span>`;
                
                // MUNCULKAN TOMBOL PRINT (HIJAU)
                btnPrint = `
                <button class="btn-action btn-view" style="background:#28a745;" onclick="printRaportDirect('${id}')" title="Cetak Raport">
                    <i class="fa-solid fa-print"></i>
                </button>`;
            
            } else {
                statusHTML = `<span style="color:orange;">Proses: ${jumlahDinilai} / ${totalMentors} Mentor</span>`;
            }

            // GABUNGKAN TOMBOL AKSI
            const actionBtns = `
                <div style="display:flex; gap:5px; justify-content:center;">
                    <button class="btn-action btn-view" onclick="openRaport('${id}')" title="Lihat Detail">
                        <i class="fa-solid fa-list-check"></i>
                    </button>
                    
                    ${btnPrint}  <!-- PRINTER MUNCUL DISINI -->

                    <button class="btn-action btn-delete" onclick="deleteStudent('${id}', '${data.name}')" title="Hapus Siswa">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>`;

            const imgHTML = `<img src="${data.img}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #555;">`;
            
            tbody.innerHTML += `
            <tr>
                <td style="text-align:center;">${imgHTML}</td>
                <td><b>${data.name}</b></td>
                <td>${data.genre}</td>
                <td>${statusHTML}</td>
                <td>${actionBtns}</td>
            </tr>`;
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


// === KODE CETAK RAPORT (FIX DATA MENTOR & FOTO) ===

// 1. Fungsi Load Gambar (Versi Lebih Kuat)
async function getBase64ImageFromUrl(url) {
    if (!url) return null;
    try {
        // Mode 'cors' penting untuk izin akses gambar dari server lain
        const res = await fetch(url, { method: 'GET', mode: 'cors' });
        if (!res.ok) throw new Error("Gagal download gambar");
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Skip Gambar (Mungkin kena blokir CORS/Rules):", url);
        return null;
    }
}

// 2. FUNGSI UTAMA
window.printRaportDirect = async function(id) {
    // Cek Library PDF
    if (typeof jspdf === 'undefined') { alert("Library PDF belum siap!"); return; }    
    
    // Ubah kursor jadi loading
    document.body.style.cursor = 'wait';
    const originalText = document.body.innerHTML; // Opsional: Simpan state jika perlu

    try {
        const { jsPDF } = window.jspdf;
        const myPdf = new jsPDF('p', 'mm', 'a4'); // Variabel aman 'myPdf'

        // ==========================================
        // LANGKAH 1: AMBIL DATA MENTOR (WAJIB DULUAN)
        // ==========================================
        const mentorMap = {};
        try {
            console.log("Sedang mengambil data mentor...");
            // Pastikan nama koleksi 'mentors' sesuai screenshot Firebase
            const mentorsCol = collection(db, "mentors"); 
            const mentorsSnap = await getDocs(mentorsCol);
            
            if (mentorsSnap.empty) {
                console.warn("PERINGATAN: Koleksi 'mentors' kosong atau tidak bisa diakses!");
            }

            mentorsSnap.forEach(d => {
                const m = d.data();
                // Ambil field 'name' sesuai screenshot Firebase
                // Jika tidak ada 'name', coba 'nama', 'fullname', atau 'username'
                const realName = m.name || m.nama || m.fullname || "Tanpa Nama";
                
                // Simpan mapping: ID -> Nama Asli
                mentorMap[d.id] = realName;
            });
            console.log("Berhasil memuat jumlah mentor:", Object.keys(mentorMap).length);

        } catch (err) {
            console.error("GAGAL AMBIL MENTOR:", err);
            alert("Gagal mengambil data mentor. Cek koneksi atau izin Firebase (Rules).");
        }


        // ==========================================
        // LANGKAH 2: AMBIL DATA SISWA
        // ==========================================
        const studentSnap = await getDoc(doc(db, "students", id));
        if (!studentSnap.exists()) { throw "Data siswa tidak ditemukan"; }
        
        const sData = studentSnap.data();
        const sScores = sData.scores || {}; // Nilai siswa


        // ==========================================
        // LANGKAH 3: SIAPKAN GAMBAR
        // ==========================================
        
        // A. Background Template
        const bgUrl = "https://raw.githubusercontent.com/sekolakonangindonesia-prog/smipro-streetart/refs/heads/main/Raport%20siwa%20SMIPRO.jpg";
        const bgData = await getBase64ImageFromUrl(bgUrl);

        // B. Foto Siswa
        // Cek nama field foto. Sesuai screenshot mentor pakai 'img',
        // mungkin siswa juga pakai 'img'. Kita cek semuanya.
        const linkFoto = sData.img || sData.foto || sData.foto_url || sData.photoUrl || sData.url_foto;
        
        let fotoData = null;
        if (linkFoto) {
            fotoData = await getBase64ImageFromUrl(linkFoto);
        } else {
            console.log("Link foto tidak ditemukan di data siswa.");
        }


        // ==========================================
        // LANGKAH 4: MENGGAMBAR PDF
        // ==========================================

        // 1. Pasang Background
        if (bgData) {
            myPdf.addImage(bgData, 'JPEG', 0, 0, 210, 297);
        }

        // 2. Pasang Foto Siswa
        let startY = 60; 
        if (fotoData) {
            myPdf.addImage(fotoData, 'JPEG', 20, startY, 30, 40);
        } else {
            // Jika foto gagal/tidak ada, gambar kotak kosong
            myPdf.setDrawColor(150);
            myPdf.rect(20, startY, 30, 40); // Kotak 3x4
            myPdf.setFontSize(8);
            myPdf.setTextColor(100);
            myPdf.text("Foto Tidak", 22, startY + 15);
            myPdf.text("Tersedia", 24, startY + 20);
            
            // Debugging info di PDF (biar tau kenapa gagal)
            if (linkFoto) {
                myPdf.setFontSize(6);
                myPdf.text("(Error Akses)", 23, startY + 30);
            } else {
                myPdf.text("(Data Kosong)", 23, startY + 30);
            }
        }

        // 3. Teks Biodata
        const textX = 60;
        myPdf.setFont("helvetica", "bold");
        myPdf.setFontSize(14);
        myPdf.setTextColor(0, 0, 0); // Hitam
        
        myPdf.text(`NAMA: ${(sData.name || "Siswa").toUpperCase()}`, textX, startY + 10);
        
        myPdf.setFont("helvetica", "normal");
        myPdf.setFontSize(12);
        myPdf.text(`Genre: ${sData.genre || "-"}`, textX, startY + 20);
        
        const today = new Date().toLocaleDateString('id-ID');
        myPdf.text(`Tanggal Cetak: ${today}`, textX, startY + 30);


        // 4. Tabel Nilai (DENGAN MAPPING NAMA)
        let tableBody = [];
        let totalScore = 0;
        let count = 0;

        for (let keyID in sScores) {
            let nilai = parseInt(sScores[keyID]);
            let predikat = nilai >= 85 ? "(Sangat Baik)" : nilai >= 75 ? "(Kompeten)" : "(Cukup)";
            
            // LOGIKA UTAMA: Ganti ID dengan Nama dari Map
            let namaMentorFinal = mentorMap[keyID];
            
            // Jika nama tidak ketemu di Map, tampilkan ID-nya (buat debug)
            if (!namaMentorFinal) {
                namaMentorFinal = keyID; // Tampilkan ID saja dulu
                console.warn("ID Mentor ini tidak ada di database mentors:", keyID);
            }

            tableBody.push([namaMentorFinal, "Umum", `${nilai} ${predikat}`]);
            
            // Hitung rata-rata sekalian
            totalScore += nilai;
            count++;
        }
        const avg = count > 0 ? (totalScore / count) : 0;

        myPdf.autoTable({
            startY: 110,
            head: [['Nama Mentor', 'Bidang Keahlian', 'Nilai & Predikat']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [220, 0, 0], textColor: 255 },
            styles: { fontSize: 10, cellPadding: 3 },
            margin: { left: 20, right: 20 }
        });


        // 5. Status & Nilai Rata-rata
        let finalY = myPdf.lastAutoTable.finalY + 20;

        myPdf.setFont("helvetica", "bold");
        myPdf.setFontSize(12);
        myPdf.setTextColor(0,0,0);
        myPdf.text("STATUS AKHIR:", 20, finalY);
        myPdf.setFontSize(14);
        myPdf.text("LULUS / SIAP PERFORM", 20, finalY + 10);

        // Posisi Nilai
        const boxX = 145; 
        const boxY = 225; 

        myPdf.setFontSize(10);
        myPdf.text("NILAI RATA-RATA:", boxX + 15, boxY - 6, { align: 'center' });

        myPdf.setFontSize(24);
        myPdf.setTextColor(220, 0, 0); // Merah
        myPdf.text(avg.toFixed(1), boxX + 15, boxY + 2, { align: 'center' }); 

        // 6. Simpan File
        myPdf.save(`Raport_${sData.name || "Siswa"}.pdf`);

    } catch (e) {
        console.error("ERROR PRINT:", e);
        alert("Terjadi kesalahan: " + e.message);
    } finally {
        document.body.style.cursor = 'default';
    }
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

/* =========================================
   AKSI TOMBOL LIVE MONITOR (TERIMA / TOLAK / SELESAI)
   ========================================= */

// 1. TERIMA DANA (Pindah status: pending -> approved)
window.approveReq = async function(id) {
    try {
        const docRef = doc(db, "requests", id);
        await updateDoc(docRef, { 
            status: "approved" 
        });
        // Tidak perlu alert, karena layar akan update otomatis (realtime)
        console.log("✅ Request diterima:", id);
    } catch (e) {
        alert("Gagal terima data: " + e.message);
    }
}

// C. ACTION BUTTONS (DITEMPEL KE WINDOW AGAR BISA DIKLIK DI HTML)
window.approveReq = async function(id) {
    if(confirm("Pastikan uang sudah masuk mutasi?")) {
        try {
            await updateDoc(doc(db, "requests", id), { status: 'approved' });
            // Tidak perlu alert, karena onSnapshot akan memindahkannya otomatis ke kolom kanan
        } catch(e) {
            alert("Gagal update: " + e.message);
        }
    }
}

window.finishReq = async function(id) {
    if(confirm("Lagu selesai dinyanyikan? Arsipkan ke laporan?")) {
        await updateDoc(doc(db, "requests", id), { status: 'finished' });
    }
}

window.deleteReq = async function(id) {
    if(confirm("Tolak request ini? Data akan dihapus permanen.")) {
        await deleteDoc(doc(db, "requests", id));
    }
}

/* =========================================
   B. STATISTIK & LAPORAN (VERSI FIX FINAL - MANUAL & LENGKAP)
   ========================================= */

let statsUnsubscribe = null;

// 1. DAFTAR VENUE MANUAL (Biar Dropdown PASTI MUNCUL walau DB Error)
window.daftarVenueValid = [
    "Stadion Bayuangga Zone",
    "Angkringan GOR Mastrip", 
    "Angkringan TWSL", 
    "Angkringan Siaman", 
    "Angkringan A. Yani"
];

// 2. INIT SYSTEM
window.initFinanceSystem = function() {
    console.log("🚀 Memulai Sistem Keuangan...");
    window.loadVenueOptions();   
    window.renderFinanceData();  
}

// 3. ISI DROPDOWN (Manual dari Array di atas)
window.loadVenueOptions = function() {
    const locSelect = document.getElementById('filter-uang-lokasi'); 
    if(!locSelect) return;

    // Reset Dropdown
    locSelect.innerHTML = `<option value="all">Semua Lokasi</option>`;

    // Masukkan nama-nama venue dari daftar manual
    window.daftarVenueValid.forEach(venueName => {
        const option = document.createElement("option");
        option.value = venueName; 
        option.text = venueName;
        locSelect.appendChild(option);
    });
    
    // Kita ubah teks "Stadion Bayuangga Zone" jadi "Stadion Pusat" biar enak dilihat (Opsional)
    // Cari opsinya dan ubah text-nya
    for (let i = 0; i < locSelect.options.length; i++) {
        if (locSelect.options[i].value === "Stadion Bayuangga Zone") {
            locSelect.options[i].text = "Stadion Pusat";
        }
    }

    console.log("✅ Dropdown Terisi Lengkap (Mode Manual).");
}

// 4. TARIK DATA & FILTER
window.renderFinanceData = function() {
    const elLokasi = document.getElementById('filter-uang-lokasi');
    const filterLoc = elLokasi ? elLokasi.value : 'all';
    
    const tbody = document.getElementById('table-history-body');
    const chartContainer = document.getElementById('chart-top-songs');

    if(!tbody) return;

    // QUERY DATABASE
    const q = query(collection(db, "requests"));

    if(statsUnsubscribe) statsUnsubscribe();

    statsUnsubscribe = onSnapshot(q, (snapshot) => {
        let totalMoney = 0;
        let totalReq = 0;
        let perfStats = {}; // Wadah hitung artis
        let songStats = {};
        let tempList = [];
        
        snapshot.forEach(doc => {
            const d = doc.data();

            // Saring Status Finished
            if (!d.status || d.status.toString().toLowerCase() !== 'finished') return;

            let dateObj = d.timestamp ? (d.timestamp.toDate ? d.timestamp.toDate() : new Date(d.timestamp)) : new Date();
            let dataLoc = d.location ? d.location : "Stadion Bayuangga Zone";

            // === 1. SATPAM VENUE (Sesuai Daftar Manual) ===
            // Kalau lokasi data TIDAK ADA di daftar manual, TENDANG! (Gria Batik hilang disini)
            const isListed = window.daftarVenueValid.some(v => v.toLowerCase() === dataLoc.trim().toLowerCase());
            if (!isListed) return; 

            // === 2. FILTER DROPDOWN ===
            if (filterLoc !== 'all') {
                if (dataLoc.trim().toLowerCase() !== filterLoc.trim().toLowerCase()) return; 
            }

            tempList.push({ ...d, dateObj: dateObj, loc: dataLoc, amount: parseInt(d.amount)||0 });
        });

        // Urutkan Terbaru
        tempList.sort((a,b) => b.dateObj - a.dateObj);

        // === SISIPAN UNTUK PDF (Insert This) ===
        // Simpan data bersih ke variabel global biar bisa diambil fungsi PDF
        window.laporanSiapCetak = tempList; 
        
        // Simpan Info filter untuk Judul PDF
        const elTime = document.getElementById('stats-time');
        window.infoLaporan = {
            lokasi: document.getElementById('filter-uang-lokasi').value,
            periode: elTime ? elTime.options[elTime.selectedIndex].text : "Semua Waktu"
        };
        
        // Update Label Tombol PDF
        const btnPdf = document.querySelector('button[onclick="generateSawerPDF()"]');
        if(btnPdf) btnPdf.innerHTML = `<i class="fa-solid fa-print"></i> PDF (${tempList.length})`;
        // === BATAS SISIPAN ===

        // Render Tabel
        let htmlRows = '';
        if(tempList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#888;">Data kosong.</td></tr>';
            document.getElementById('stat-total-money').innerText = "Rp 0";
            document.getElementById('stat-total-req').innerText = "0";
            document.getElementById('stat-top-perf').innerText = "-"; // Reset Top Artis
            if(chartContainer) chartContainer.innerHTML = '';
            return;
        }

        tempList.forEach(d => {
            totalMoney += d.amount;
            totalReq++;

            // HITUNG TOP ARTIS (Diperbaiki)
            let pName = d.performer || "Unknown";
            if(!perfStats[pName]) perfStats[pName] = 0;
            perfStats[pName] += d.amount;

            // Hitung Lagu
            let sTitle = d.song.trim();
            if(!songStats[sTitle]) songStats[sTitle] = { count: 0, title: d.song };
            songStats[sTitle].count++;

            htmlRows += `
            <tr>
                <td>${d.dateObj.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}<br><small>${d.dateObj.toLocaleDateString()}</small></td>
                <td><b>${d.song}</b><br><small>${d.performer}</small></td>
                <td><span style="color:#00ff00">Rp ${d.amount.toLocaleString()}</span><br><small>${d.loc}</small></td>
            </tr>`;
        });

        tbody.innerHTML = htmlRows;
        document.getElementById('stat-total-money').innerText = "Rp " + totalMoney.toLocaleString();
        document.getElementById('stat-total-req').innerText = totalReq;
        
        // === RENDER TOP ARTIS (LANGSUNG DISINI BIAR GAK RUSAK) ===
        const sortedPerf = Object.entries(perfStats).sort(([,a], [,b]) => b - a);
        const elTopPerf = document.getElementById('stat-top-perf');
        if(elTopPerf) {
            if(sortedPerf.length > 0) {
                // Tampilkan Artis #1
                elTopPerf.innerHTML = `<span style="color:gold;">${sortedPerf[0][0]}</span> <br><small>Rp ${sortedPerf[0][1].toLocaleString()}</small>`;
            } else {
                elTopPerf.innerText = "-";
            }
        }

        // === RENDER GRAFIK LAGU (LANGSUNG DISINI JUGA) ===
        if(chartContainer) {
            chartContainer.innerHTML = '';
            const sortedSongs = Object.values(songStats).sort((a,b) => b.count - a.count).slice(0, 5);
            if(sortedSongs.length > 0) {
                const maxCount = sortedSongs[0].count;
                sortedSongs.forEach((item, index) => {
                    const widthPct = (item.count / maxCount) * 100;
                    chartContainer.innerHTML += `
                    <div style="margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
                            <span style="color:white;">#${index+1} ${item.title}</span>
                            <span style="color:gold;">${item.count}</span>
                        </div>
                        <div style="background:#333; height:6px; border-radius:3px;">
                            <div style="background:#E50914; height:100%; width:${widthPct}%;"></div>
                        </div>
                    </div>`;
                });
            }
        }
    });
}

/* =========================================
   C. GENERATE PDF (VERSI AMAN - SUBTITLES & TOTAL)
   ========================================= */
// --- FUNGSI GENERATE PDF RAPORT (FIX LOGO) ---
window.generateStudentPDF = async function(studentData, averageScore) {
    if (typeof jspdf === 'undefined') { alert("Library PDF belum dipasang!"); return; }
    
    document.body.style.cursor = 'wait';

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // --- FUNGSI BARU: LEBIH KUAT MENEMBUS CORS ---
        // Menggunakan fetch blob lebih stabil daripada new Image()
        const getBase64FromUrl = async (url) => {
            try {
                const res = await fetch(url);
                const blob = await res.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => resolve(reader.result);
                });
            } catch (error) {
                console.error("Gagal load logo:", error);
                return null;
            }
        };

        // 1. LOAD LOGO DENGAN CARA BARU
        const logoUrl = "https://raw.githubusercontent.com/sekolakonangindonesia-prog/smipro-streetart/main/Logo_Stretart.png";
        const logoBase64 = await getBase64FromUrl(logoUrl);

        // 2. HEADER PDF (HITAM)
        doc.setFillColor(20, 20, 20); 
        doc.rect(0, 0, 210, 45, 'F'); 
        
        // TEMPEL LOGO (Jika berhasil didownload)
        if (logoBase64) {
            // Format 'PNG' wajib sesuai dengan format asli gambar
            doc.addImage(logoBase64, 'PNG', 15, 5, 35, 35); 
        }

        // JUDUL
        doc.setTextColor(255, 215, 0); // Emas
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("SMIPRO MUSIC ACADEMY", 115, 23, null, null, "center");
        
        doc.setTextColor(255, 255, 255); // Putih
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Laporan Hasil Evaluasi & Performansi Siswa", 115, 31, null, null, "center");

        // 3. FOTO & IDENTITAS SISWA
        let y = 70;
        
        // Foto Siswa (Ini Base64 dari upload, jadi aman)
        if(studentData.img && studentData.img.length > 50) {
            try { 
                // Deteksi format gambar siswa (JPEG/PNG)
                const imgFormat = studentData.img.includes('image/png') ? 'PNG' : 'JPEG';
                doc.addImage(studentData.img, imgFormat, 20, 60, 40, 40); 
            } catch(e) { console.error("Foto siswa skip:", e); }
        }
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text(`NAMA: ${studentData.name.toUpperCase()}`, 70, 70);
        
        doc.setFontSize(12); doc.setFont("helvetica", "normal");
        doc.text(`Genre: ${studentData.genre}`, 70, 80);
        doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 70, 90);

        // 4. SIAPKAN DATA NILAI
        const mentorSnap = await getDocs(collection(db, "mentors"));
        let tableBody = [];
        const scores = studentData.scores || {};

        mentorSnap.forEach(docSnap => {
            const m = docSnap.data();
            const nilai = scores[docSnap.id]; 
            
            if(nilai) {
                let statusText = parseInt(nilai) >= 75 ? `${nilai} (Kompeten)` : `${nilai} (Remidi)`;
                tableBody.push([ m.name, m.specialty || "Umum", statusText ]);
            }
        });

        // 5. BUAT TABEL
        doc.autoTable({
            startY: 110,
            head: [['Nama Mentor', 'Bidang Keahlian', 'Nilai & Predikat']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [229, 9, 20] }, 
            styles: { fontSize: 11, cellPadding: 4 }
        });

        // 6. NILAI AKHIR (FOOTER)
        let finalY = doc.lastAutoTable.finalY + 20;
        if (finalY > 250) { doc.addPage(); finalY = 20; }

        doc.setLineWidth(1); doc.setDrawColor(0);
        doc.rect(120, finalY, 70, 30);
        
        doc.setFontSize(12); doc.setTextColor(0,0,0);
        doc.text("NILAI RATA-RATA:", 155, finalY + 10, null, null, "center");
        
        doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(229, 9, 20);
        doc.text(String(averageScore.toFixed(1)), 155, finalY + 22, null, null, "center");

        doc.setTextColor(0,0,0); doc.setFontSize(12);
        doc.text("STATUS AKHIR:", 20, finalY + 10);
        
        let statusLulus = averageScore >= 75 ? "LULUS / SIAP PERFORM" : "BELUM LULUS";
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text(statusLulus, 20, finalY + 20);

        // 7. DOWNLOAD
        doc.save(`Raport_${studentData.name.replace(/\s+/g, '_')}.pdf`);

    } catch(e) {
        console.error("PDF Error:", e);
        alert("Gagal membuat PDF: " + e.message);
    } finally {
        document.body.style.cursor = 'default';
    }
}


/* =========================================
   8. DASHBOARD OVERVIEW (VERSI STABIL + PERBAIKAN UANG)
   ========================================= */

async function loadDashboardOverview() {
    console.log("🚀 MEMULAI HITUNG ULANG KEUANGAN...");

    const notifArea = document.getElementById('admin-notification-area');
    const elMitra = document.getElementById('count-mitra');
    const elPerf = document.getElementById('count-perf');
    const elRevTotal = document.getElementById('rev-total');
    const elRevVenue = document.getElementById('rev-venue');
    const elRevCafe = document.getElementById('rev-cafe');

    try {
        // 1. AMBIL DATA
        const mitraSnap = await getDocs(collection(db, "warungs"));
        const perfSnap = await getDocs(collection(db, "performers"));
        const mentorSnap = await getDocs(collection(db, "mentors"));
        const siswaSnap = await getDocs(collection(db, "students"));
        const reqSnap = await getDocs(collection(db, "requests")); 
        const venueSnap = await getDocs(collection(db, "venues")); 

        // Update Statistik User
        if(elMitra) elMitra.innerText = mitraSnap.size;
        if(elPerf) elPerf.innerText = perfSnap.size;

        // 2. CEK DAFTAR VENUE RESMI
        let officialVenues = [];
        venueSnap.forEach(doc => {
            const data = doc.data();
            if (data.name) {
                // Simpan nama venue (huruf kecil semua)
                officialVenues.push(data.name.trim().toLowerCase());
            }
        });
        
        console.log("📋 DAFTAR VENUE RESMI DI DATABASE:", officialVenues);

        // 3. HITUNG UANG
        let sawerVenue = 0;
        let sawerCafe = 0;

        reqSnap.forEach(doc => {
            const d = doc.data();
            
            // Cek Status: Hanya yang duitnya sudah masuk
            if (d.status === 'approved' || d.status === 'finished') {
                const nominal = parseInt(d.amount || 0);
                const rawLoc = d.location || "Tanpa Lokasi";
                const cleanLoc = rawLoc.trim().toLowerCase();

                // LOGIKA PENCOCOKAN
                // Apakah lokasi transaksi ini ada di daftar resmi?
                const isVenue = officialVenues.some(v => cleanLoc.includes(v) || v.includes(cleanLoc));

                // --- CCTV: LAPORKAN SETIAP TRANSAKSI ---
                if (isVenue) {
                    console.log(`✅ VENUE: Rp ${nominal} dari [${rawLoc}]`);
                    sawerVenue += nominal;
                } else {
                    console.log(`☕ CAFE: Rp ${nominal} dari [${rawLoc}] (Tidak cocok dengan daftar venue)`);
                    sawerCafe += nominal;
                }
            }
        });

        console.log(`💰 HASIL AKHIR: Venue=${sawerVenue}, Cafe=${sawerCafe}`);

        // Tampilkan Hasil
        const totalRev = sawerVenue + sawerCafe;
        if(elRevVenue) elRevVenue.innerText = "Rp " + sawerVenue.toLocaleString('id-ID');
        if(elRevCafe) elRevCafe.innerText = "Rp " + sawerCafe.toLocaleString('id-ID');
        if(elRevTotal) elRevTotal.innerText = "Rp " + totalRev.toLocaleString('id-ID');
        // ---------------------------------------------------------


        // 4. KEMBALIKAN NOTIFIKASI (LOGIKA LAMA)
        if(!notifArea) return; 
        notifArea.innerHTML = ''; 
        let adaNotif = false;

        // A. CEK WARUNG
        mitraSnap.forEach(doc => {
            const d = doc.data();
            if (!d.adminApproved) {
                adaNotif = true;
                let judul = "🆕 Pendaftaran Mitra Baru";
                let pesan = `<b>${d.name}</b> mendaftar (${d.totalTables || 0} meja).`;
                let warna = "#FFD700"; 
                if (d.totalTables > 15) {
                    judul = "⚠️ Pengajuan Meja Ekstrem";
                    warna = "#E50914"; 
                }
                notifArea.innerHTML += `
                <div class="notif-card" style="border-left: 5px solid ${warna}; background: #151515; padding: 15px; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div class="notif-content">
                        <h4 style="margin:0; color:${warna};">${judul}</h4>
                        <p style="margin:5px 0 0; color:#ccc; font-size:0.85rem;">${pesan}</p>
                    </div>
                    <div class="notif-action">
                        <button class="btn-action btn-view" onclick="openMitraApproval('${doc.id}')" style="background:#00d2ff; color:black; font-weight:bold;">
                            <i class="fa-solid fa-eye"></i> Lihat Data
                        </button>
                    </div>
                </div>`;
            }
        });

        // B. CEK MENTOR
        mentorSnap.forEach(doc => {
            const d = doc.data();
            if(d.status === 'pending') {
                adaNotif = true;
                notifArea.innerHTML += `
                <div class="notif-card" style="border-left: 5px solid #00d2ff; background: #151515; padding: 15px; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div class="notif-content">
                        <h4 style="margin:0; color:#00d2ff;">👔 Pendaftaran Mentor</h4>
                        <p style="margin:5px 0 0; color:#ccc; font-size:0.85rem;"><b>${d.name}</b> (${d.specialist})</p>
                    </div>
                    <div class="notif-action">
                        <button class="btn-action btn-view" onclick="openMitraApproval('${doc.id}')"><i class="fa-solid fa-eye"></i> Lihat Data</button>                   
                        <button class="btn-action btn-delete" onclick="deleteMentor('${doc.id}')">Tolak</button>
                    </div>
                </div>`;
            }
        });

        // C. CEK SISWA
        const totalMentors = mentorSnap.size;
        siswaSnap.forEach(doc => {
            const d = doc.data();
            const scores = Object.values(d.scores || {});
            const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            const isCompleted = (totalMentors > 0 && scores.length >= totalMentors);

            if (d.status === 'training' && isCompleted && avg >= 75) {
                adaNotif = true;
                notifArea.innerHTML += `
                <div class="notif-card" style="border-left: 5px solid #2ecc71; background: #151515; padding: 15px; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div class="notif-content">
                        <h4 style="margin:0; color:#2ecc71;">🎓 Siswa Siap Lulus</h4>
                        <p style="margin:5px 0 0; color:#ccc; font-size:0.85rem;"><b>${d.name}</b> - Rata-rata: ${avg.toFixed(1)}</p>
                    </div>
                    <div class="notif-action">
                        <button class="btn-action btn-view" onclick="openSiswaApproval('${doc.id}')"><i class="fa-solid fa-eye"></i> Lihat Nilai</button>
                    </div>
                </div>`;
            }
        });

        // KOSONG
        if(!adaNotif) {
            notifArea.innerHTML = `<div class="empty-state-box"><p>Semua aman. Tidak ada notifikasi baru.</p></div>`;
        }

    } catch (e) {
        console.error("Gagal load overview:", e);
    }
}


/* =========================================
   LOGIKA POPUP APPROVAL (NEW)
   ========================================= */

// 1. POPUP MITRA
window.openMitraApproval = async function(id) {
    const docSnap = await getDoc(doc(db, "warungs", id));
    if(!docSnap.exists()) return;
    const d = docSnap.data();

    // Isi Data ke Modal
    document.getElementById('app-mitra-name').innerText = d.name;
    document.getElementById('app-mitra-owner').innerText = d.owner || "-";
    document.getElementById('app-mitra-venue').innerText = d.venueName || "Belum Dipilih"; // Menampilkan Lokasi
    document.getElementById('app-mitra-table').innerText = d.totalTables + " Meja";
    document.getElementById('app-mitra-phone').innerText = d.phone || "-";

    // Set Aksi Tombol
    document.getElementById('btn-reject-mitra').onclick = function() { deleteMitra(id); document.getElementById('modal-approve-mitra').style.display='none'; }
    document.getElementById('btn-accept-mitra').onclick = function() { approveTable(id); document.getElementById('modal-approve-mitra').style.display='none'; }

    // Tampilkan
    document.getElementById('modal-approve-mitra').style.display = 'flex';
}

// 2. POPUP SISWA
window.openSiswaApproval = async function(id) {
    const docSnap = await getDoc(doc(db, "students", id));
    if(!docSnap.exists()) return;
    const d = docSnap.data();
    const scores = d.scores || {};

    // Isi Header
    document.getElementById('app-siswa-name').innerText = d.name;
    document.getElementById('app-siswa-genre').innerText = d.genre;
    document.getElementById('app-siswa-img').src = d.img || "https://via.placeholder.com/150";

    // Isi Tabel Nilai
    const tbody = document.getElementById('app-siswa-scores');
    tbody.innerHTML = '<tr><td colspan="2">Memuat nilai...</td></tr>';
    
    // Ambil nama mentor
    const mentors = await getDocs(collection(db, "mentors"));
    let html = '';
    let total = 0; let count = 0;

    mentors.forEach(mDoc => {
        const m = mDoc.data();
        const nilai = scores[mDoc.id];
        if(nilai) {
            html += `<tr><td>${m.name}</td><td style="text-align:right; color:#00ff00; font-weight:bold;">${nilai}</td></tr>`;
            total += parseInt(nilai);
            count++;
        }
    });
    
    // Tambah Rata-rata
    if(count > 0) {
        const avg = (total/count).toFixed(1);
        html += `<tr style="background:#333;"><td style="font-weight:bold;">RATA-RATA TOTAL</td><td style="text-align:right; color:gold; font-weight:bold;">${avg}</td></tr>`;
    }
    
    tbody.innerHTML = html;

    // Set Tombol
    document.getElementById('btn-accept-siswa').onclick = function() { 
        luluskanSiswa(id, d.name, d.genre); 
        document.getElementById('modal-approve-siswa').style.display='none'; 
    }

    document.getElementById('modal-approve-siswa').style.display = 'flex';
}

// 3. FUNGSI BARU: EKSEKUSI KELULUSAN (Menambah ke Performer & Update Siswa)
window.luluskanSiswa = async function(studentId, name, genre, imgUrl) {
    if(!confirm(`Yakin meluluskan ${name}? \nAkun Performer akan otomatis dibuat.`)) return;

    try {
        // A. Buat Akun Baru di Koleksi 'performers'
        await addDoc(collection(db, "performers"), {
            name: name,
            genre: genre,
            img: imgUrl || "",
            rating: 5.0, // Rating awal
            verified: true,
            joinedAt: new Date(),
            desc: "Alumni Bengkel SMIPRO"
        });

        // B. Update Status Siswa jadi 'graduated' (Agar hilang dari notif)
        await updateDoc(doc(db, "students", studentId), {
            status: 'graduated'
        });

        alert("✅ Berhasil! Akun Performer telah diterbitkan.");
        
        // C. Tutup Modal & Refresh Dashboard
        document.getElementById('modal-approve-siswa').style.display = 'none';
        loadDashboardOverview(); // Refresh agar notifikasi hilang

    } catch (e) {
        console.error(e);
        alert("Gagal memproses: " + e.message);
    }
}

/* =========================================
   9. MODUL CAFE (MANAJEMEN & LAPORAN FIX)
   ========================================= */

// Variabel Global untuk Daftar Cafe Valid
window.listCafeValid = []; 

// A. NAVIGASI TAB
window.switchCafeTab = function(tabId, btn) {
    // Sembunyikan semua konten cafe
    document.querySelectorAll('.cafe-content').forEach(el => el.classList.add('hidden'));
    // Tampilkan tab yang dipilih
    const target = document.getElementById(tabId);
    if(target) target.classList.remove('hidden');
    
    // Atur tombol aktif
    if(btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    }
    if(btn) btn.classList.add('active');

    // Jika buka tab laporan, siapkan filter
    if(tabId === 'cafe-report') prepareReportFilters(); 
}

// B. MANAJEMEN CAFE (CRUD)
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

window.resetCafeForm = function() {
    document.getElementById('cafe-edit-id').value = "";
    document.getElementById('new-cafe-name').value = "";
    document.getElementById('new-cafe-address').value = "";
    document.getElementById('cafe-preview').src = "https://via.placeholder.com/100?text=Logo";
    currentCafeBase64 = null;
    document.getElementById('btn-save-cafe').innerText = "+ Simpan Partner";
    document.getElementById('btn-save-cafe').style.background = "";
    document.getElementById('btn-save-cafe').style.color = "";
    document.getElementById('btn-cancel-cafe').style.display = "none";
}

window.saveCafe = async function() {
    const id = document.getElementById('cafe-edit-id').value; 
    const name = document.getElementById('new-cafe-name').value;
    const addr = document.getElementById('new-cafe-address').value;
    const img = currentCafeBase64; 

    if(!name) return alert("Nama Cafe wajib diisi!");

    try {
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
                    name, address: addr, img: img || "", type: 'cafe', joinedAt: new Date()
                });
                alert("Cafe Ditambahkan!");
                resetCafeForm();
            }
        }
    } catch(e) { alert("Error: " + e.message); }
}

window.loadCafeData = function() {
    const tbody = document.getElementById('cafe-table-body');
    if(!tbody) return;

    onSnapshot(collection(db, "venues_partner"), (snap) => {
        tbody.innerHTML = '';
        if(snap.empty) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada partner.</td></tr>'; return; }

        snap.forEach(doc => {
            const d = doc.data();
            const btnEdit = `<button class="btn-action btn-edit" onclick="editCafe('${doc.id}', '${d.name}', '${d.address}', '${d.img}')"><i class="fa-solid fa-pen"></i></button>`;
            const btnDel = `<button class="btn-action btn-delete" onclick="deleteCafe('${doc.id}')"><i class="fa-solid fa-trash"></i></button>`;

            tbody.innerHTML += `
            <tr>
                <td><img src="${d.img || 'https://via.placeholder.com/50'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;"></td>
                <td><b>${d.name}</b></td>
                <td>${d.address}</td>
                <td>${btnEdit} ${btnDel}</td>
            </tr>`;
        });
    });
}

window.editCafe = function(id, name, addr, img) {
    document.getElementById('cafe-edit-id').value = id; 
    document.getElementById('new-cafe-name').value = name;
    document.getElementById('new-cafe-address').value = addr;
    document.getElementById('cafe-preview').src = img || "https://via.placeholder.com/100?text=Logo";
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


/* =========================================
   C. LAPORAN KHUSUS CAFE (VERSI STERIL - TANPA STADION)
   ========================================= */

// Variabel Global untuk Daftar Cafe Resmi
window.listCafeValid = []; 

// 1. ISI DROPDOWN FILTER (VERSI CUCI GUDANG)
window.prepareReportFilters = async function() {
    const locSelect = document.getElementById('rep-loc');
    const artSelect = document.getElementById('rep-art');
    
    // --- LANGKAH PEMBERSIHAN ---
    // Kita hapus paksa semua isi dropdown, lalu isi ulang.
    // Jadi kalau ada Stadion nyangkut, dia akan hilang.
    locSelect.innerHTML = `<option value="all">Semua Cafe Partner</option>`;
    
    // Reset Array Satpam
    window.listCafeValid = [];

    try {
        // Ambil data HANYA dari venues_partner (Cafe)
        const cafes = await getDocs(collection(db, "venues_partner"));
        
        cafes.forEach(doc => { 
            const d = doc.data();
            if(d.name) {
                // Masukkan Nama Cafe
                locSelect.innerHTML += `<option value="${d.name}">${d.name}</option>`;
                
                // Catat ke Satpam (Huruf kecil semua biar aman)
                window.listCafeValid.push(d.name.trim().toLowerCase());
            }
        });
        console.log("✅ Dropdown Cafe Bersih (Stadion Dibuang). List:", window.listCafeValid);
    } catch(e) { console.error("Gagal load cafe", e); }

    // Reset Dropdown Artis
    artSelect.innerHTML = `<option value="all">Semua Artis</option>`;
    try {
        const perfs = await getDocs(collection(db, "performers"));
        perfs.forEach(doc => { 
             const d = doc.data();
             if(d.name) artSelect.innerHTML += `<option value="${d.name}">${d.name}</option>`; 
        });
    } catch(e) { console.error(e); }
}


/* =========================================
   B. LAPORAN CAFE & TOUR (VERSI RAW FETCH & SMART FILTER)
   ========================================= */

// 1. ISI DROPDOWN FILTER (MURNI DARI DB CAFE)
window.prepareReportFilters = async function() {
    const locSelect = document.getElementById('rep-loc');
    const artSelect = document.getElementById('rep-art');
    
    // --- PEMBERSIHAN TOTAL ---
    // Kita reset isinya. HANYA ada "Semua Lokasi".
    // Tidak ada "Stadion Pusat" manual disini.
    locSelect.innerHTML = `<option value="all">Semua Lokasi</option>`;
    
    window.listCafeValid = []; // Reset Satpam

    try {
        // Ambil data HANYA dari koleksi 'venues_partner' (Isinya cuma Cafe)
        const cafes = await getDocs(collection(db, "venues_partner"));
        
        if (cafes.empty) {
            console.log("Tidak ada data cafe di database.");
        }

        cafes.forEach(doc => { 
            const d = doc.data();
            if(d.name) {
                // Masukkan Nama Cafe ke Dropdown
                // KITA TIDAK MENAMBAHKAN STADION DISINI
                locSelect.innerHTML += `<option value="${d.name}">${d.name}</option>`;
                
                // Masukkan ke Daftar Absen (Satpam)
                window.listCafeValid.push(d.name.trim().toLowerCase());
            }
        });
        
        console.log("✅ Dropdown Cafe Siap. Stadion harusnya hilang.", window.listCafeValid);

    } catch(e) { console.error("Gagal load cafe", e); }

    // Reset Dropdown Artis
    artSelect.innerHTML = `<option value="all">Semua Artis</option>`;
    try {
        const perfs = await getDocs(collection(db, "performers"));
        perfs.forEach(doc => { 
             const d = doc.data();
             if(d.name) artSelect.innerHTML += `<option value="${d.name}">${d.name}</option>`; 
        });
    } catch(e) { console.error(e); }
}

    /* =========================================
   PERBAIKAN FUNGSI LAPORAN CAFE & PDF
   (PASTE INI DI BAGIAN BAWAH FILE)
   ========================================= */

window.loadCafeReport = async function() {
    const locInput = document.getElementById('rep-loc').value;
    const timeInput = document.getElementById('rep-time').value;
    const artInput = document.getElementById('rep-art').value;
    const tbody = document.getElementById('rep-detail-body');

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">⏳ Mengambil data...</td></tr>';

    try {
        const reqSnap = await getDocs(collection(db, "requests"));
        let tempList = [];
        let totalMoney = 0;
        let totalSongs = 0;
        let perfCount = {};
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const validOptions = Array.from(document.querySelectorAll('#rep-loc option')).map(opt => opt.value.trim().toLowerCase());

        reqSnap.forEach(doc => {
            const d = doc.data();
            if(!d.status || d.status.toString().toLowerCase() !== 'finished') return;

            const dateObj = d.timestamp ? (d.timestamp.toDate ? d.timestamp.toDate() : new Date(d.timestamp)) : new Date();
            let dataLoc = d.location ? d.location : ""; 
            let locClean = dataLoc.trim().toLowerCase();

            if (locClean.includes("twsl") || locClean.includes("stadion")) return;
            if (!validOptions.includes(locClean)) return;
            if (locInput !== 'all' && locClean !== locInput.trim().toLowerCase()) return;

            const dateZero = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
            if (timeInput === 'today' && dateZero.getTime() !== todayStart.getTime()) return;
            if (timeInput === 'week') {
                let weekAgo = new Date(todayStart);
                weekAgo.setDate(todayStart.getDate() - 7);
                if(dateZero < weekAgo) return;
            }
            if (timeInput === 'month' && (dateObj.getMonth() !== now.getMonth() || dateObj.getFullYear() !== now.getFullYear())) return;

            if (artInput !== 'all') {
                const artistDB = (d.performer || "").toLowerCase().trim();
                if(artistDB !== artInput.toLowerCase().trim()) return;
            }

            tempList.push({ ...d, dateObj: dateObj, loc: dataLoc, amount: parseInt(d.amount)||0 });
        });

        tempList.sort((a,b) => b.dateObj - a.dateObj);
        window.cafeReportData = tempList;
        window.cafeReportInfo = { lokasi: locInput, periode: timeInput };

        if(tempList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Data Kosong.</td></tr>';
            document.getElementById('rep-total-money').innerText = "Rp 0";
            document.getElementById('rep-total-song').innerText = "0";
            document.getElementById('rep-top-artist').innerText = "-";
            return;
        }

        let html = '';
        tempList.forEach(d => {
            totalMoney += d.amount;
            totalSongs++;
            let p = d.performer || "Unknown";
            if(!perfCount[p]) perfCount[p] = 0;
            perfCount[p] += d.amount;

            html += `<tr>
                <td>${d.dateObj.toLocaleDateString()}</td>
                <td>${d.loc}</td>
                <td>${d.performer}</td>
                <td>${d.song}</td>
                <td style="color:#00ff00">Rp ${d.amount.toLocaleString()}</td>
            </tr>`;
        });

        tbody.innerHTML = html;
        document.getElementById('rep-total-money').innerText = "Rp " + totalMoney.toLocaleString();
        document.getElementById('rep-total-song').innerText = totalSongs;
        
        const sortedPerf = Object.entries(perfCount).sort(([,a], [,b]) => b - a);
        document.getElementById('rep-top-artist').innerText = sortedPerf.length > 0 ? sortedPerf[0][0] : "-";

    } catch(e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5">Gagal mengambil data.</td></tr>';
    }
};

   // 4. GENERATE PDF CAFE (VERSI FINAL: LOGO + HEADER BARU + FOOTER)
window.generateCafePDF = async function() {
    // 1. Cek Library
    if (typeof jspdf === 'undefined') { alert("Library PDF belum siap!"); return; }
    
    // 2. Ambil Data
    const data = window.cafeReportData || [];
    const info = window.cafeReportInfo || { lokasi: '-', periode: '-' };

    if (data.length === 0) {
        alert("Tidak ada data untuk dicetak. Silakan filter dulu.");
        return;
    }

    document.body.style.cursor = 'wait';

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageHeight = doc.internal.pageSize.height || 297;
        const printTime = new Date().toLocaleString('id-ID');

        // --- A. LOAD LOGO ---
        const getBase64FromUrl = async (url) => {
            try {
                const res = await fetch(url);
                const blob = await res.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => resolve(reader.result);
                });
            } catch (error) { return null; }
        };
        const logoUrl = "https://raw.githubusercontent.com/sekolakonangindonesia-prog/smipro-streetart/main/Logo_Stretart.png";
        const logoBase64 = await getBase64FromUrl(logoUrl);

        // --- B. LOGIKA GROUPING DATA (Sama seperti sebelumnya - sudah bagus) ---
        
        // Urutkan data berdasarkan Nama Lokasi
        let dataSorted = [...data].sort((a, b) => a.loc.localeCompare(b.loc));

        let tableBody = [];
        let currentVenue = "";
        let subTotal = 0;
        let grandTotal = 0;

        dataSorted.forEach((item, index) => {
            // Cek apakah Venue berubah?
            if (currentVenue !== item.loc) {
                // Cetak Subtotal grup sebelumnya
                if (currentVenue !== "") {
                    tableBody.push([
                        { 
                            content: `SUBTOTAL ${currentVenue.toUpperCase()}`, 
                            colSpan: 3, 
                            styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } 
                        },
                        { 
                            content: `Rp ${subTotal.toLocaleString('id-ID')}`, 
                            styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0,0,0] } 
                        }
                    ]);
                }

                // Reset untuk Grup Baru
                currentVenue = item.loc;
                subTotal = 0;

                // Cetak Judul Cafe Baru
                tableBody.push([
                    { 
                        content: `CAFE: ${currentVenue.toUpperCase()}`, 
                        colSpan: 4, 
                        styles: { fontStyle: 'bold', fillColor: [50, 50, 50], textColor: 255 } 
                    }
                ]);
            }

            // Cetak Baris Data
            let waktu = item.dateObj.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) + ' (' + item.dateObj.toLocaleDateString('id-ID') + ')';
            
            tableBody.push([
                waktu,
                item.performer, // Artis
                item.song,      // Lagu
                `Rp ${item.amount.toLocaleString('id-ID')}`
            ]);

            subTotal += item.amount;
            grandTotal += item.amount;

            // Jika data TERAKHIR, cetak Subtotal terakhir
            if (index === dataSorted.length - 1) {
                 tableBody.push([
                    { 
                        content: `SUBTOTAL ${currentVenue.toUpperCase()}`, 
                        colSpan: 3, 
                        styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } 
                    },
                    { 
                        content: `Rp ${subTotal.toLocaleString('id-ID')}`, 
                        styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0,0,0] } 
                    }
                ]);
            }
        });

        // Baris Grand Total
        tableBody.push([
            { 
                content: "GRAND TOTAL OMZET", 
                colSpan: 3, 
                styles: { halign: 'right', fontStyle: 'bold', fontSize: 12, textColor: [0,0,0] } 
            },
            { 
                content: `Rp ${grandTotal.toLocaleString('id-ID')}`, 
                styles: { fontStyle: 'bold', fontSize: 12, textColor: [0, 200, 0] } // Hijau
            }
        ]);

        // --- C. RENDER TABEL DENGAN HEADER OTOMATIS (didDrawPage) ---
        
        doc.autoTable({
            startY: 50, // Turunkan tabel supaya tidak nabrak Header
            head: [['Waktu', 'Artis', 'Lagu', 'Sawer']], 
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [0, 150, 200] },
            
            // FUNGSI INI AKAN JALAN DI SETIAP HALAMAN
            didDrawPage: function (data) {
                // 1. Gambar Logo
                if (logoBase64) {
                    doc.addImage(logoBase64, 'PNG', 15, 10, 18, 18);
                }

                // 2. Judul Laporan (2 Baris)
                doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0,0,0);
                doc.text("LAPORAN DETAIL APRESIASI", 40, 18);
                doc.text("TOUR MITRA CAFE SMIPRO", 40, 24);

                // 3. Info Filter
                doc.setFontSize(9); doc.setFont("helvetica", "normal");
                doc.text(`Filter Lokasi: ${info.lokasi === 'all' ? 'Semua Cafe' : info.lokasi}`, 40, 31);
                doc.text(`Periode: ${info.periode} | Cetak: ${printTime}`, 40, 36);

                // 4. Garis Pembatas
                doc.setLineWidth(0.5); doc.setDrawColor(0,0,0);
                doc.line(15, 42, 195, 42);

                // 5. Footer (Watermark)
                doc.setFontSize(8); 
                doc.setTextColor(150, 150, 150); // Abu-abu samar
                doc.text("@ Yayasan Sekola Konang Indonesia - SMIPRO StreetArt.id", 105, pageHeight - 10, null, null, "center");
            }
        });

        doc.save(`Laporan_Tour_Detail_${new Date().getTime()}.pdf`);

    } catch (error) {
        console.error("PDF Error:", error);
        alert("Gagal mencetak PDF: " + error.message);
    } finally {
        document.body.style.cursor = 'default';
    }
}

/* =========================================
   11. EKSEKUSI (PENUTUP FILE YANG BENAR)
   ========================================= */
window.onload = function() {
    console.log("System Started...");
    loadDashboardOverview();
    
    // Background Load
    if(typeof loadMitraData === 'function') loadMitraData();
    if(typeof loadPerformerData === 'function') loadPerformerData();
    if(typeof loadMentorData === 'function') loadMentorData();
    if(typeof loadStudentData === 'function') loadStudentData(); 
    if(typeof loadCafeData === 'function') loadCafeData();
    
    if(window.loadVenueManagement) window.loadVenueManagement();
    if(typeof populateVenueFilters === 'function') populateVenueFilters();     

    setTimeout(() => {
        const lastTab = localStorage.getItem('adminReturnTab');
        if (lastTab) {
            document.querySelectorAll('.menu-item').forEach(btn => {
                if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(lastTab)) btn.click();
            });
            localStorage.removeItem('adminReturnTab');
        }
    }, 500);
};
