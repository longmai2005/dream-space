import './style.css'; 
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { 
    loginWithGoogle, 
    loginWithEmail, 
    registerWithEmail, 
    logoutUser, 
    saveDesignToCloud, 
    loadDesignFromCloud 
} from './firebase-config.js';
import { getAuth, onAuthStateChanged } from "firebase/auth";

// --- GLOBAL VARIABLES ---
let currentUser = null;
let isRegisterMode = false;
const objects = []; 
const history = []; 
const redoStack = []; 
let dragStartTransform = null;
let roomMeshes = []; // Mảng chứa tường/sàn để xóa khi đổi phòng

// --- DATA: CẤU HÌNH PHÒNG & NỘI THẤT ---
const ROOM_DATABASE = {
    livingroom: {
        name: "Phòng Khách",
        width: 8, depth: 6, // Kích thước phòng (mét)
        floorColor: 0x8d6e63, // Màu gỗ
        wallColor: 0xeeeeee,  // Màu tường trắng
        items: [
            { id: 'sofa', name: "Sofa", icon: "couch", type: 'box', scale: {x:2, y:0.8, z:1}, color: 0x3e2723 },
            { id: 'table', name: "Bàn Trà", icon: "table", type: 'cylinder', scale: {x:1.2, y:0.5, z:1.2}, color: 0xffcc80 },
            { id: 'tv_cabinet', name: "Kệ TV", icon: "tv", type: 'box', scale: {x:2.5, y:0.6, z:0.5}, color: 0x424242 },
            { id: 'plant', name: "Cây Cảnh", icon: "seedling", type: 'cylinder', scale: {x:0.5, y:1.5, z:0.5}, color: 0x4caf50 }
        ]
    },
    bedroom: {
        name: "Phòng Ngủ",
        width: 5, depth: 5,
        floorColor: 0xe0e0e0, // Sàn thảm
        wallColor: 0xffccbc,  // Tường hồng nhạt
        items: [
            { id: 'bed', name: "Giường Ngủ", icon: "bed", type: 'box', scale: {x:2, y:0.6, z:2.2}, color: 0x1a237e },
            { id: 'wardrobe', name: "Tủ Áo", icon: "door-closed", type: 'box', scale: {x:1.5, y:2.5, z:0.6}, color: 0x5d4037 },
            { id: 'lamp', name: "Đèn Ngủ", icon: "lightbulb", type: 'sphere', scale: {x:0.4, y:0.4, z:0.4}, color: 0xffeb3b }
        ]
    },
    kitchen: {
        name: "Nhà Bếp",
        width: 6, depth: 4,
        floorColor: 0x616161, // Sàn gạch
        wallColor: 0xb2dfdb,  // Tường xanh
        items: [
            { id: 'fridge', name: "Tủ Lạnh", icon: "snowflake", type: 'box', scale: {x:1, y:2, z:1}, color: 0xe0e0e0 },
            { id: 'dining_table', name: "Bàn Ăn", icon: "utensils", type: 'cylinder', scale: {x:1.5, y:0.8, z:1.5}, color: 0x795548 },
            { id: 'cabinet', name: "Tủ Bếp", icon: "box-archive", type: 'box', scale: {x:1, y:1, z:0.6}, color: 0xffffff }
        ]
    },
    officeroom: {
        name: "Phòng làm Việc",
        width: 10, depth: 10,
        floorColor: 0x222222,
        wallColor: 0xffacbc,
        items: [
            { id: 'box', name: "Khối Vuông", icon: "cube", type: 'box', scale: {x:1, y:1, z:1}, color: 0xaaaaaa },
            { id: 'sphere', name: "Khối Tròn", icon: "circle", type: 'sphere', scale: {x:1, y:1, z:1}, color: 0xaaaaaa }
        ]
    }
    bathroom: {
        name: "Phòng Tắmc",
        width: 12, depth: 10,
        floorColor: 0x222222,
        wallColor: 0xffacbc,
        items: [
            { id: 'box', name: "Khối Vuông", icon: "cube", type: 'box', scale: {x:1, y:1, z:1}, color: 0xaaaaaa },
            { id: 'sphere', name: "Khối Tròn", icon: "circle", type: 'sphere', scale: {x:1, y:1, z:1}, color: 0xaaaaaa }
        ]
    }
};

// --- 1. SETUP SCENE ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 12); // Góc nhìn cao hơn để thấy phòng

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Ánh sáng
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.7));

// Controls
const orbit = new OrbitControls(camera, renderer.domElement);
const transformControl = new TransformControls(camera, renderer.domElement);
transformControl.addEventListener('dragging-changed', (e) => orbit.enabled = !e.value);
scene.add(transformControl);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- 2. ROOM LOGIC (TÍNH NĂNG MỚI) ---

// Hàm dựng tường và sàn
function buildRoomShell(config) {
    // 1. Xóa phòng cũ (nếu có)
    roomMeshes.forEach(mesh => scene.remove(mesh));
    roomMeshes = [];

    // 2. Tạo Sàn Nhà (Floor)
    const floorGeo = new THREE.PlaneGeometry(config.width, config.depth);
    const floorMat = new THREE.MeshStandardMaterial({ color: config.floorColor });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    roomMeshes.push(floor);

    // 3. Tạo Tường (Walls) - Tạo 3 bức tường (Sau, Trái, Phải)
    if (config.wallColor) {
        const wallHeight = 3.5; // Chiều cao tường chuẩn
        const wallMat = new THREE.MeshStandardMaterial({ color: config.wallColor, side: THREE.DoubleSide });

        // Tường sau (Back Wall)
        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(config.width, wallHeight), wallMat);
        backWall.position.set(0, wallHeight/2, -config.depth/2);
        backWall.receiveShadow = true;
        scene.add(backWall);
        roomMeshes.push(backWall);

        // Tường trái (Left Wall)
        const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(config.depth, wallHeight), wallMat);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.position.set(-config.width/2, wallHeight/2, 0);
        leftWall.receiveShadow = true;
        scene.add(leftWall);
        roomMeshes.push(leftWall);

        // Tường phải (Right Wall)
        const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(config.depth, wallHeight), wallMat);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.position.set(config.width/2, wallHeight/2, 0);
        rightWall.receiveShadow = true;
        scene.add(rightWall);
        roomMeshes.push(rightWall);
    }
}

// Hàm tạo Toolbar động theo phòng
function updateToolbar(items) {
    const toolbar = document.getElementById('dynamic-toolbar');
    toolbar.innerHTML = `<div class="ft-label">Nội Thất</div>`; // Reset toolbar

    items.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'tool-item';
        btn.title = item.name;
        // Dùng icon font awesome
        btn.innerHTML = `<i class="fa-solid fa-${item.icon}"></i>`;
        
        // Sự kiện click: Tạo đồ vật
        btn.onclick = () => createObjectFromConfig(item);
        
        toolbar.appendChild(btn);
    });
}

// Hàm tạo đồ vật từ config
function createObjectFromConfig(item) {
    let geometry;
    if (item.type === 'box') geometry = new THREE.BoxGeometry(1, 1, 1);
    else if (item.type === 'cylinder') geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    else geometry = new THREE.SphereGeometry(0.5, 32, 32);
    
    // Nếu bạn có model GLB, hãy dùng: if (item.modelPath) loadModel(item.modelPath)...

    const material = new THREE.MeshStandardMaterial({ color: item.color });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Áp dụng scale từ config
    mesh.scale.set(item.scale.x, item.scale.y, item.scale.z);
    
    // Đặt vị trí: trên mặt sàn (tính theo chiều cao vật thể)
    const height = item.scale.y; 
    mesh.position.set(0, height / 2, 0); 
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.type = item.name;

    scene.add(mesh);
    objects.push(mesh);
    transformControl.attach(mesh);
    updatePropertiesPanel(mesh);
    
    // Lưu lịch sử
    history.push({ type: 'ADD', object: mesh });
}

// SỰ KIỆN CHỌN PHÒNG
const roomSelector = document.getElementById('room-selector');
if (roomSelector) {
    roomSelector.addEventListener('change', (e) => {
        const roomKey = e.target.value;
        const roomConfig = ROOM_DATABASE[roomKey];
        
        if (roomConfig) {
            // 1. Dựng tường/sàn mới
            buildRoomShell(roomConfig);
            
            // 2. Cập nhật Toolbar
            updateToolbar(roomConfig.items);
            
            // 3. Xóa hết đồ đạc cũ (Reset scene cho sạch)
            objects.forEach(obj => {
                scene.remove(obj);
                if (transformControl.object === obj) transformControl.detach();
            });
            objects.length = 0;
            updatePropertiesPanel(null);
            
            // 4. Reset Camera để nhìn bao quát
            camera.position.set(0, roomConfig.width, roomConfig.depth * 1.5);
            camera.lookAt(0, 0, 0);
        }
    });
}


// --- 3. CORE LOGIC (UNDO/REDO, SELECTION, ...) ---
// (Giữ nguyên các hàm cốt lõi như cũ)

function updatePropertiesPanel(object) {
    const propDetails = document.getElementById('prop-details');
    const propContent = document.getElementById('prop-content');
    
    if (object) {
        if(propContent) propContent.classList.add('hidden');
        if(propDetails) propDetails.classList.remove('hidden');
        
        document.getElementById('prop-type').innerText = object.userData.type || "Model";
        document.getElementById('prop-x').innerText = object.position.x.toFixed(2);
        document.getElementById('prop-z').innerText = object.position.z.toFixed(2);
        if(object.material && object.material.color) {
            document.getElementById('prop-color').style.backgroundColor = '#' + object.material.color.getHexString();
        }
    } else {
        if(propContent) propContent.classList.remove('hidden');
        if(propDetails) propDetails.classList.add('hidden');
    }
}

transformControl.addEventListener('change', () => {
    if(transformControl.object) updatePropertiesPanel(transformControl.object);
});
transformControl.addEventListener('dragging-changed', (event) => orbit.enabled = !event.value);

renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects, true);
    
    if (intersects.length > 0) {
        let selected = intersects[0].object;
        while(selected.parent && selected.parent.type !== 'Scene') selected = selected.parent;
        transformControl.attach(selected);
        updatePropertiesPanel(selected);
    } else {
        transformControl.detach();
        updatePropertiesPanel(null);
    }
});

window.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && transformControl.object) {
        const obj = transformControl.object;
        scene.remove(obj);
        objects.splice(objects.indexOf(obj), 1);
        transformControl.detach();
        updatePropertiesPanel(null);
    }
    if (e.key === 't') transformControl.setMode('translate');
    if (e.key === 'r') transformControl.setMode('rotate');
});

// Nút Undo/Redo (Demo)
const btnUndo = document.getElementById('btn-undo');
if(btnUndo) btnUndo.addEventListener('click', () => {
    if(history.length > 0) {
        const action = history.pop();
        if(action.type === 'ADD') {
            scene.remove(action.object);
            objects.splice(objects.indexOf(action.object), 1);
            transformControl.detach();
        }
        // Logic Undo đầy đủ cần xử lý thêm Transform/Remove...
    }
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    orbit.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- AUTH & NAV LOGIC (Giữ nguyên) ---
const auth = getAuth();
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        showMainApp(user);
    } else {
        showLogin();
    }
});
function showLogin() {
    document.getElementById('homepage').classList.add('hidden');
    document.getElementById('main-ui').classList.add('hidden');
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('login-overlay').style.display = 'flex';
}
function showMainApp(user) {
    document.getElementById('homepage').classList.add('hidden');
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('main-ui').classList.remove('hidden');
    let name = user.email.split('@')[0];
    if(user.displayName) name = user.displayName;
    document.getElementById('user-display').innerText = name;
}
const btnStartNav = document.getElementById('btn-start-nav');
if(btnStartNav) btnStartNav.addEventListener('click', () => { if(auth.currentUser) showMainApp(auth.currentUser); else showLogin(); });
const btnStartHero = document.getElementById('btn-start-hero');
if(btnStartHero) btnStartHero.addEventListener('click', () => { if(auth.currentUser) showMainApp(auth.currentUser); else showLogin(); });

const submitBtn = document.getElementById('btn-submit');
if(submitBtn) {
    submitBtn.addEventListener('click', async () => {
        const email = document.getElementById('email-input').value.trim();
        const pass = document.getElementById('pass-input').value;
        if(!email || !pass) return alert("Nhập đủ thông tin!");
        try {
            const user = await loginWithEmail(email.includes('@')?email:email+"@dream.app", pass==="123"?"123123":pass);
            if(user) showMainApp(user);
        } catch(e) { alert("Lỗi: " + e.message); }
    });
}
const btnGoogle = document.getElementById('btn-google');
if(btnGoogle) btnGoogle.addEventListener('click', async () => { const user = await loginWithGoogle(); if(user) showMainApp(user); });
const btnLogout = document.getElementById('btn-logout');
if(btnLogout) btnLogout.addEventListener('click', () => { logoutUser(); window.location.reload(); });