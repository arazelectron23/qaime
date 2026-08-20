// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Sənin mövcud Firebase məlumatların bura gəlməlidir
const firebaseConfig = {
    apiKey: "AIzaSyA6TGcnhFOErD5gd4XRNBjRjLucKVuphZY",
  authDomain: "qaime-77f63.firebaseapp.com",
  projectId: "qaime-77f63",
  storageBucket: "qaime-77f63.firebasestorage.app",
  messagingSenderId: "879558627020",
  appId: "1:879558627020:web:980a57009e3377eea67c69"
};

// İnitializasiya
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Digər fayllarda istifadə edə bilmək üçün hamısını export edirik
export { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    serverTimestamp 
};