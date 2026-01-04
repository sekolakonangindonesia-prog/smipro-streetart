// Import fungsi Firebase dari Server Google (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Konfigurasi Kunci Anda
const firebaseConfig = {
  apiKey: "AIzaSyBZcysu-eljECIpQCG7tBKowuN-H8hIRFk",
  authDomain: "smipro-app.firebaseapp.com",
  projectId: "smipro-app",
  storageBucket: "smipro-app.firebasestorage.app",
  messagingSenderId: "1052427998270",
  appId: "1:1052427998270:web:5f70ea06e4b10b50fe2d6f"
};

// Mulai Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export agar bisa dipakai di file lain
export { db };
