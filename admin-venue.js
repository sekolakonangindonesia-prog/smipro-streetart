/* =========================================
   MODUL KHUSUS: MANAJEMEN VENUE LOKASI
   ========================================= */
import { db } from './firebase-config.js';
import { 
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentVenueBase64 = null;

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

    // Jika ada gambar baru, masukkan ke payload. Jika tidak, pakai yg lama.
    if(img) dataPayload.icon = "fa-map-marker-alt"; // Default icon kalau pakai gambar
    // (Catatan: Kita simpan gambar base64 di field 'img', atau tetap pakai 'icon' fontawesome jika mau simpel)
    // Di sini saya asumsikan bapak mau pakai FOTO ASLI:
    if(img) dataPayload.img = img; 

    if(id) {
        // --- MODE EDIT ---
        if(confirm("Simpan perubahan venue?")) {
            await updateDoc(doc(db, "venues", id), dataPayload);
            alert("Venue Diupdate!");
            resetVenueForm();
        }
    } else {
        // --- MODE BARU ---
        if(confirm("Tambah Venue Baru?")) {
            dataPayload.status = "closed"; // Default tutup
            if(!img) dataPayload.icon = "fa-store"; // Default icon

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
            tbody.innerHTML = '<tr><td colspan="5" align="center">Belum ada venue.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const isOpen = d.status === 'open';
            const statusBadge = isOpen ? '<span style="color:#00ff00;">BUKA</span>' : '<span style="color:#666;">TUTUP</span>';
            const btnColor = isOpen ? '#2ecc71' : '#444';
            
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
                    <button class="btn-action btn-edit" onclick="editVenue('${docSnap.id}', '${d.name}', '${d.order}', '${d.desc}', '${d.img||''}')">
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
    else document.getElementById('venue-preview').src = "https://via.placeholder.com/100?text=Foto";
    
    currentVenueBase64 = null; // Reset buffer
    
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
    document.getElementById('venue-preview').src = "https://via.placeholder.com/100?text=Foto";
    currentVenueBase64 = null;

    document.getElementById('btn-save-venue').innerText = "+ Simpan Venue";
    document.getElementById('btn-save-venue').style.background = "";
    document.getElementById('btn-save-venue').style.color = "white";
    document.getElementById('btn-cancel-venue').style.display = "none";
}
