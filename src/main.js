import './style.css'; 
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { 
    loginWithGoogle, loginWithEmail, registerWithEmail, logoutUser, 
    saveDesignToCloud, loadDesignFromCloud 
} from './firebase-config.js';
import { getAuth, onAuthStateChanged } from "firebase/auth";

// --- GLOBAL VARIABLES ---
let currentUser = null;
const objects = []; // Mảng chứa các vật thể nội thất (QUAN TRỌNG CHO RAYCASTER)
const history = []; 
const redoStack = [];
let roomMeshes = [];
let dragStartTransform = null; 
let currentRoomConfig = null;

// --- HELPER: Auto Icon ---
function getIcon(name) {
    const n = name.toLowerCase();
    if(n.includes('chair') || n.includes('sofa') || n.includes('bench') || n.includes('couch')) return 'couch';
    if(n.includes('bed')) return 'bed';
    if(n.includes('table') || n.includes('desk')) return 'table';
    if(n.includes('lamp') || n.includes('light')) return 'lightbulb';
    if(n.includes('plant') || n.includes('flower')) return 'seedling';
    if(n.includes('cabinet') || n.includes('shelf') || n.includes('wardrobe')) return 'box-archive';
    if(n.includes('computer') || n.includes('monitor') || n.includes('tv')) return 'computer';
    if(n.includes('bath') || n.includes('toilet') || n.includes('sink')) return 'bath';
    if(n.includes('fridge') || n.includes('kitchen')) return 'utensils';
    if(n.includes('window') || n.includes('curtain') || n.includes('blind')) return 'border-all';
    if(n.includes('picture') || n.includes('art') || n.includes('frame')) return 'image';
    return 'cube';
}

function getScale(name) {
    const n = name.toLowerCase();
    if (n.includes('pen') || n.includes('cup') || n.includes('mouse')) return 2; 
    if (n.includes('bed') && n.includes('double')) return 0.015;
    if (n.includes('bed')) return 0.015;
    return 1.2; 
}

function isWallItem(name) {
    const n = name.toLowerCase();
    return n.includes('window') || n.includes('curtain') || n.includes('blind') || 
           n.includes('art') || n.includes('picture') || n.includes('frame') || 
           n.includes('clock') || n.includes('wall shelf') || n.includes('switch') || 
           n.includes('outlet') || n.includes('ac') || n.includes('mounted') ||
           n.includes('wall lamp') || n.includes('sconce') || n.includes('painting') ||
           n.includes('cabinet upper') || n.includes('doorway');
}

// --- DATABASE: PHÒNG RỘNG HƠN & LIST ĐỒ ---
const ROOM_DATABASE = {
    livingroom: {
        name: "Phòng Khách",
        width: 8, depth: 6, floorColor: 0x8d6e63, wallColor: 0xeeeeee,
        folder: '/models/livingroom/',
        items: [
            "Couch Large.glb", "Couch Medium.glb", "Couch Small.glb", "L Couch.glb", "Lounge Sofa.glb", 
            "Lounge Sofa Corner.glb", "Lounge Sofa Long.glb", "Lounge Sofa Ottoman.glb", "Lounge Design Sofa.glb", "Lounge Design Sofa Corn.glb",
            "Chair.glb", "Chair Rounded.glb", "Chair Modern Cushion.glb", "Chair Modern Frame Cush.glb", "Chair Desk.glb", "Chair Cushion.glb", "Lounge Chair.glb", "Lounge Chair-PImRvMqW1O.glb", "Lounge Design Chair.glb",
            "Coffee Table.glb", "Side Table.glb", "Side Table Drawers.glb", "Round Table.glb", "Desk.glb", "Desk Corner.glb",
            "Cabinet Television.glb", "Cabinet Television Doo.glb", "Cabinet Bed.glb", "Cabinet Bed Drawer.glb", "Cabinet Bed Drawer Tabl.glb",
            "Bookcase Open.glb", "Bookcase Open Low.glb", "Bookcase Closed.glb", "Bookcase Closed Wide.glb", "Bookcase Closed Doors.glb", "Books.glb",
            "Rug Rectangle.glb", "Rug Round.glb", "Rug Rounded.glb", "Rug Square.glb", "Rug Doormat.glb",
            "Potted Plant.glb", "Plant Small.glb",
            "Lamp Floor.glb", "Lamp Round Floor.glb", "Lamp Round Table.glb", "Lamp Square Ceiling.glb", "Lamp Square Floor.glb", "Lamp Square Table.glb", "Lamp Wall.glb", "Ceiling Fan.glb",
            "Speaker.glb", "Speaker Small.glb", "Radio.glb", "Laptop.glb", "Computer Screen.glb", "Computer Keyboard.glb",
            "Coat Rack.glb", "Coat Rack Standing.glb", "Cardboard Box Open.glb", "Cardboard Box Closed.glb", "Paneling.glb", "Doorway.glb", "Doorway Front.glb", "Doorway Open.glb", "Dryer.glb", "Shower Round.glb"
        ].map(file => ({ fileName: file, name: file.replace('.glb',''), type: 'model', icon: getIcon(file), scale: getScale(file) }))
    },
    bedroom: {
        name: "Phòng Ngủ",
        width: 6, depth: 5, floorColor: 0xe0e0e0, wallColor: 0xffccbc,
        folder: '/models/bedroom/',
        items: [
            "Bed Double.glb", "Bed Single.glb", "Bunk Bed.glb", "Bedroom.glb",
            "Large Wardrobe.glb", "Small Wardrobe.glb", "Dresser.glb", "Lingerie Dresser.glb", "Night Stand.glb",
            "Large Book Shelf.glb", "Floating Shelf.glb", "Cabinet Bed Drawer.glb", "Cabinet Bed Drawer Tabl.glb",
            "L Shaped Desk.glb", "Wooden Chair.glb", "Wooden Arm Chair.glb",
            "Floor Lamp.glb", "Ceiling Lamp.glb", "Lamp Round Floor.glb", "Lamp Round Table.glb", "Lamp Square Ceiling.glb", "Lamp Square Floor.glb", "Lamp Square Table.glb", "Lamp Wall.glb",
            "Rug Round.glb", "Monitor.glb", "Tv.glb", "Guitar.glb", "Football.glb", "Dumbell.glb", "Painting Canvas.glb", "Pencil.glb", "Plate.glb", "Glass Cup.glb", "Plastic Cup.glb"
        ].map(file => ({ fileName: file, name: file.replace('.glb',''), type: 'model', icon: getIcon(file), scale: getScale(file) }))
    },
    kitchen: {
        name: "Nhà Bếp",
        width: 6, depth: 5, floorColor: 0x616161, wallColor: 0xb2dfdb,
        folder: '/models/kitchen/',
        items: [
            "Fridge.glb", "Kitchen Fridge.glb", "Kitchen Fridge Large.glb", "Kitchen Fridge Small.glb", "Kitchen Fridge Built In.glb",
            "Stove.glb", "Kitchen Stove.glb", "Kitchen Stove Electric.glb", "Kitchen Stove Hood.glb", "Extractor Hood.glb", "Kitchen Hood Large.glb", "Kitchen Microwave.glb", "Toaster.glb", "Kettle.glb", "Kitchen Blender.glb", "Kitchen Coffee Machine.glb",
            "Kitchen Cabinet.glb", "Kitchen Cabinet Upper.glb", "Kitchen Cabinet Upperc.glb", "Kitchen Cabinet Upperl.glb", "Kitchen Cabinet Drawer.glb", "Kitchen Cabinet Corner.glb", "Kitchen Cabinet Corner-t2IJurty30.glb", "Kitchen Cabinet-jRPnkxtk8s.glb",
            "Wall Cabinet Single.glb", "Wall Cabinet Single-TPEJeA6HQM.glb", "Wall Cabinet Straight.glb", "Wall Cabinet Corner.glb",
            "Countertop Straight.glb", "Countertop Straight-ipDw2lbUn2.glb", "Countertop Straight-LXwzLcN9XM.glb", "Countertop Corner.glb", "Countertop Sink.glb", "Countertop Single.glb", "Countertop Counter O.glb",
            "Kitchen Sink.glb", "Kitchen Bar.glb", 
            "Container Kitchen A.glb", "Container Kitchen B.glb", "Plate.glb", "Pot.glb", "Pan.glb", "Lid.glb", "Cutting Board.glb", "Dishrack.glb", "Dishrack Plates.glb", "Utensils Cup.glb", "Spoon.glb", "Spatula.glb", "Kitchen Knife.glb", "Wall Knife Rack.glb", "Papertowel Holder.glb", "Wall Papertowel.glb", "Oven Glove.glb",
            "Mug Yellow.glb", "Red Mug.glb", "Blue Mug.glb"
        ].map(file => ({ fileName: file, name: file.replace('.glb',''), type: 'model', icon: getIcon(file), scale: getScale(file) }))
    },
    bathroom: {
        name: "Phòng Tắm",
        width: 4, depth: 4, floorColor: 0xffffff, wallColor: 0x81d4fa,
        folder: '/models/bathroom/',
        items: [
            "Bath.glb", "Bathtub.glb", "Shower Round.glb", "Toilet.glb", "Bathroom Sink.glb", "Bathroom Sink Square.glb", 
            "Bathroom Cabinet.glb", "Bathroom Cabinet Drawe.glb", "Cabinet Bathroom.glb", "Wall Shelf.glb", 
            "Mirror.glb", "Bathroom Mirror.glb", 
            "Towel Rack.glb", "Towel Stacked.glb", "Towel Blue.glb", "Towel Pink.glb", "Towel Yellow.glb", 
            "Mat.glb", "Slippers.glb", "Ducky.glb", "Candle.glb", "Plant.glb",
            "Toothbrush Blue.glb", "Toothbrush Pink.glb", "Toothbrush Cup.glb", "Toothbrush Cup Decor.glb",
            "Container Bathroom A.glb", "Container Bathroom B.glb", "Container Bathroom C.glb", "Container Bathroom D.glb",
            "Wall Tiled Straight.glb", "Wall Tiled Corner In.glb", "Wall Tiled Corner Ou.glb", "Wall Tiled Doorway.glb", "Wall Tiled Window.glb", "Floor Tiled.glb"
        ].map(file => ({ fileName: file, name: file.replace('.glb',''), type: 'model', icon: getIcon(file), scale: getScale(file) }))
    },
    officeroom: {
        name: "Văn Phòng",
        width: 7, depth: 6, floorColor: 0x455a64, wallColor: 0xcfd8dc,
        folder: '/models/officeroom/',
        items: [
            "Desk.glb", "Desk-ISpMh81QGq.glb", "Desk-EtJlOllzbf.glb", "Desk-V86Go2rlnq.glb", "Desk-7ban171PzCS.glb", "Adjustable Desk.glb", "Standing Desk.glb", "L Shaped Desk.glb", "Table.glb", "Table Large Circular.glb", "Table tennis table.glb", "Table Tennis Paddle.glb", "Coffee Table.glb",
            "Office Chair.glb", "Chair.glb", "Chair-1MFMOaz3zqe.glb", "Couch Medium.glb", "Couch Small.glb", "Couch _ Wide.glb",
            "Computer.glb", "Monitor.glb", "Dual Monitors on sit-stand arm.glb", "Laptop bag.glb", "Keyboard.glb", "Computer Keyboard.glb", "Mouse.glb", "Mousepad.glb", "Computer mouse.glb", "Printer.glb", "Webcam.glb", "Office Phone.glb", "Phone.glb",
            "File Cabinet.glb", "Cabinet.glb", "Cabinet Bed Drawer Tabl.glb", "Shelf.glb", "Shelf Small.glb", "Medium Book Shelf.glb", "Wall Shelf.glb", 
            "Whiteboard.glb", "Message board.glb", "Calendar.glb", "Notebook.glb", "Binder.glb", "Book Stack.glb", "Various Stacks of Paper.glb", "Small Stack of Paper.glb", "Sticky Notes.glb", "Pens.glb", "Stapler.glb", "clipboard.glb", "Briefcase.glb",
            "Water Cooler.glb", "Vending Machine.glb", "Coffee cup.glb", "Cup.glb", "Mug.glb", "Mug With Office Tool.glb", "Soda.glb", "Soda Can.glb", "Crushed Soda Can.glb",
            "Trashcan.glb", "Trashcan Small.glb", "Trash Bin.glb", "Bins.glb",
            "Lamp.glb", "Light Desk.glb", "Light Floor.glb", "Light Ceiling.glb", "Ceiling Light.glb",
            "Potted Plant.glb", "Houseplant.glb", "Plant - White Pot.glb", 
            "Wall Art 02.glb", "Wall Art 03.glb", "Wall Art 05.glb", "Wall Art 06.glb", "Blank Picture Frame.glb", "Analog clock.glb", "Trophy.glb", "Rubik's cube.glb", "Desk Toy.glb", "Darts.glb", "Dartboard.glb", "Skateboard.glb", "MS Gundam RX-78-2 with weapons.glb",
            "Rug.glb", "Rug Round.glb", "Cushions.glb", "Window Blinds.glb", "Curtains Double.glb", "Air Vent.glb", "Electrical outlet.glb", "Light Switch.glb", "Fire Extinguisher.glb", "Fire Exit Sign.glb", "CCTV Camera.glb", "Ladder.glb", "Manhole cover.glb"
        ].map(file => ({ fileName: file, name: file.replace('.glb',''), type: 'model', icon: getIcon(file), scale: getScale(file) }))
    },
    empty: {
        name: "Sân Khấu", width: 10, depth: 10, floorColor: 0x222222, wallColor: null, folder: '',
        items: [{ name: "Khối Vuông", icon: "cube", type: 'box', color: 0xaaaaaa, scale: {x:1, y:1, z:1} }]
    }
};

// --- 1. SETUP SCENE ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 30); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace; 

// *** QUAN TRỌNG: Tabindex để nhận phím T, R ***
renderer.domElement.setAttribute('tabindex', '1'); 
renderer.domElement.style.outline = 'none';

const container = document.getElementById('canvas-container');
if(container) { container.innerHTML = ''; container.appendChild(renderer.domElement); }

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096;
dirLight.shadow.mapSize.height = 4096;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const orbit = new OrbitControls(camera, renderer.domElement);
const transformControl = new TransformControls(camera, renderer.domElement);
// Khi đang kéo vật thể -> Tắt xoay camera
transformControl.addEventListener('dragging-changed', (event) => {
    orbit.enabled = !event.value;
});
scene.add(transformControl);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const loader = new GLTFLoader();

// --- 2. LOGIC CHỌN VẬT THỂ (FIXED) ---

renderer.domElement.addEventListener('pointerdown', (event) => {
    // 1. Nếu click vào UI thì không làm gì
    if (event.target.closest('.floating-toolbar') || event.target.closest('.floating-header') || event.target.closest('.floating-panel')) return;
    
    // 2. FOCUS CANVAS NGAY LẬP TỨC ĐỂ NHẬN PHÍM TẮT
    renderer.domElement.focus();

    if (event.button !== 0) return; // Chỉ chuột trái

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    // 3. CHỈ RAYCAST VÀO DANH SÁCH 'objects' (Bỏ qua tường, sàn, gizmo)
    // 'true' nghĩa là kiểm tra cả các mesh con bên trong model
    const intersects = raycaster.intersectObjects(objects, true);
    
    if (intersects.length > 0) {
        let selected = intersects[0].object;
        
        // 4. TÌM VỀ GỐC (ROOT OBJECT)
        // Vì click trúng 'Mesh' (chân ghế), ta phải tìm 'Group' (cả cái ghế) nằm trong mảng 'objects'
        while (selected.parent && !objects.includes(selected)) {
            selected = selected.parent;
        }
        
        // Nếu tìm thấy vật thể hợp lệ
        if (objects.includes(selected)) {
            transformControl.attach(selected);
            updatePropertiesPanel(selected);
        }
    } else {
        // Click ra ngoài -> Bỏ chọn
        transformControl.detach();
        updatePropertiesPanel(null);
    }
});

// Sự kiện di chuột vào màn hình -> Tự động focus
renderer.domElement.addEventListener('pointerenter', () => {
    renderer.domElement.focus();
});

// --- 3. PHÍM TẮT (T, R, DEL) ---
window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    const key = e.key.toLowerCase();

    // Delete
    if (key === 'delete' || key === 'backspace') {
        if (transformControl.object) deleteObject(transformControl.object);
    }
    
    // T: Translate, R: Rotate
    if (key === 't') transformControl.setMode('translate');
    if (key === 'r') transformControl.setMode('rotate');
    
    // Undo / Redo
    if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); executeUndo(); }
    if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); executeRedo(); }
});

function deleteObject(obj) {
    if (!obj) return;
    addToHistory({ type: 'REMOVE', object: obj });
    scene.remove(obj);
    const idx = objects.indexOf(obj);
    if (idx > -1) objects.splice(idx, 1);
    transformControl.detach();
    updatePropertiesPanel(null);
}

// --- 4. HISTORY SYSTEM ---
// Ghi lịch sử khi thả chuột (kết thúc kéo)
transformControl.addEventListener('dragging-changed', (event) => {
    orbit.enabled = !event.value;
    if (event.value) { // Start Drag
        if(transformControl.object) {
            dragStartTransform = {
                pos: transformControl.object.position.clone(),
                rot: transformControl.object.rotation.clone(),
                scale: transformControl.object.scale.clone()
            };
        }
    } else { // End Drag
        if(transformControl.object && dragStartTransform) {
            addToHistory({
                type: 'TRANSFORM',
                object: transformControl.object,
                oldPos: dragStartTransform.pos, oldRot: dragStartTransform.rot, oldScale: dragStartTransform.scale,
                newPos: transformControl.object.position.clone(), newRot: transformControl.object.rotation.clone(), newScale: transformControl.object.scale.clone()
            });
        }
    }
});

function addToHistory(action) {
    history.push(action);
    redoStack.length = 0; 
}

function executeUndo() {
    if (history.length === 0) return;
    const action = history.pop();
    redoStack.push(action);

    if (action.type === 'ADD') {
        scene.remove(action.object);
        const idx = objects.indexOf(action.object);
        if (idx > -1) objects.splice(idx, 1);
        transformControl.detach();
        updatePropertiesPanel(null);
    } else if (action.type === 'REMOVE') {
        scene.add(action.object);
        objects.push(action.object);
        transformControl.attach(action.object);
        updatePropertiesPanel(action.object);
    } else if (action.type === 'TRANSFORM') {
        action.object.position.copy(action.oldPos);
        action.object.rotation.copy(action.oldRot);
        action.object.scale.copy(action.oldScale);
        transformControl.attach(action.object);
    }
}

function executeRedo() {
    if (redoStack.length === 0) return;
    const action = redoStack.pop();
    history.push(action);

    if (action.type === 'ADD') {
        scene.add(action.object);
        objects.push(action.object);
        transformControl.attach(action.object);
    } else if (action.type === 'REMOVE') {
        scene.remove(action.object);
        const idx = objects.indexOf(action.object);
        if (idx > -1) objects.splice(idx, 1);
        transformControl.detach();
        updatePropertiesPanel(null);
    } else if (action.type === 'TRANSFORM') {
        action.object.position.copy(action.newPos);
        action.object.rotation.copy(action.newRot);
        action.object.scale.copy(action.newScale);
        transformControl.attach(action.object);
    }
}

// --- 5. LOGIC TẠO PHÒNG & ĐỒ ---
function buildRoomShell(config) {
    currentRoomConfig = config;
    roomMeshes.forEach(mesh => scene.remove(mesh));
    roomMeshes = [];

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(config.width, config.depth), new THREE.MeshStandardMaterial({ color: config.floorColor }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor); roomMeshes.push(floor);

    if (config.wallColor) {
        const h = 6; 
        const wallMat = new THREE.MeshStandardMaterial({ color: config.wallColor, side: THREE.DoubleSide });
        
        const back = new THREE.Mesh(new THREE.PlaneGeometry(config.width, h), wallMat);
        back.position.set(0, h/2, -config.depth/2); back.receiveShadow = true;
        scene.add(back); roomMeshes.push(back);

        const left = new THREE.Mesh(new THREE.PlaneGeometry(config.depth, h), wallMat);
        left.rotation.y = Math.PI / 2; left.position.set(-config.width/2, h/2, 0); left.receiveShadow = true;
        scene.add(left); roomMeshes.push(left);

        const right = new THREE.Mesh(new THREE.PlaneGeometry(config.depth, h), wallMat);
        right.rotation.y = -Math.PI / 2; right.position.set(config.width/2, h/2, 0); right.receiveShadow = true;
        scene.add(right); roomMeshes.push(right);
    }
}

function updateToolbar(roomKey, items) {
    const toolbar = document.getElementById('dynamic-toolbar');
    if(!toolbar) return;
    toolbar.innerHTML = `<div class="ft-label">Nội Thất</div>`;
    toolbar.style.overflowY = 'auto'; toolbar.style.maxHeight = '70vh';

    const currentRoomConfig = ROOM_DATABASE[roomKey];
    items.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'tool-item';
        btn.title = item.name;
        btn.innerHTML = `<i class="fa-solid fa-${item.icon}"></i>`;
        btn.onclick = (e) => {
            e.stopPropagation(); 
            createObjectFromConfig(item, currentRoomConfig.folder);
        };
        toolbar.appendChild(btn);
    });
}

function createObjectFromConfig(item, folderPath) {
    if (item.type === 'model' && item.fileName) {
        const fullPath = folderPath + item.fileName;
        loader.load(fullPath, (gltf) => {
            const model = gltf.scene;
            model.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
            
            let sX = item.scale.x || item.scale, sY = item.scale.y || item.scale, sZ = item.scale.z || item.scale;
            model.scale.set(sX, sY, sZ);

            if (item.isWallMounted && currentRoomConfig) {
                model.position.set(0, 2.5, -currentRoomConfig.depth/2 + 0.2); 
            } else {
                model.position.set(0, 0, 0); 
            }
            
            model.userData = { 
                type: 'model', name: item.name, path: fullPath, 
                baseScale: item.scale, isWallMounted: item.isWallMounted
            };
            
            scene.add(model); 
            objects.push(model); // Đưa vào mảng quản lý
            
            transformControl.attach(model); 
            updatePropertiesPanel(model);
            addToHistory({ type: 'ADD', object: model }); 

        }, undefined, (err) => { console.warn(`Lỗi tải file: ${fullPath}`); });
    } else {
        let geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ color: item.color || 0x999999 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.set(1,1,1);
        mesh.position.set(0, 0.5, 0);
        
        mesh.userData = { type: 'basic', name: item.name };
        
        scene.add(mesh); objects.push(mesh);
        transformControl.attach(mesh); updatePropertiesPanel(mesh);
        addToHistory({ type: 'ADD', object: mesh });
    }
}

// --- 6. UI UPDATE ---
function updatePropertiesPanel(object) {
    const propDetails = document.getElementById('prop-details');
    const propContent = document.getElementById('prop-content');
    if (object) {
        if(propContent) propContent.classList.add('hidden');
        if(propDetails) propDetails.classList.remove('hidden');
        document.getElementById('prop-type').innerText = object.userData.name || "Model";
        document.getElementById('prop-x').innerText = object.position.x.toFixed(2);
        document.getElementById('prop-z').innerText = object.position.z.toFixed(2);
        const colorEl = document.getElementById('prop-color');
        if(colorEl) colorEl.style.backgroundColor = '#4a90e2';
    } else {
        if(propContent) propContent.classList.remove('hidden');
        if(propDetails) propDetails.classList.add('hidden');
    }
}
transformControl.addEventListener('change', () => { if(transformControl.object) updatePropertiesPanel(transformControl.object); });

const btnUndo = document.getElementById('btn-undo');
if(btnUndo) btnUndo.addEventListener('click', executeUndo);
const btnRedo = document.getElementById('btn-redo');
if(btnRedo) btnRedo.addEventListener('click', executeRedo);
const btnDeleteObj = document.getElementById('btn-delete-obj');
if(btnDeleteObj) btnDeleteObj.addEventListener('click', () => deleteObject(transformControl.object));

const roomSelector = document.getElementById('room-selector');
if (roomSelector) {
    roomSelector.addEventListener('change', (e) => {
        const roomKey = e.target.value;
        const roomConfig = ROOM_DATABASE[roomKey];
        if (roomConfig) {
            buildRoomShell(roomConfig);
            updateToolbar(roomKey, roomConfig.items);
            objects.forEach(obj => scene.remove(obj)); objects.length = 0;
            transformControl.detach(); updatePropertiesPanel(null);
            history.length = 0; redoStack.length = 0; 
            camera.position.set(0, 15, roomConfig.depth * 1.5);
            camera.lookAt(0, 0, 0);
            renderer.domElement.focus();
        }
    });
}

function animate() { requestAnimationFrame(animate); orbit.update(); renderer.render(scene, camera); }
animate();
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- 7. AUTH & MODAL ---
const auth = getAuth();
const homepage = document.getElementById('homepage');
const loginOverlay = document.getElementById('login-overlay');
const mainUi = document.getElementById('main-ui');
const modalOverlay = document.getElementById('modal-overlay');

function showLogin() {
    if(homepage) homepage.classList.add('hidden');
    if(mainUi) mainUi.classList.add('hidden');
    if(loginOverlay) { loginOverlay.classList.remove('hidden'); loginOverlay.style.display = 'flex'; }
}
function showMainApp(user) {
    currentUser = user;
    if(homepage) homepage.classList.add('hidden');
    if(loginOverlay) loginOverlay.classList.add('hidden');
    if(mainUi) mainUi.classList.remove('hidden');
    let name = user.email.split('@')[0];
    if(user.displayName) name = user.displayName;
    const uDisplay = document.getElementById('user-display'); if(uDisplay) uDisplay.innerText = name;
}

onAuthStateChanged(auth, async (user) => { if (user) {} });

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

function toggleModal(show) {
    if(show) { if(modalOverlay) { modalOverlay.classList.remove('hidden'); modalOverlay.style.display = 'flex'; } }
    else { if(modalOverlay) modalOverlay.classList.add('hidden'); }
}
const closeModalBtn = document.getElementById('modal-close');
if(closeModalBtn) closeModalBtn.addEventListener('click', () => toggleModal(false));

const btnSave = document.getElementById('btn-save');
if(btnSave) btnSave.addEventListener('click', () => {
    if (!currentUser) return alert("Đăng nhập để lưu!");
    const saveName = prompt("Đặt tên thiết kế:", "Design " + new Date().toLocaleDateString());
    if(!saveName) return;
    const data = objects.map(obj => ({
        type: obj.userData.type, name: obj.userData.name, path: obj.userData.path,
        baseScale: obj.userData.baseScale, position: obj.position, rotation: obj.rotation, scale: obj.scale,
        isWallMounted: obj.userData.isWallMounted
    }));
    saveDesignToCloud(currentUser.uid, data); 
    alert(`Đã lưu "${saveName}"!`);
});

const btnLoad = document.getElementById('btn-load');
if(btnLoad) btnLoad.addEventListener('click', async () => {
    if (!currentUser) return alert("Đăng nhập để tải!");
    toggleModal(true);
    const listContainer = document.getElementById('save-list');
    if(listContainer) {
        listContainer.innerHTML = '<p style="color:#aaa">Đang tải...</p>';
        const data = await loadDesignFromCloud(currentUser.uid);
        listContainer.innerHTML = '';
        if(data) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'save-item';
            itemDiv.innerHTML = `<div><div class="save-name">Bản lưu mới nhất</div></div><i class="fa-solid fa-cloud-arrow-down"></i>`;
            itemDiv.onclick = () => {
                objects.forEach(obj => scene.remove(obj)); objects.length = 0; transformControl.detach();
                data.forEach(item => {
                    const folder = item.path ? item.path.substring(0, item.path.lastIndexOf('/')+1) : '';
                    const fileName = item.path ? item.path.split('/').pop() : '';
                    const configItem = { fileName: fileName, scale: item.baseScale, name: item.name, type: item.type, isWallMounted: item.isWallMounted };
                    createObjectFromConfig(configItem, folder); 
                });
                toggleModal(false);
                alert("Đã tải!");
            };
            listContainer.appendChild(itemDiv);
        } else {
            listContainer.innerHTML = '<p style="color:#aaa">Chưa có bản lưu.</p>';
        }
    }
});