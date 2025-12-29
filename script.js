// DATA 5 ANGKRINGAN
const venues = [
    { name: "Angkringan Utama Stadion", loc: "Pintu Masuk Utama", img: "https://images.unsplash.com/photo-1555529733-0e670560f7e1?q=80&w=500", live: "https://youtube.com", perf: { name: "Rina Violinist", img: "https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=150", genre: "Instrumental" } },
    { name: "Angkringan Pak Eko", loc: "Sektor Utara", img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=500", live: "https://tiktok.com", perf: { name: "The Acoustic Boys", img: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=150", genre: "Pop Jawa" } },
    { name: "Warung Pojok Legend", loc: "Parkir Timur", img: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=500", live: "https://instagram.com", perf: { name: "Keroncong Milenial", img: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150", genre: "Traditional" } },
    { name: "Kopi Jalanan 'Mbah Suro'", loc: "Pojok Selatan", img: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=500", live: "https://youtube.com", perf: { name: "Campursari Gembira", img: "https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?q=80&w=150", genre: "Campursari" } },
    { name: "Cafe Tenda Gaul", loc: "Tribun Barat", img: "https://images.unsplash.com/photo-1485182708500-e8f1f318ba72?q=80&w=500", live: "https://tiktok.com", perf: { name: "Rock Ballad Pro", img: "https://images.unsplash.com/photo-1526218626217-dc65b9d6e630?q=80&w=150", genre: "Slow Rock" } }
];

// DATA TOP 5
const topPerf = [
    { name: "Rina Violin", genre: "Instrumental", img: "https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=150" },
    { name: "The Acoustic", genre: "Pop Jawa", img: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=150" },
    { name: "Rock Ballad", genre: "Rock", img: "https://images.unsplash.com/photo-1526218626217-dc65b9d6e630?q=80&w=150" },
    { name: "Siti Keroncong", genre: "Modern", img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150" },
    { name: "Solo Hudi", genre: "Guitar", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150" }
];

// RENDER VENUES
const list = document.getElementById('venues-list');
venues.forEach((v, i) => {
    let icon = '<i class="fa-brands fa-youtube"></i>';
    if(v.live.includes('tiktok')) icon = '<i class="fa-brands fa-tiktok"></i>';
    if(v.live.includes('instagram')) icon = '<i class="fa-brands fa-instagram"></i>';

    list.innerHTML += `
    <div class="venue-card" onclick="openVenueModal(${i})">
        <div class="venue-header" style="background-image: url('${v.img}')">
            <div class="venue-status"><div class="dot-live"></div> LIVE</div>
        </div>
        <div class="venue-body">
            <h3 class="venue-name">${v.name}</h3>
            <span class="venue-loc"><i class="fa-solid fa-map-pin"></i> ${v.loc}</span>
            <div class="performer-row">
                <div class="p-info"><img src="${v.perf.img}"><div class="p-text"><h5>${v.perf.name}</h5><span>${v.perf.genre}</span></div></div>
                <a href="${v.live}" target="_blank" class="btn-live-link" onclick="event.stopPropagation()">${icon} Tonton Live</a>
            </div>
        </div>
    </div>`;
});

// RENDER TOP 5
const tList = document.getElementById('top-performers-list');
topPerf.forEach(p => {
    tList.innerHTML += `<div class="artist-card-ss1"><img src="${p.img}" class="artist-img-ss1"><h4>${p.name}</h4><p style="margin:5px 0 0; color:#888; font-size:0.7rem;">${p.genre}</p></div>`;
});

// MODAL FUNCTIONS
function openVenueModal(i) {
    const v = venues[i];
    document.getElementById('v-img-detail').src = v.img;
    document.getElementById('v-name-detail').innerText = v.name;
    document.getElementById('v-loc-detail').innerText = v.loc;
    document.getElementById('p-img-detail').src = v.perf.img;
    document.getElementById('p-name-detail').innerText = v.perf.name;
    document.getElementById('p-genre-detail').innerText = v.perf.genre;
    document.getElementById('venue-modal').style.display = 'block';
}

function openTrainingModal() { document.getElementById('training-modal').style.display = 'block'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// RATING & FEEDBACK
function rateVenue(n) {
    document.querySelectorAll('#venue-stars i').forEach((s, i) => {
        if(i < n) s.classList.add('gold'); else s.classList.remove('gold');
    });
}
function submitVenueFeedback() { alert("Feedback terkirim!"); document.getElementById('venue-feedback').value=""; }
