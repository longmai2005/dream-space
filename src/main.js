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

// --- 1. XỬ LÝ CHUYỂN TRANG (HOMEPAGE -> LOGIN -> APP) ---
const homepage = document.getElementById('homepage');
const loginOverlay = document.getElementById('login-overlay');
const mainUi = document.getElementById('main-ui');

// Hàm hiển thị màn hình Login
function showLogin() {
    if(homepage) homepage.classList.add('hidden');
    if(loginOverlay) {
        loginOverlay.classList.remove('hidden');
        loginOverlay.style.display = 'flex'; 
    }
}

// Hàm hiển thị App chính (3D)
function showMainApp(user) {
    currentUser = user;
    if(homepage) homepage.classList.add('hidden');
    if(loginOverlay) loginOverlay.classList.add('hidden');
    if(mainUi) mainUi.classList.remove('hidden');
    
    let displayName = user.email.split('@')[0]; 
    if(user.displayName) displayName = user.displayName;
    const userDisplay = document.getElementById('user-display');
    if(userDisplay) userDisplay.innerText = displayName;
}

// Bắt sự kiện nút "Bắt đầu"
const btnStartNav = document.getElementById('btn-start-nav');
if(btnStartNav) btnStartNav.addEventListener('click', () => checkAuthAndRedirect());

const btnStartHero = document.getElementById('btn-start-hero');
if(btnStartHero) btnStartHero.addEventListener('click', () => checkAuthAndRedirect());

const auth = getAuth();
function checkAuthAndRedirect() {
    if (auth.currentUser) {
        showMainApp(auth.currentUser);
    } else {
        showLogin();
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user; 
    }
});

// --- 2. XỬ LÝ FORM LOGIN ---
const toggleBtn = document.getElementById('toggle-mode');
const submitBtn = document.getElementById('btn-submit');
const title = document.getElementById('form-title');
const subtitle = document.getElementById('form-subtitle');

if(toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        if (isRegisterMode) {
            title.innerText = "Đăng ký";
            subtitle.innerText = "Tạo tài khoản mới miễn phí";
            submitBtn.innerText = "Đăng ký ngay";
            toggleBtn.innerText = "Đã có tài khoản? Đăng nhập";
        } else {
            title.innerText = "Đăng nhập";
            subtitle.innerText = "Để lưu trữ các bản thiết kế của bạn";
            submitBtn.innerText = "Vào thiết kế";
            toggleBtn.innerText = "Chưa có tài khoản? Đăng ký ngay";
        }
    });
}

if(submitBtn) {
    submitBtn.addEventListener('click', async () => {
        const username = document.getElementById('email-input').value.trim();
        let pass = document.getElementById('pass-input').value;
        
        if(!username || !pass) { alert("Vui lòng nhập đầy đủ thông tin!"); return; }

        const fakeEmail = username.includes('@') ? username : username + "@dream.app";
        if(pass === "123") pass = "123123"; 

        try {
            let user;
            if (isRegisterMode) {
                user = await registerWithEmail(fakeEmail, pass);
                alert("Đăng ký thành công!");
            } else {
                user = await loginWithEmail(fakeEmail, pass);
            }
            if(user) showMainApp(user);
        } catch (error) {
            let msg = error.message;
            if(msg.includes("user-not-found") || msg.includes("invalid-credential")) msg = "Sai tài khoản hoặc mật khẩu.";
            if(msg.includes("email-already-in-use")) msg = "Tên đăng nhập đã tồn tại.";
            alert("Lỗi: " + msg);
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

const btnLogout = document.getElementById('btn-logout');
if(btnLogout) {
    btnLogout.addEventListener('click', () => { 
        logoutUser(); 
        window.location.reload(); 
    });
}

// --- 3. 3D SCENE ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdcdcdc);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
const container = document.getElementById('canvas-container');
if(container) container.appendChild(renderer.domElement);

const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);
const plane = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const orbit = new OrbitControls(camera, renderer.domElement);
const transformControl = new TransformControls(camera, renderer.domElement);
transformControl.addEventListener('dragging-changed', (e) => orbit.enabled = !e.value);
scene.add(transformControl);

const objects = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

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
};

renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects);
    if (intersects.length > 0) transformControl.attach(intersects[0].object);
    else transformControl.detach();
});

window.addEventListener('keydown', (e) => {
    if((e.key === 'Delete' || e.key === 'Backspace') && transformControl.object) {
        const obj = transformControl.object;
        scene.remove(obj);
        objects.splice(objects.indexOf(obj), 1);
        transformControl.detach();
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const btnSave = document.getElementById('btn-save');
if(btnSave) {
    btnSave.addEventListener('click', () => {
        if (!currentUser) return;
        const designData = objects.map(obj => ({
            type: obj.userData.type,
            position: obj.position,
            rotation: obj.rotation,
            scale: obj.scale
        }));
        saveDesignToCloud(currentUser.uid, designData);
    });
}

const btnLoad = document.getElementById('btn-load');
if(btnLoad) {
    btnLoad.addEventListener('click', async () => {
        if (!currentUser) return;
        const data = await loadDesignFromCloud(currentUser.uid);
        if (data) {
            objects.forEach(obj => scene.remove(obj));
            objects.length = 0;
            transformControl.detach();
            data.forEach(item => { window.addFurniture(item.type); });
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