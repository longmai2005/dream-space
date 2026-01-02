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

let currentUser = null;
let isRegisterMode = false;

// --- 1. QUẢN LÝ CHUYỂN CẢNH (NAVIGATION) ---
const homepage = document.getElementById('homepage');
const loginOverlay = document.getElementById('login-overlay');
const mainUi = document.getElementById('main-ui');

function showLogin() {
    if(homepage) homepage.classList.add('hidden');
    if(loginOverlay) {
        loginOverlay.classList.remove('hidden');
        loginOverlay.style.display = 'flex'; 
    }
}

function showMainApp(user) {
    currentUser = user;
    if(homepage) homepage.classList.add('hidden');
    if(loginOverlay) loginOverlay.classList.add('hidden');
    if(mainUi) mainUi.classList.remove('hidden');
    
    // Cập nhật tên người dùng trên Header
    let displayName = user.email.split('@')[0]; 
    if(user.displayName) displayName = user.displayName;
    const userDisplay = document.getElementById('user-display');
    if(userDisplay) userDisplay.innerText = displayName;
}

// Bắt sự kiện nút trên Homepage
const btnStartNav = document.getElementById('btn-start-nav');
if(btnStartNav) btnStartNav.addEventListener('click', () => checkAuthAndRedirect());
const btnStartHero = document.getElementById('btn-start-hero');
if(btnStartHero) btnStartHero.addEventListener('click', () => checkAuthAndRedirect());

const auth = getAuth();
function checkAuthAndRedirect() {
    if (auth.currentUser) showMainApp(auth.currentUser);
    else showLogin();
}

// Tự động giữ đăng nhập khi F5
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Nếu muốn F5 vào thẳng app thì bỏ comment dòng dưới:
        // showMainApp(user); 
    }
});

// --- 2. XỬ LÝ LOGIN / REGISTER ---
const toggleBtn = document.getElementById('toggle-mode');
const submitBtn = document.getElementById('btn-submit');

if(toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        toggleBtn.innerText = isRegisterMode ? "Đã có tài khoản? Đăng nhập" : "Tạo tài khoản mới";
        // Cập nhật tiêu đề form
        const formTitle = document.querySelector('.login-card h2');
        if(formTitle) formTitle.innerText = isRegisterMode ? "Đăng ký" : "Đăng nhập";
        submitBtn.innerText = isRegisterMode ? "Đăng ký ngay" : "Vào Studio";
    });
}

if(submitBtn) {
    submitBtn.addEventListener('click', async () => {
        const username = document.getElementById('email-input').value.trim();
        let pass = document.getElementById('pass-input').value;
        if(!username || !pass) { alert("Vui lòng nhập đủ thông tin"); return; }

        const fakeEmail = username.includes('@') ? username : username + "@dream.app";
        if(pass === "123") pass = "123123"; 

        try {
            let user;
            if (isRegisterMode) {
                user = await registerWithEmail(fakeEmail, pass);
            } else {
                user = await loginWithEmail(fakeEmail, pass);
            }
            if(user) showMainApp(user);
        } catch (error) {
            alert("Lỗi: " + error.message);
        }
    });
}

const btnGoogle = document.getElementById('btn-google');
if(btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
        const user = await loginWithGoogle();
        if (user) showMainApp(user);
    });
}

// NÚT ĐĂNG XUẤT (Logic mới)
const btnLogout = document.getElementById('btn-logout');
if(btnLogout) {
    btnLogout.addEventListener('click', () => { 
        logoutUser(); 
        window.location.reload(); 
    });
}

// --- 3. 3D SCENE & PANEL THUỘC TÍNH ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2a2a); // Màu nền tối Studio

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
const container = document.getElementById('canvas-container');
if(container) {
    container.innerHTML = ''; // Xóa canvas cũ nếu có
    container.appendChild(renderer.domElement);
}

// Lưới & Sàn
const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0x444444);
scene.add(gridHelper);
const plane = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

// Ánh sáng
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

// Controls
const orbit = new OrbitControls(camera, renderer.domElement);
const transformControl = new TransformControls(camera, renderer.domElement);
transformControl.addEventListener('dragging-changed', (e) => orbit.enabled = !e.value);
scene.add(transformControl);

const objects = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// -- PANEL LOGIC --
function updatePropertiesPanel(object) {
    const propContent = document.getElementById('prop-content');
    const propDetails = document.getElementById('prop-details');
    
    if (object) {
        if(propContent) propContent.classList.add('hidden');
        if(propDetails) propDetails.classList.remove('hidden');
        
        const typeEl = document.getElementById('prop-type');
        if(typeEl) typeEl.innerText = object.userData.type || "Unknown";
        
        const xEl = document.getElementById('prop-x');
        if(xEl) xEl.innerText = object.position.x.toFixed(2);
        
        const zEl = document.getElementById('prop-z');
        if(zEl) zEl.innerText = object.position.z.toFixed(2);
        
        const colorEl = document.getElementById('prop-color');
        if(colorEl && object.material && object.material.color) {
            colorEl.style.backgroundColor = '#' + object.material.color.getHexString();
        }
    } else {
        if(propContent) propContent.classList.remove('hidden');
        if(propDetails) propDetails.classList.add('hidden');
    }
}

transformControl.addEventListener('change', () => {
    if(transformControl.object) updatePropertiesPanel(transformControl.object);
});

window.addFurniture = (type) => {
    let geometry;
    if (type === 'box') geometry = new THREE.BoxGeometry(1, 1, 1);
    else if (type === 'cylinder') geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    else geometry = new THREE.SphereGeometry(0.5, 32, 32);

    const material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0.5, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.type = type;

    scene.add(mesh);
    objects.push(mesh);
    transformControl.attach(mesh);
    updatePropertiesPanel(mesh);
};

renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects);
    
    if (intersects.length > 0) {
        transformControl.attach(intersects[0].object);
        updatePropertiesPanel(intersects[0].object);
    } else {
        transformControl.detach();
        updatePropertiesPanel(null);
    }
});

// Xóa vật thể
const btnDeleteObj = document.getElementById('btn-delete-obj');
if(btnDeleteObj) {
    btnDeleteObj.addEventListener('click', () => {
        if(transformControl.object) {
            const obj = transformControl.object;
            scene.remove(obj);
            objects.splice(objects.indexOf(obj), 1);
            transformControl.detach();
            updatePropertiesPanel(null);
        }
    });
}

window.addEventListener('keydown', (e) => {
    if((e.key === 'Delete' || e.key === 'Backspace') && transformControl.object) {
        const obj = transformControl.object;
        scene.remove(obj);
        objects.splice(objects.indexOf(obj), 1);
        transformControl.detach();
        updatePropertiesPanel(null);
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Save/Load
const btnSave = document.getElementById('btn-save');
if(btnSave) {
    btnSave.addEventListener('click', () => {
        if (!currentUser) return alert("Vui lòng đăng nhập!");
        const designData = objects.map(obj => ({
            type: obj.userData.type,
            position: obj.position,
            rotation: obj.rotation,
            scale: obj.scale,
            color: obj.material.color.getHex()
        }));
        saveDesignToCloud(currentUser.uid, designData);
    });
}

const btnLoad = document.getElementById('btn-load');
if(btnLoad) {
    btnLoad.addEventListener('click', async () => {
        if (!currentUser) return alert("Vui lòng đăng nhập!");
        const data = await loadDesignFromCloud(currentUser.uid);
        if (data) {
            objects.forEach(obj => scene.remove(obj));
            objects.length = 0;
            transformControl.detach();
            updatePropertiesPanel(null);
            
            data.forEach(item => { 
                let geometry;
                if (item.type === 'box') geometry = new THREE.BoxGeometry(1, 1, 1);
                else if (item.type === 'cylinder') geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
                else geometry = new THREE.SphereGeometry(0.5, 32, 32);
                
                const material = new THREE.MeshStandardMaterial({ color: item.color || Math.random() * 0xffffff });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(item.position);
                mesh.rotation.copy(item.rotation);
                mesh.scale.copy(item.scale);
                mesh.castShadow = true;
                mesh.userData.type = item.type;
                scene.add(mesh);
                objects.push(mesh);
            });
            alert("Đã tải thiết kế!");
        } else {
            alert("Chưa có bản lưu nào.");
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    orbit.update();
    renderer.render(scene, camera);
}
animate();