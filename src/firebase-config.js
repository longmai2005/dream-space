import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut,
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword      
} from "firebase/auth";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    getDocs 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBvPtwQ-4gIUwds205DrC9_SpTYo-5WaNw",
  authDomain: "dream-space-bebd2.firebaseapp.com",
  projectId: "dream-space-bebd2",
  storageBucket: "dream-space-bebd2.firebasestorage.app",
  messagingSenderId: "431540885742",
  appId: "1:431540885742:web:4516e1119758b1d264fbff",
  measurementId: "G-TD625TZVYQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// 1. Đăng nhập Google (Giữ nguyên)
export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        await checkAndCreateUser(result.user); // Lưu user vào DB
        return result.user;
    } catch (error) { console.error(error); return null; }
};

// 2. Đăng ký bằng Email/Pass
export const registerWithEmail = async (email, password) => {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        // Mặc định user mới là 'member', riêng email này là 'admin' (Demo)
        const role = email.includes("admin") ? "admin" : "member"; 
        await setDoc(doc(db, "users", result.user.uid), {
            email: email,
            role: role,
            createdAt: new Date()
        });
        return result.user;
    } catch (error) { throw error; }
};

// 3. Đăng nhập bằng Email/Pass
export const loginWithEmail = async (email, password) => {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user;
    } catch (error) { throw error; }
};

// 4. Lấy Role của User (Để biết có phải Admin không)
export const getUserRole = async (uid) => {
    const docSnap = await getDoc(doc(db, "users", uid));
    if (docSnap.exists()) return docSnap.data().role;
    return "member";
};

// 5. (Admin Only) Lấy danh sách tất cả user
export const getAllUsers = async () => {
    const querySnapshot = await getDocs(collection(db, "users"));
    let users = [];
    querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
    });
    return users;
};

// Hàm phụ: Lưu user Google vào DB nếu chưa có
async function checkAndCreateUser(user) {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
        await setDoc(userRef, {
            email: user.email,
            role: "member", // Mặc định là member
            createdAt: new Date()
        });
    }
}

export const logoutUser = () => signOut(auth);
// ... Giữ nguyên các hàm saveDesign, loadDesign cũ ...
export const saveDesignToCloud = async (userId, designData) => {
    await setDoc(doc(db, "users", userId), { savedDesign: designData }, { merge: true });
};
export const loadDesignFromCloud = async (userId) => {
    const docSnap = await getDoc(doc(db, "users", userId));
    return docSnap.exists() ? docSnap.data().savedDesign : null;
};