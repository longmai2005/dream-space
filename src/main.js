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

// --- 0. INIT & VARIABLES ---
let currentUser = null;
const objects = []; 
const history = []; 
const redoStack = [];
let roomMeshes = [];
let currentRoomConfig = null;

// Biến Dragging
let isDragging = false;
let draggedObject = null;
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const intersectPoint = new THREE.Vector3();
const offset = new THREE.Vector3();

// *** QUAN TRỌNG: HÀM TOÀN CỤC ĐỂ HTML GỌI ***
window.selectRoomFromDashboard = (roomKey) => {
    console.log("Đã chọn phòng:", roomKey); // Log để kiểm tra
    const selector = document.getElementById('room-selector');
    const welcomeScreen = document.getElementById('studio-welcome');
    
    // 1. Đồng bộ menu dropdown và kích hoạt sự kiện change
    if(selector) {
        selector.value = roomKey;
        selector.dispatchEvent(new Event('change'));
    }

    // 2. Ẩn màn hình Welcome
    if(welcomeScreen) {
        welcomeScreen.style.opacity = '0';
        setTimeout(() => {
            welcomeScreen.classList.add('hidden');
        }, 500);
    }
};

// --- HELPER FUNCTIONS (ĐÃ FIX LỖI CRASH) ---
function getIcon(name) {
    if (!name || typeof name !== 'string') return 'cube'; // <--- FIX LỖI: Nếu không có tên thì trả về icon mặc định
    const n = name.toLowerCase();
    if(n.includes('chair') || n.includes('sofa') || n.includes('bench') || n.includes('couch')) return 'couch';
    if(n.includes('bed')) return 'bed';
    if(n.includes('table') || n.includes('desk')) return 'table';
    if(n.includes('lamp') || n.includes('light')) return 'lightbulb';
    if(n.includes('plant') || n.includes('flower')) return 'seedling';
    if(n.includes('cabinet') || n.includes('shelf') || n.includes('wardrobe')) return 'box-archive';
    if(n.includes('computer') || n.includes('monitor') || n.includes('tv')) return 'computer';
    if(n.includes('bath') || n.includes('toilet') || n.includes('sink')) return 'bath';
    if(n.includes('fridge') || n.includes('kitchen') || n.includes('stove')) return 'utensils';
    if(n.includes('window') || n.includes('curtain') || n.includes('blind')) return 'border-all';
    if(n.includes('picture') || n.includes('art') || n.includes('frame')) return 'image';
    return 'cube';
}

function isWallItem(name) {
    if (!name || typeof name !== 'string') return false; // <--- FIX LỖI: Chặn lỗi toLowerCase của undefined
    const n = name.toLowerCase(); 
    return n.includes('window') || n.includes('curtain') || n.includes('blind') || 
           n.includes('art') || n.includes('picture') || n.includes('frame') || 
           n.includes('clock') || n.includes('wall shelf') || n.includes('switch') || 
           n.includes('outlet') || n.includes('ac') || n.includes('mounted') ||
           n.includes('wall lamp') || n.includes('sconce') || n.includes('painting') ||
           n.includes('cabinet upper') || n.includes('doorway') || n.includes('knife rack') || n.includes('papertowel');
}

function getScale(name) {
    if (!name || typeof name !== 'string') return 1.2;
    const n = name.toLowerCase();
    if (n.includes('pen') || n.includes('cup') || n.includes('mouse') || n.includes('brush') || n.includes('soda') || n.includes('mug')) return 2.0; 
    if (n.includes('bed') && (n.includes('double') || n.includes('bunk') || n.includes('single'))) return 0.015;
    return 1.2; 
}

// --- DATABASE ---
const ROOM_DATABASE = {
    livingroom: {
        name: "Phòng Khách",
        width: 20, depth: 15, floorColor: 0x8d6e63, wallColor: 0xeeeeee,
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
        ].map(file => ({ fileName: file, name: file.replace('.glb',''), type: 'model', icon: getIcon(file), scale: getScale(file), isWallMounted: isWallItem(file) }))
    },
    bedroom: {
        name: "Phòng Ngủ",
        width: 18, depth: 14, floorColor: 0xe0e0e0, wallColor: 0xffccbc,
        folder: '/models/bedroom/',
        items: [
            "Bed Double.glb", "Bed Single.glb", "Bunk Bed.glb", "Bedroom.glb",
            "Large Wardrobe.glb", "Small Wardrobe.glb", "Dresser.glb", "Lingerie Dresser.glb", "Night Stand.glb",
            "Large Book Shelf.glb", "Floating Shelf.glb", "Cabinet Bed Drawer.glb", "Cabinet Bed Drawer Tabl.glb",
            "L Shaped Desk.glb", "Wooden Chair.glb", "Wooden Arm Chair.glb",
            "Floor Lamp.glb", "Ceiling Lamp.glb", "Lamp Round Floor.glb", "Lamp Round Table.glb", "Lamp Square Ceiling.glb", "Lamp Square Floor.glb", "Lamp Square Table.glb", "Lamp Wall.glb",
            "Rug Round.glb", "Monitor.glb", "Tv.glb", "Guitar.glb", "Football.glb", "Dumbell.glb", "Painting Canvas.glb", "Pencil.glb", "Plate.glb", "Glass Cup.glb", "Plastic Cup.glb"
        ].map(file => ({ fileName: file, name: file.replace('.glb',''), type: 'model', icon: getIcon(file), scale: getScale(file), isWallMounted: isWallItem(file) }))
    },
    kitchen: {
        name: "Nhà Bếp",
        width: 16, depth: 12, floorColor: 0x616161, wallColor: 0xb2dfdb,
        folder: '/models/kitchen/',
        items: [
            "Fridge.glb", "Kitchen Fridge.glb", "Kitchen Fridge Large.glb", "Kitchen Fridge Small.glb", "Kitchen Fridge Built In.glb",
            "Stove.glb", "Kitchen Stove.glb", "Kitchen Stove Electric.glb", "Kitchen Stove Hood.glb", "Extractor Hood.glb", "Kitchen Hood Large.glb", "Kitchen Microwave.glb", "Toaster.glb", "Kettle.glb", "Kitchen Blender.glb", "Kitchen Coffee Machine.glb",
            "Kitchen Cabinet.glb", "Kitchen Cabinet Upper.glb", "Kitchen Cabinet Upperc.glb", "Kitchen Cabinet Upperl.glb", "Kitchen Cabinet Drawer.glb", "Kitchen Cabinet Corner.glb", "Kitchen Cabinet Corner-t2IJurty30.glb", "Kitchen Cabinet-jRPnkxtk8s.glb",
            "Wall Cabinet Single.glb", "Wall Cabinet Single-TPEJeA6HQM.glb", "Wall Cabinet Straight.glb", "Wall Cabinet Corner.glb",
            "Countertop Straight.glb", "Countertop Straight-ipDw2lbUn2.glb", "Countertop Straight-LXwzLcN9XM.glb", "Countertop Corner.glb", "Countertop Sink.glb", "Countertop Single.glb", "Countertop Counter O.glb",
            "Kitchen Sink.glb", "Kitchen Bar.glb", 
            "Container Kitchen A.glb", "Container Kitchen B.glb", "Plate.glb", "Pot.glb", "Pan.glb", "Lid.glb", "Cutting Board.glb", "Dishrack.glb", "Dishrack Plates.glb", "Utensils Cup.glb", "Spoon.glb", "Spatula.glb", "Kitchen Knife.glb", "Wall Knife Rack.glb", "Wall Papertowel.glb", "Papertowel Holder.glb", "Oven Glove.glb",
            "Mug Yellow.glb", "Red Mug.glb", "Blue Mug.glb"
        ].map(file => ({ fileName: file, name: file.replace('.glb',''), type: 'model', icon: getIcon(file), scale: getScale(file), isWallMounted: isWallItem(file) }))
    },
    bathroom: {
        name: "Phòng Tắm",
        width: 10, depth: 10, floorColor: 0xffffff, wallColor: 0x81d4fa,
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
        ].map(file => ({ fileName: file, name: file.replace('.glb',''), type: 'model', icon: getIcon(file), scale: getScale(file), isWallMounted: isWallItem(file) }))
    },
    officeroom: {
        name: "Văn Phòng",
        width: 18, depth: 14, floorColor: 0x455a64, wallColor: 0xcfd8dc,
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
        ].map(file => ({ fileName: file, name: file.replace('.glb',''), type: 'model', icon: getIcon(file), scale: getScale(file), isWallMounted: isWallItem(file) }))
    },
    empty: {
        name: "Sân Khấu", width: 30, depth: 30, floorColor: 0x222222, wallColor: null, folder: '',
        items: [{ name: "Khối Vuông", icon: "cube", type: 'box', color: 0xaaaaaa, scale: {x:1, y:1, z:1} }]
    }
};

// --- 1. SETUP SCENE ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 30); 

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; 
renderer.domElement.setAttribute('tabindex', '1'); 
renderer.domElement.style.outline = 'none';

const container = document.getElementById('canvas-container');
if(container) { container.innerHTML = ''; container.appendChild(renderer.domElement); }

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(4096, 4096);
dirLight.shadow.camera.left = -50; dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50; dirLight.shadow.camera.bottom = -50;
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true; 
orbit.dampingFactor = 0.05;

const transformControl = new TransformControls(camera, renderer.domElement);
transformControl.setMode('rotate'); 
transformControl.visible = false;   
transformControl.enabled = false;
scene.add(transformControl);

transformControl.addEventListener('dragging-changed', (event) => {
    orbit.enabled = !event.value;
});
transformControl.addEventListener('change', () => {
    if (transformControl.object) limitObjectBounds(transformControl.object);
});

const loader = new GLTFLoader();

// --- 2. LOGIC TƯỜNG & SÀN ---
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
        
        const createWall = (w, h, x, y, z, ry) => {
            const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
            wall.position.set(x, y, z);
            if(ry) wall.rotation.y = ry;
            wall.receiveShadow = true;
            scene.add(wall);
            roomMeshes.push(wall);
        };

        createWall(config.width, h, 0, h/2, -config.depth/2, 0); 
        createWall(config.depth, h, -config.width/2, h/2, 0, Math.PI/2); 
        createWall(config.depth, h, config.width/2, h/2, 0, -Math.PI/2); 
    }
}

// --- 3. LIMIT & AUTO-FLOOR ---
function limitObjectBounds(obj) {
    if (!currentRoomConfig) return;
    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3(); box.getCenter(center);
    const size = new THREE.Vector3(); box.getSize(size);

    const offsetX = obj.position.x - center.x;
    const offsetZ = obj.position.z - center.z;

    const halfRoomW = currentRoomConfig.width / 2;
    const halfRoomD = currentRoomConfig.depth / 2;
    const halfObjW = size.x / 2;
    const halfObjD = size.z / 2;

    let clampedX = Math.max(-halfRoomW + halfObjW, Math.min(halfRoomW - halfObjW, center.x));
    let clampedZ = Math.max(-halfRoomD + halfObjD, Math.min(halfRoomD - halfObjD, center.z));

    obj.position.x = clampedX + offsetX;
    obj.position.z = clampedZ + offsetZ;

    // Auto Floor
    if (!obj.userData.isWallMounted && box.min.y < 0) {
        obj.position.y += (0 - box.min.y);
    }
}

// --- 4. TẠO ĐỒ VẬT ---
function createObjectFromConfig(item, folderPath) {
    if (item.type === 'model' && item.fileName) {
        const fullPath = folderPath + item.fileName;
        loader.load(fullPath, (gltf) => {
            const model = gltf.scene;
            let s = item.scale || 1.2;
            
            model.scale.set(s, s, s);

            if (item.isWallMounted && currentRoomConfig) {
                model.position.set(0, 2.0, -currentRoomConfig.depth/2 + 0.2); 
            } else {
                model.position.set(0, 0, 0); 
            }

            model.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });

            model.userData = { 
                type: 'model', name: item.name, path: fullPath, baseScale: s, 
                isWallMounted: item.isWallMounted, isModelRoot: true 
            };
            
            scene.add(model); objects.push(model);
            limitObjectBounds(model);
            selectObject(model);
            addToHistory({ type: 'ADD', object: model }); 

        }, undefined, (err) => { console.warn(`Lỗi: ${fullPath}`); });
    } else {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x999999 }));
        mesh.position.set(0, 0.5, 0);
        mesh.userData = { type: 'basic', name: item.name, isModelRoot: true };
        scene.add(mesh); objects.push(mesh);
        limitObjectBounds(mesh);
        selectObject(mesh);
        addToHistory({ type: 'ADD', object: mesh });
    }
}

function selectObject(object) {
    if(object) {
        updatePropertiesPanel(object);
        if (transformControl.visible) {
            transformControl.attach(object);
        }
    } else {
        transformControl.detach();
        updatePropertiesPanel(null);
    }
}

// --- 5. LOGIC KÉO THẢ (DRAG) ---
renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.floating-toolbar') || !event.target.closest('canvas')) return;
    if (transformControl.dragging) return; 

    renderer.domElement.focus();
    if (event.button !== 0) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(objects, true);
    
    if (intersects.length > 0) {
        let target = intersects[0].object;
        while (target.parent && !objects.includes(target)) target = target.parent;
        
        if (objects.includes(target)) {
            if (transformControl.visible && transformControl.enabled) {
                transformControl.attach(target);
                updatePropertiesPanel(target);
                return;
            }

            isDragging = true;
            draggedObject = target;
            orbit.enabled = false; 
            
            if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
                offset.copy(intersectPoint).sub(draggedObject.position);
            }
            
            selectObject(draggedObject);
            return;
        }
    }
    
    selectObject(null);
    transformControl.detach();
    transformControl.visible = false;
    transformControl.enabled = false;
});

renderer.domElement.addEventListener('pointermove', (event) => {
    if (!isDragging || !draggedObject) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
        draggedObject.position.x = intersectPoint.x - offset.x;
        draggedObject.position.z = intersectPoint.z - offset.z;
        limitObjectBounds(draggedObject);
    }
});

renderer.domElement.addEventListener('pointerup', () => {
    if (isDragging && draggedObject) {
        limitObjectBounds(draggedObject);
        addToHistory({ type: 'TRANSFORM', object: draggedObject });
    }
    isDragging = false;
    draggedObject = null;
    orbit.enabled = true; 
});

// --- 6. PHÍM TẮT ---
window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const key = e.key.toLowerCase();

    if (key === 'delete' || key === 'backspace') {
        const obj = transformControl.object || objects.find(o => o.userData.name === document.getElementById('prop-type').innerText);
        if (obj) deleteObject(obj);
    }
    
    if (key === 'r') {
        if (transformControl.visible) {
            transformControl.detach();
            transformControl.visible = false;
            transformControl.enabled = false;
        } else {
            const objName = document.getElementById('prop-type').innerText;
            const target = objects.find(o => o.userData.name === objName);
            if (target) {
                transformControl.attach(target);
                transformControl.visible = true;
                transformControl.enabled = true;
            }
        }
    }
    
    if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); executeUndo(); }
    if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); executeRedo(); }
});

function deleteObject(obj) {
    if (!obj) return;
    addToHistory({ type: 'REMOVE', object: obj });
    scene.remove(obj);
    objects.splice(objects.indexOf(obj), 1);
    selectObject(null);
    transformControl.detach();
}

// --- HISTORY & UI ---
function addToHistory(action) { history.push(action); redoStack.length = 0; }
function executeUndo() {
    if (history.length === 0) return;
    const action = history.pop(); redoStack.push(action);
    if (action.type === 'ADD') {
        scene.remove(action.object); objects.splice(objects.indexOf(action.object), 1); selectObject(null);
    } else if (action.type === 'REMOVE') {
        scene.add(action.object); objects.push(action.object); selectObject(action.object);
    } else if (action.type === 'TRANSFORM') {
        selectObject(action.object);
    }
}
function executeRedo() { /* ... */ }

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
        btn.onclick = (e) => { e.stopPropagation(); createObjectFromConfig(item, currentRoomConfig.folder); };
        toolbar.appendChild(btn);
    });
}

function updatePropertiesPanel(object) {
    const propDetails = document.getElementById('prop-details');
    const propContent = document.getElementById('prop-content');
    if (object) {
        if(propContent) propContent.classList.add('hidden');
        if(propDetails) propDetails.classList.remove('hidden');
        document.getElementById('prop-type').innerText = object.userData.name || "Model";
        document.getElementById('prop-x').innerText = object.position.x.toFixed(2);
        document.getElementById('prop-z').innerText = object.position.z.toFixed(2);
    } else {
        if(propContent) propContent.classList.remove('hidden');
        if(propDetails) propDetails.classList.add('hidden');
    }
}

const roomSelector = document.getElementById('room-selector');
if (roomSelector) {
    roomSelector.addEventListener('change', (e) => {
        const roomKey = e.target.value;
        const roomConfig = ROOM_DATABASE[roomKey];
        if (roomConfig) {
            buildRoomShell(roomConfig);
            updateToolbar(roomKey, roomConfig.items);
            objects.forEach(obj => scene.remove(obj)); objects.length = 0;
            selectObject(null);
            transformControl.detach();
            camera.position.set(0, 20, 30);
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

// --- AUTH & UI ---
const auth = getAuth();
onAuthStateChanged(auth, async (user) => { if (user) currentUser = user; });

const btnStartNav = document.getElementById('btn-start-nav');
if(btnStartNav) btnStartNav.addEventListener('click', () => checkAuth());
const btnStartHero = document.getElementById('btn-start-hero');
if(btnStartHero) btnStartHero.addEventListener('click', () => checkAuth());

function checkAuth() {
    if(currentUser) {
        document.getElementById('homepage').classList.add('hidden');
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-ui').classList.remove('hidden');
        
        let name = currentUser.displayName || currentUser.email.split('@')[0];
        const uDisplay = document.getElementById('user-display');
        if(uDisplay) uDisplay.innerText = name;

        // Force Show Dashboard
        const welcome = document.getElementById('studio-welcome');
        if(welcome) {
            welcome.classList.remove('hidden');
            welcome.style.opacity = '1';
            welcome.style.visibility = 'visible';
        }
    } else {
        document.getElementById('homepage').classList.remove('hidden');
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('main-ui').classList.add('hidden');
    }
}

const submitBtn = document.getElementById('btn-submit');
if(submitBtn) submitBtn.addEventListener('click', async () => {
    const email = document.getElementById('email-input').value.trim();
    const pass = document.getElementById('pass-input').value;
    try { await loginWithEmail(email.includes('@')?email:email+"@dream.app", pass==="123"?"123123":pass); checkAuth(); } catch(e) { alert(e.message); }
});
const btnGoogle = document.getElementById('btn-google');
if(btnGoogle) btnGoogle.addEventListener('click', async () => { await loginWithGoogle(); checkAuth(); });
const btnLogout = document.getElementById('btn-logout');
if(btnLogout) btnLogout.addEventListener('click', () => { logoutUser(); window.location.reload(); });

const modalOverlay = document.getElementById('modal-overlay');
function toggleModal(show) { if(show) { if(modalOverlay) { modalOverlay.classList.remove('hidden'); modalOverlay.style.display = 'flex'; } } else { if(modalOverlay) modalOverlay.classList.add('hidden'); } }
const closeModalBtn = document.getElementById('modal-close');
if(closeModalBtn) closeModalBtn.addEventListener('click', () => toggleModal(false));

const btnSave = document.getElementById('btn-save');
if(btnSave) btnSave.addEventListener('click', () => {
    if (!currentUser) return alert("Đăng nhập để lưu!");
    const name = prompt("Tên bản lưu:", "Design " + new Date().toLocaleDateString());
    if(name) {
        const data = objects.map(o => ({
            type: o.userData.type, name: o.userData.name, path: o.userData.path,
            baseScale: o.userData.baseScale, position: o.position, rotation: o.rotation, scale: o.scale,
            isWallMounted: o.userData.isWallMounted
        }));
        saveDesignToCloud(currentUser.uid, data); alert("Đã lưu!");
    }
});
const btnLoad = document.getElementById('btn-load');
if(btnLoad) btnLoad.addEventListener('click', async () => {
    if(!currentUser) return alert("Đăng nhập để tải!");
    toggleModal(true);
    const list = document.getElementById('save-list');
    list.innerHTML = 'Đang tải...';
    const data = await loadDesignFromCloud(currentUser.uid);
    list.innerHTML = '';
    if(data) {
        const div = document.createElement('div');
        div.className = 'save-item';
        div.innerHTML = `<div><div class="save-name">Bản lưu mới nhất</div></div><i class="fa-solid fa-cloud-arrow-down"></i>`;
        div.onclick = () => {
            objects.forEach(o => scene.remove(o)); objects.length=0; selectObject(null); transformControl.detach();
            data.forEach(item => {
                const folder = item.path ? item.path.substring(0, item.path.lastIndexOf('/')+1) : '';
                const fileName = item.path ? item.path.split('/').pop() : '';
                createObjectFromConfig({ fileName, scale: item.baseScale, name: item.name, type: item.type, isWallMounted: item.isWallMounted }, folder);
            });
            toggleModal(false);
            alert("Đã tải!");
        };
        list.appendChild(div);
    } else list.innerHTML = 'Chưa có bản lưu.';
});