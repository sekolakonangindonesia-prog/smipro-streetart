/* DATA SIMULASI */
let students = [
    { id: 1, name: "Band Pemula 01", genre: "Rock", score: 70, img: "https://via.placeholder.com/60" },
    { id: 2, name: "Solo Gitar Adi", genre: "Fingerstyle", score: 0, img: "https://via.placeholder.com/60" },
    { id: 3, name: "Duo Srikandi", genre: "Pop", score: 85, img: "https://via.placeholder.com/60" }
];

let performers = [
    { id: 101, name: "The Acoustic Boys", genre: "Pop Jawa", img: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=100" },
    { id: 102, name: "Rina Violin", genre: "Instrumental", img: "https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=100" }
];

/* LOGIKA RENDER */
function renderStudents() {
    const list = document.getElementById('student-list');
    list.innerHTML = '';
    students.forEach(s => {
        let scoreClass = s.score >= 90 ? 'pass' : '';
        list.innerHTML += `
        <div class="student-card">
            <img src="${s.img}" class="student-img">
            <div style="flex:1;">
                <h4 style="margin:0;">${s.name}</h4>
                <small style="color:#aaa;">${s.genre}</small>
            </div>
            <div style="text-align:right;">
                <div class="score-circle ${scoreClass}">${s.score}</div>
                <button class="btn-action-mentor" style="margin-top:5px;" onclick="openGrade(${s.id})">Edit Nilai</button>
            </div>
        </div>`;
    });
}

function renderPerformers() {
    const list = document.getElementById('performer-list');
    list.innerHTML = '';
    performers.forEach(p => {
        list.innerHTML += `
        <div class="perf-manage-card">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <img src="${p.img}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                <h4 style="margin:0;">${p.name}</h4>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-action-mentor" onclick="openUpload('${p.name}')"><i class="fa-solid fa-upload"></i> Upload</button>
                <button class="btn-action-mentor" onclick="viewProfile()"><i class="fa-solid fa-eye"></i> Intip Profil</button>
            </div>
        </div>`;
    });
}

/* LOGIKA MODAL */
let currentStudentId = null;

function openGrade(id) {
    currentStudentId = id;
    const s = students.find(x => x.id === id);
    document.getElementById('grade-target-name').innerText = s.name;
    document.getElementById('input-score').value = s.score;
    // Gunakan Flex agar tengah
    document.getElementById('modal-grade').style.display = 'flex'; 
}

function openUpload(name) {
    document.getElementById('upload-target-name').innerText = name;
    document.getElementById('modal-upload').style.display = 'flex';
}

function submitScore() {
    const score = parseInt(document.getElementById('input-score').value);
    if(isNaN(score) || score < 0 || score > 100) return alert("Nilai harus 0-100!");
    const s = students.find(x => x.id === currentStudentId);
    s.score = score;
    if (score >= 90) alert(`Nilai ${score} tersimpan! Notifikasi dikirim ke Admin.`);
    else alert(`Nilai ${score} tersimpan.`);
    closeModal('modal-grade');
    renderStudents();
}

function submitUpload() {
    alert("File berhasil diunggah ke Galeri Performer!");
    closeModal('modal-upload');
}

// LINK KE DASHBOARD PERFORMER ASLI (SESUAI REQUEST)
function viewProfile() {
    window.location.href = 'performer-dashboard.html'; 
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(e => e.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    document.getElementById('tab-' + tabId).style.display = 'block';
    event.currentTarget.classList.add('active');
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// FUNGSI LOGOUT YANG BENAR
function prosesLogout() {
    if(confirm("Keluar dari Dashboard Mentor?")) {
        localStorage.removeItem('userLoggedIn');
        localStorage.removeItem('userName');
        localStorage.removeItem('userLink');
        window.location.href = 'index.html';
    }
}

// Init
renderStudents();
renderPerformers();
