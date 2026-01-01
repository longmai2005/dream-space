import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loginWithGoogle, logoutUser, saveDesignToCloud, loadDesignFromCloud } from './firebase-config.js';

let currentUser = null; // Biến lưu thông tin người dùng

import { 
    loginWithGoogle, 
    loginWithEmail, 
    registerWithEmail, 
    logoutUser, 
    saveDesignToCloud, 
    loadDesignFromCloud,
    getUserRole,    // <-- Hàm mới
    getAllUsers     // <-- Hàm mới
} from './firebase-config.js';
let currentUser = null;
let isRegisterMode = false; // Trạng thái đang ở màn Login hay Register

// --- 1. XỬ LÝ LOGIC ĐĂNG NHẬP / ĐĂNG KÝ ---

// Chuyển đổi qua lại giữa Login và Register
document.getElementById('toggle-mode').addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('form-title');
    const btn = document.getElementById('btn-submit');
    const toggle = document.getElementById('toggle-mode');
    
    if (isRegisterMode) {
        title.innerText = "Create Account";
        btn.innerText = "Register";
        toggle.innerText = "Already have an account? Sign In";
    } else {
        title.innerText = "Welcome Back";
        btn.innerText = "Sign In";
        toggle.innerText = "Don't have an account? Register";
    }
});

// Xử lý nút Submit (Email/Pass)
document.getElementById('btn-submit').addEventListener('click', async () => {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('pass-input').value;
    
    if(!email || !pass) { alert("Please enter email and password"); return; }

    try {
        let user;
        if (isRegisterMode) {
            user = await registerWithEmail(email, pass);
            alert("Đăng ký thành công! Hãy trải nghiệm.");
        } else {
            user = await loginWithEmail(email, pass);
        }
        handleLoginSuccess(user);
    } catch (error) {
        alert("Lỗi: " + error.message);
    }
});

// Xử lý nút Google
document.getElementById('btn-google').addEventListener('click', async () => {
    const user = await loginWithGoogle();
    if (user) handleLoginSuccess(user);
});

// HÀM XỬ LÝ KHI ĐĂNG NHẬP THÀNH CÔNG (User hoặc Admin)
async function handleLoginSuccess(user) {
    currentUser = user;
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('main-ui').classList.remove('hidden');
    document.getElementById('user-display').innerText = user.email.split('@')[0];

    // Kiểm tra quyền Admin
    const role = await getUserRole(user.uid);
    if (role === 'admin') {
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdminData(); // Tải danh sách user
    }
}

// Logic Admin: Tải danh sách User
async function loadAdminData() {
    const listContainer = document.getElementById('admin-user-list');
    listContainer.innerHTML = '<p>Loading...</p>';
    
    const users = await getAllUsers();
    listContainer.innerHTML = ''; // Xóa loading

    users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'user-item';
        // Nếu là admin thì tô đỏ
        const badgeClass = u.role === 'admin' ? 'role-badge role-admin' : 'role-badge';
        
        div.innerHTML = `
            <div>
                <div style="font-weight:bold">${u.email}</div>
                <div style="color:#aaa; font-size:0.8em">ID: ${u.id.substr(0, 5)}...</div>
            </div>
            <span class="${badgeClass}">${u.role}</span>
        `;
        listContainer.appendChild(div);
    });
}

document.getElementById('refresh-admin').addEventListener('click', loadAdminData);
document.getElementById('btn-logout').addEventListener('click', () => { logoutUser(); location.reload(); });

// --- PHẦN 1: XỬ LÝ ĐĂNG NHẬP / UI ---
document.getElementById('btn-login').addEventListener('click', async () => {
    const user = await loginWithGoogle();
    if (user) {
        currentUser = user;
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('main-ui').classList.remove('hidden');
        document.getElementById('user-display').innerText = user.displayName;
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    logoutUser();
    location.reload();
});

// Nút LƯU thiết kế
document.getElementById('btn-save').addEventListener('click', () => {
    if (!currentUser) return;
    
    // Tạo danh sách dữ liệu để lưu
    const designData = objects.map(obj => ({
        type: obj.userData.type, // Lưu loại (ghế, bàn...)
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
    }));
    
    saveDesignToCloud(currentUser.uid, designData);
});

// Nút TẢI thiết kế
document.getElementById('btn-load').addEventListener('click', async () => {
    if (!currentUser) return;
    const data = await loadDesignFromCloud(currentUser.uid);
    if (data) {
        // Xóa hết đồ cũ
        objects.forEach(obj => scene.remove(obj));
        objects.length = 0;
        transformControl.detach();
        
        // Tạo lại đồ từ dữ liệu đã lưu
        data.forEach(item => {
            createFurniture(item.type, item.position, item.rotation, item.scale);
        });
        alert("Đã tải thiết kế của bạn!");
    } else {
        alert("Chưa tìm thấy thiết kế nào đã lưu.");
    }
});


// --- PHẦN 2: 3D SCENE (Giữ nguyên logic chuẩn) ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdcdcdc);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Sàn & Lưới
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);
const plane = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

// Ánh sáng
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// Controls
const orbit = new OrbitControls(camera, renderer.domElement);
const transformControl = new TransformControls(camera, renderer.domElement);
transformControl.addEventListener('dragging-changed', (e) => orbit.enabled = !e.value);
scene.add(transformControl);

const objects = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Hàm tạo đồ nội thất (Dùng chung cho lúc click và lúc load data)
function createFurniture(type, pos = {x:0,y:0.5,z:0}, rot = {x:0,y:0,z:0}, scl = {x:1,y:1,z:1}) {
    let geometry;
    if (type === 'box') geometry = new THREE.BoxGeometry(1, 1, 1);
    else if (type === 'cylinder') geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    else geometry = new THREE.SphereGeometry(0.5, 32, 32);

    const material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.rotation.set(rot.x, rot.y, rot.z);
    mesh.scale.set(scl.x, scl.y, scl.z);
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.type = type; // Lưu loại để sau này Save/Load biết nó là cái gì

    scene.add(mesh);
    objects.push(mesh);
    transformControl.attach(mesh);
    return mesh;
}

// Expose hàm ra window để nút HTML gọi được
window.addFurniture = (type) => createFurniture(type);

// Click chọn vật thể
renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects);
    if (intersects.length > 0) transformControl.attach(intersects[0].object);
    else transformControl.detach();
});

// Phím tắt
window.addEventListener('keydown', (e) => {
    if(e.key === 'Delete' && transformControl.object) {
        const obj = transformControl.object;
        scene.remove(obj);
        objects.splice(objects.indexOf(obj), 1);
        transformControl.detach();
    }
});

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    orbit.update();
    renderer.render(scene, camera);
}
animate();