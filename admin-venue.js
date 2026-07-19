/* =========================================
   MODUL KHUSUS: MANAJEMEN VENUE LOKASI
   (VERSI BARU: + toggle "Aktif di Beranda")
   ========================================= */
import { db } from './firebase-config.js';
import { 
    collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentVenueBase64 = null;

// Helper: escape nama/deskripsi sebelum disisipkan ke atribut onclick="..."
// (mencegah tombol Edit patah/error kalau nama venue mengandung tanda kutip)
function safeAttr(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// 1. PREVIEW GAMBAR
window.previewVenueImg = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentVenueBase64 = e.target.result;
            document.getElementById('venue-preview').src = currentVenueBase64;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// 2. SIMPAN / UPDATE VENUE
window.saveVenue = async function() {
    const id = document.getElementById('venue-edit-id').value;
    const name = document.getElementById('venue-name').value;
    const order = parseInt(document.getElementById('venue-order').value) || 99;
    const desc = document.getElementById('venue-desc').value;
    const img = currentVenueBase64;

    if(!name) return alert("Nama Venue Wajib Diisi!");

    const dataPayload = { 
        name: name, 
        order: order, 
        desc: desc 
    };

    if(img) dataPayload.icon = "fa-map-marker-alt";
    if(img) dataPayload.img = img; 

    if(id) {
        // --- MODE EDIT ---
        if(confirm("Simpan perubahan venue?")) {
            // FIX: Ambil nama lama dulu — kalau nama venue berubah, semua warung
            // yang terdaftar di venue ini perlu ikut diperbarui venueName-nya,
            // supaya tidak "hilang" (tidak terbaca) setelah venue di-rename.
            const oldSnap = await getDoc(doc(db, "venues", id));
            const oldName = oldSnap.exists() ? oldSnap.data().name : null;

            await updateDoc(doc(db, "venues", id), dataPayload);

            let jumlahWarungIkutUpdate = 0;
            if (oldName && oldName !== name) {
                const updates = [];
                const sudahDiupdate = new Set();

                // Warung yang sudah punya venueId (link resmi ke venue ini)
                const wSnapById = await getDocs(query(collection(db, "warungs"), where("venueId", "==", id)));
                wSnapById.forEach(d => {
                    sudahDiupdate.add(d.id);
                    updates.push(updateDoc(doc(db, "warungs", d.id), { venueName: name }));
                });

                // Jaring pengaman: warung lama yang belum punya venueId,
                // dicocokkan lewat venueName lama, sekalian dilengkapi venueId-nya.
                const wSnapByName = await getDocs(query(collection(db, "warungs"), where("venueName", "==", oldName)));
                wSnapByName.forEach(d => {
                    if (sudahDiupdate.has(d.id)) return;
                    sudahDiupdate.add(d.id);
                    updates.push(updateDoc(doc(db, "warungs", d.id), { venueName: name, venueId: id }));
                });

                await Promise.all(updates);
                jumlahWarungIkutUpdate = sudahDiupdate.size;
            }

            alert("Venue Diupdate!" + (jumlahWarungIkutUpdate > 0 ? `\n${jumlahWarungIkutUpdate} warung di venue ini ikut otomatis diperbarui.` : ""));
            resetVenueForm();
        }
    } else {
        // --- MODE BARU ---
        if(confirm("Tambah Venue Baru?")) {
            dataPayload.status = "closed"; // Default tutup
            dataPayload.isActive = true;   // Default aktif tampil di beranda
            if(!img) dataPayload.icon = "fa-store";

            await addDoc(collection(db, "venues"), dataPayload);
            alert("Venue Baru Ditambahkan!");
            resetVenueForm();
        }
    }
}

// 3. LOAD DATA (REALTIME TABEL)
window.loadVenueManagement = function() {
    const tbody = document.getElementById('venue-table-body');
    if(!tbody) return;

    const q = query(collection(db, "venues"), orderBy("order", "asc"));
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" align="center">Belum ada venue.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const isOpen = d.status === 'open';
            const statusBadge = isOpen ? '<span style="color:#00ff00;">BUKA</span>' : '<span style="color:#666;">TUTUP</span>';
            const btnColor = isOpen ? '#2ecc71' : '#444';

            // --- BARU: status Aktif di Beranda (default true jika field belum ada) ---
            const isActive = d.isActive !== false;
            const activeBadge = isActive
                ? '<span style="color:#00d2ff;"><i class="fa-solid fa-eye"></i> Tampil</span>'
                : '<span style="color:#888;"><i class="fa-solid fa-eye-slash"></i> Sembunyi</span>';
            const activeBtnColor = isActive ? '#00d2ff' : '#444';
            const activeBtnText = isActive ? 'AKTIF' : 'OFF';
            
            // Gambar atau Icon
            let imgDisplay = `<i class="fa-solid ${d.icon||'fa-store'}" style="font-size:1.5rem; color:#aaa;"></i>`;
            if(d.img && d.img.length > 100) {
                imgDisplay = `<img src="${d.img}" style="width:40px; height:40px; border-radius:5px; object-fit:cover;">`;
            }

            tbody.innerHTML += `
            <tr>
                <td style="text-align:center;">${imgDisplay}</td>
                <td style="text-align:center;">${d.order}</td>
                <td>
                    <b>${d.name}</b><br>
                    <small style="color:#888;">${d.desc || '-'}</small>
                </td>
                <td>
                    <button onclick="toggleStatusVenue('${docSnap.id}', '${d.status}')" style="background:${btnColor}; border:none; color:white; padding:2px 8px; border-radius:4px; cursor:pointer;">
                        ${statusBadge}
                    </button>
                </td>
                <td>
                    <button onclick="toggleActiveVenue('${docSnap.id}', ${isActive})" style="background:${activeBtnColor}; border:none; color:black; padding:2px 8px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:0.7rem;">
                        ${activeBtnText}
                    </button>
                    <div style="font-size:0.7rem; margin-top:3px;">${activeBadge}</div>
                </td>
                <td>
                    <button class="btn-action btn-edit" onclick="editVenue('${docSnap.id}', '${safeAttr(d.name)}', '${d.order}', '${safeAttr(d.desc)}', '${d.img||''}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteVenue('${docSnap.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        });
    });
}

// 4. ACTION FUNCTIONS
window.toggleStatusVenue = async function(id, current) {
    const newStat = current === 'open' ? 'closed' : 'open';
    await updateDoc(doc(db, "venues", id), { status: newStat });
}

// --- BARU: Toggle tampil/sembunyi di beranda ---
window.toggleActiveVenue = async function(id, currentActive) {
    const newVal = !currentActive;
    const label = newVal ? "MENAMPILKAN" : "MENYEMBUNYIKAN";
    if(confirm(`${label} venue ini di beranda publik?`)) {
        await updateDoc(doc(db, "venues", id), { isActive: newVal });
    }
}

window.deleteVenue = async function(id) {
    if(confirm("Hapus Venue ini Permanen? Warung di dalamnya mungkin akan error.")) {
        await deleteDoc(doc(db, "venues", id));
    }
}

// 5. FORM CONTROL (EDIT & RESET)
window.editVenue = function(id, name, order, desc, img) {
    document.getElementById('venue-edit-id').value = id;
    document.getElementById('venue-name').value = name;
    document.getElementById('venue-order').value = order;
    document.getElementById('venue-desc').value = desc;
    
    if(img && img.length > 100) document.getElementById('venue-preview').src = img;
    else document.getElementById('venue-preview').src = "https://placehold.co/100?text=Foto";
    
    currentVenueBase64 = null;
    
    document.getElementById('btn-save-venue').innerText = "Simpan Perubahan";
    document.getElementById('btn-save-venue').style.background = "#FFD700";
    document.getElementById('btn-save-venue').style.color = "black";
    document.getElementById('btn-cancel-venue').style.display = "inline-block";
}

window.resetVenueForm = function() {
    document.getElementById('venue-edit-id').value = "";
    document.getElementById('venue-name').value = "";
    document.getElementById('venue-order').value = "";
    document.getElementById('venue-desc').value = "";
    document.getElementById('venue-preview').src = "https://placehold.co/100?text=Foto";
    currentVenueBase64 = null;

    document.getElementById('btn-save-venue').innerText = "+ Simpan Venue";
    document.getElementById('btn-save-venue').style.background = "";
    document.getElementById('btn-save-venue').style.color = "white";
    document.getElementById('btn-cancel-venue').style.display = "none";
}
