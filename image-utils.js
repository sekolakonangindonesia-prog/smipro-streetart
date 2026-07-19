// =========================================================
// UTILITAS KOMPRES GAMBAR (dipakai di semua form upload foto)
// =========================================================
// Kenapa perlu ini: kita nyimpen foto langsung sebagai teks base64 di dalam
// dokumen Firestore (bukan lewat Firebase Storage yang butuh kartu kredit).
// Firestore punya batas keras 1MB per dokumen -- foto dari HP jaman sekarang
// biasa 2-8MB, jadi WAJIB dikecilin dulu sebelum disimpan, atau dokumennya
// bakal gagal ke-save (error "exceeds the maximum allowed size").

// compressImage(file, maxDim, quality) -> Promise<string base64 JPEG>
//   file    : File object dari <input type="file">
//   maxDim  : lebar/tinggi maksimal dalam pixel (sisi terpanjang dikecilin ke ini)
//   quality : 0-1, kualitas kompresi JPEG (0.7-0.8 biasanya masih bagus dilihat)
function compressImage(file, maxDim = 800, quality = 0.75) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('File yang dipilih bukan gambar.'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;

                // Kecilin proporsional kalau sisi terpanjang masih lebih besar dari maxDim
                if (width > height && width > maxDim) {
                    height = Math.round(height * (maxDim / width));
                    width = maxDim;
                } else if (height > maxDim) {
                    width = Math.round(width * (maxDim / height));
                    height = maxDim;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Selalu keluarin sebagai JPEG (lebih kecil dari PNG utk foto biasa)
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error('Gagal memuat gambar.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Gagal membaca file.'));
        reader.readAsDataURL(file);
    });
}

// Sama seperti compressImage(), tapi sumbernya dari URL/base64 yang SUDAH ada
// (dipakai waktu fitur "Pilih dari Galeri Utama" -- item yang dipilih mungkin
// cover-nya base64 gede peninggalan lama, jadi perlu dikompres ULANG sebelum
// disalin ke dokumen lain, biar gak ikut numpuk).
function compressImageFromUrl(url, maxDim = 500, quality = 0.75) {
    return new Promise((resolve) => {
        if (!url) { resolve(url); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            let { width, height } = img;
            if (width > height && width > maxDim) {
                height = Math.round(height * (maxDim / width));
                width = maxDim;
            } else if (height > maxDim) {
                width = Math.round(width * (maxDim / height));
                height = maxDim;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            try {
                resolve(canvas.toDataURL('image/jpeg', quality));
            } catch (e) {
                // Kalau gagal (misal CORS block dari sumber luar), pakai URL asli aja apa adanya
                resolve(url);
            }
        };
        img.onerror = () => resolve(url); // Gagal load -- pakai URL asli aja, jangan sampai macet
        img.src = url;
    });
}
