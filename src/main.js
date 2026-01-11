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

let currentUser = null;
const objects = []; 
const history = []; 
const redoStack = [];
let roomMeshes = [];
let currentRoomConfig = null;
let isDragging = false;
let draggedObject = null;
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const intersectPoint = new THREE.Vector3();
const offset = new THREE.Vector3();

// *** HÀM CHỌN PHÒNG ***
window.selectRoomFromDashboard = (roomKey) => {
    const selector = document.getElementById('room-selector');
    const welcomeScreen = document.getElementById('studio-welcome');
    
    if(selector) {
        selector.value = roomKey;
        selector.dispatchEvent(new Event('change'));
    }

    if(welcomeScreen) {
        welcomeScreen.style.opacity = '0';
        setTimeout(() => {
            welcomeScreen.classList.add('hidden');
            welcomeScreen.style.display = 'none';
        }, 500);
    }
};

// --- HELPER FUNCTIONS ---
function getIcon(name) {
    if (!name || typeof name !== 'string') return 'cube';
    const n = name.toLowerCase();
    if(n.includes('chair')||n.includes('sofa')||n.includes('couch')) return 'couch';
    if(n.includes('bed')) return 'bed';
    if(n.includes('table')||n.includes('desk')) return 'table';
    if(n.includes('lamp')||n.includes('light')) return 'lightbulb';
    if(n.includes('plant')) return 'seedling';
    if(n.includes('cabinet')||n.includes('shelf')) return 'box-archive';
    if(n.includes('computer')||n.includes('tv')) return 'computer';
    if(n.includes('bath')||n.includes('toilet')) return 'bath';
    if(n.includes('fridge')||n.includes('kitchen')) return 'utensils';
    return 'cube';
}

function isWallItem(name) {
    if (!name || typeof name !== 'string') return false;
    const n = name.toLowerCase();
    return n.includes('window')||n.includes('curtain')||n.includes('blind')||n.includes('art')||n.includes('picture')||n.includes('frame')||n.includes('clock')||n.includes('wall')||n.includes('cabinet upper');
}

function getScale(name) {
    if (!name || typeof name !== 'string') return 1.2;
    const n = name.toLowerCase();
    if (n.includes('pen')||n.includes('cup')||n.includes('mouse')) return 2.0; 
    if (n.includes('bed')) return 0.015;
    return 1.2; 
}

// --- DATABASE FULL (COPY TỪ INPUT CỦA BẠN) ---
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
renderer.outputColorSpace = THREE.SRGBColorSpace; 
// Tabindex để nhận phím
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
const transformControl = new TransformControls(camera, renderer.domElement);
// Ẩn Gizmo mặc định, chỉ hiện khi bấm T/R
transformControl.visible = false; 
transformControl.enabled = false;
scene.add(transformControl);

const loader = new GLTFLoader();

// --- 2. LOGIC TẠO PHÒNG & TƯỜNG ---
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

        createWall(config.width, h, 0, h/2, -config.depth/2, 0); // Back
        createWall(config.depth, h, -config.width/2, h/2, 0, Math.PI/2); // Left
        createWall(config.depth, h, config.width/2, h/2, 0, -Math.PI/2); // Right
    }
}

// --- 3. LOGIC TẠO ĐỒ VẬT (FIX LỖI MẶT SÀN) ---
function createObjectFromConfig(item, folderPath, pos = null) {
    if (item.type === 'model' && item.fileName) {
        loader.load(folderPath + item.fileName, (gltf) => {
            const model = gltf.scene;
            
            // 1. Scale
            let s = item.scale.x || item.scale || 1.2;
            const n = item.name.toLowerCase();
            // Tinh chỉnh scale cho một số đồ đặc biệt
            if (n.includes('bed')) s = 0.015; 
            if (n.includes('cup') || n.includes('mouse') || n.includes('pen')) s = 2.0; 
            model.scale.set(s, s, s);

            // 2. Tính toán Bounding Box để căn chỉnh
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            const center = new THREE.Vector3();
            box.getCenter(center);

            // 3. Xử lý vị trí Y (Độ cao)
            let finalY = 0;

            if (item.isWallMounted) {
                // Logic cho đồ gắn tường
                if (n.includes('ceiling') || n.includes('fan')) {
                    // Đồ trần nhà (Quạt trần, đèn trần) -> Gắn sát trần (ví dụ trần cao 6m)
                    finalY = 6 - (box.max.y - center.y); 
                } else if (n.includes('window') || n.includes('curtain')) {
                    // Cửa sổ, rèm -> Giữa tường (tầm 2.5m - 3m)
                    finalY = 2.5;
                } else if (n.includes('painting') || n.includes('picture') || n.includes('art')) {
                    // Tranh ảnh -> Tầm mắt (1.5m - 1.8m)
                    finalY = 1.8;
                } else if (n.includes('ac') || n.includes('air conditioner')) {
                    // Điều hòa -> Gần trần (5m)
                    finalY = 5.0;
                } else {
                    // Mặc định cho đồ tường khác (đèn tường, đồng hồ)
                    finalY = 2.0;
                }
                
                // Đẩy vật thể ra sát tường (Z = -depth/2)
                // Lưu ý: Cần xoay vật thể để mặt trước hướng ra ngoài nếu cần
                model.position.z = -currentRoomConfig.depth / 2 + size.z / 2; 

            } else {
                // Logic cho đồ đặt sàn (Fix lỗi chìm/nổi)
                // Tính khoảng cách từ tâm object xuống đáy object
                const yOffset = center.y - box.min.y;
                finalY = yOffset; // Đặt đáy object trùng với mặt sàn (y=0)
            }

            // 4. Áp dụng vị trí cuối cùng
            if (pos) {
                // Nếu load từ file save hoặc có vị trí chỉ định
                model.position.set(pos.x, pos.y, pos.z); 
            } else {
                // Vị trí mặc định khi mới spawn
                model.position.set(0, finalY, item.isWallMounted ? (-currentRoomConfig.depth/2 + 0.2) : 0);
            }

            // 5. Shadow & UserData
            model.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
            
            model.userData = { 
                type: 'model', 
                name: item.name, 
                fileName: item.fileName, 
                folder: folderPath,      
                path: folderPath + item.fileName, 
                isWallMounted: item.isWallMounted 
            };

            scene.add(model); objects.push(model); limitObjectBounds(model); 
            if(!pos) selectObject(model); 
            addToHistory({ type: 'ADD', object: model });

        }, undefined, (e) => console.warn(e));
    }
}

// --- 4. HỆ THỐNG TƯƠNG TÁC: DRAG & GIZMO ---

function selectObject(object) {
    if(object) {
        transformControl.attach(object);
        updatePropertiesPanel(object);
    } else {
        transformControl.detach();
        updatePropertiesPanel(null);
    }
}

// --- SỰ KIỆN CHUỘT (DRAG LOGIC MỚI) ---
renderer.domElement.addEventListener('pointerdown', (event) => {
    // Bỏ qua nếu bấm vào Gizmo (trục tọa độ)
    if (event.target.closest('.floating-toolbar') || !event.target.closest('canvas')) return;
    
    renderer.domElement.focus();
    if (event.button !== 0) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(objects, true);
    
    if (intersects.length > 0) {
        let target = intersects[0].object;
        // Tìm object gốc
        while (target.parent && !objects.includes(target)) target = target.parent;
        
        if (objects.includes(target)) {
            // BẮT ĐẦU KÉO
            isDragging = true;
            draggedObject = target;
            orbit.enabled = false; // Tắt xoay cam
            
            // Tính toán điểm chạm trên mặt phẳng sàn ảo
            if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
                offset.copy(intersectPoint).sub(draggedObject.position);
            }
            
            selectObject(draggedObject);
            // Ẩn Gizmo khi đang kéo tay để đỡ vướng, trừ khi đang ở chế độ xoay
            if(transformControl.getMode() === 'translate') transformControl.visible = false;
            
            return;
        }
    }
    
    // Nếu bấm ra ngoài -> Bỏ chọn
    selectObject(null);
    transformControl.visible = false;
    transformControl.enabled = false;
});

renderer.domElement.addEventListener('pointermove', (event) => {
    if (!isDragging || !draggedObject) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
        // Di chuyển object theo chuột (chỉ X và Z, giữ nguyên Y)
        draggedObject.position.x = intersectPoint.x - offset.x;
        draggedObject.position.z = intersectPoint.z - offset.z;
    }
});

renderer.domElement.addEventListener('pointerup', () => {
    if (isDragging && draggedObject) {
        addToHistory({ // Lưu lịch sử sau khi kéo xong
            type: 'TRANSFORM', object: draggedObject,
            oldPos: draggedObject.position.clone(), oldRot: draggedObject.rotation.clone(), oldScale: draggedObject.scale.clone(),
            newPos: draggedObject.position.clone(), newRot: draggedObject.rotation.clone(), newScale: draggedObject.scale.clone()
        });
    }
    isDragging = false;
    draggedObject = null;
    orbit.enabled = true; // Bật lại xoay cam
    
    // Nếu đang chọn vật, hiện lại Gizmo (nếu đã bật T/R)
    if (transformControl.object && transformControl.enabled) {
        transformControl.visible = true;
    }
});

// --- PHÍM TẮT ---
window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const key = e.key.toLowerCase();

    if (transformControl.object) {
        if (key === 'delete' || key === 'backspace') deleteObject(transformControl.object);
        
        if (key === 't') {
            transformControl.setMode('translate');
            transformControl.enabled = true;
            transformControl.visible = true;
        }
        if (key === 'r') {
            transformControl.setMode('rotate');
            transformControl.enabled = true;
            transformControl.visible = true;
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
}

// --- 4. HISTORY SYSTEM ---
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

// --- INIT ---
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
            selectObject(null);
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

// --- AUTH & UI ---
const auth = getAuth();
const homepage = document.getElementById('homepage');
const loginOverlay = document.getElementById('login-overlay');
const mainUi = document.getElementById('main-ui');
const modalOverlay = document.getElementById('modal-overlay');


onAuthStateChanged(auth, (user) => { 
    currentUser = user; 
    if (!user) showHomepage();
    // Nếu có user, code ở nút bấm sẽ gọi showMainApp
});

function showHomepage() {
    document.getElementById('homepage').classList.remove('hidden');
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('main-ui').classList.add('hidden');
    document.getElementById('intro-splash').classList.add('hidden'); // Đảm bảo ẩn intro
}

function showMainApp(user) {
    document.getElementById('homepage').classList.add('hidden');
    document.getElementById('login-overlay').classList.add('hidden');
    
    // Cập nhật tên user an toàn (fix lỗi null)
    const nameEl = document.getElementById('intro-name');
    if (nameEl) nameEl.innerText = user.displayName || user.email.split('@')[0];
    
    const uDisplay = document.getElementById('user-display'); 
    if (uDisplay) uDisplay.innerText = user.displayName || user.email.split('@')[0];

    // 1. Hiện Intro
    const intro = document.getElementById('intro-splash');
    intro.classList.remove('hidden');
    intro.style.display = 'flex';
    intro.style.opacity = '1';

    // 2. Load nhẹ phòng khách để làm nền
    const selector = document.getElementById('room-selector');
    if(selector && selector.value === "") { 
        selector.value = 'livingroom'; 
        selector.dispatchEvent(new Event('change')); 
    }

    // 3. Hiện Main UI (chứa dashboard) nhưng ẩn dưới intro
    const mainUI = document.getElementById('main-ui');
    mainUI.classList.remove('hidden');
    
    const dashboard = document.getElementById('studio-welcome');
    dashboard.classList.remove('hidden');
    dashboard.style.display = 'flex';
    dashboard.style.opacity = '1';

    // 4. Chuyển cảnh sau 2s
    setTimeout(() => {
        intro.style.opacity = '0';
        setTimeout(() => {
            intro.classList.add('hidden');
            intro.style.display = 'none';
        }, 800);
    }, 2000);
}

onAuthStateChanged(auth, async (user) => { if (user) currentUser = user; });
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

// Nút Login & Start 
const btnStartNav = document.getElementById('btn-start-nav');
if(btnStartNav) btnStartNav.addEventListener('click', () => checkAuth());
const btnStartHero = document.getElementById('btn-start-hero');
if(btnStartHero) btnStartHero.addEventListener('click', () => checkAuth());
let isRegisterMode = false; // Biến theo dõi chế độ

// 1. Xử lý nút chuyển đổi Đăng nhập / Đăng ký
const toggleBtn = document.getElementById('toggle-mode');
const formTitle = document.getElementById('form-title');
const submitBtnLabel = document.getElementById('btn-submit');

if(toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode; // Đảo ngược trạng thái
        
        if(isRegisterMode) {
            // Chuyển sang giao diện Đăng Ký
            formTitle.innerText = "Tạo tài khoản";
            submitBtnLabel.innerText = "Đăng ký";
            toggleBtn.innerText = "Đã có tài khoản? Đăng nhập";
        } else {
            // Quay về giao diện Đăng Nhập
            formTitle.innerText = "Đăng nhập";
            submitBtnLabel.innerText = "Vào Studio";
            toggleBtn.innerText = "Chưa có tài khoản? Đăng ký ngay";
        }
    });
}

function checkAuth() {
    if(currentUser) {
        document.getElementById('homepage').classList.add('hidden');
        document.getElementById('main-ui').classList.remove('hidden');
        document.getElementById('user-display').innerText = currentUser.displayName || currentUser.email.split('@')[0];
    } else {
        document.getElementById('homepage').classList.add('hidden');
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('login-overlay').style.display = 'flex';
    }
}

const submitBtn = document.getElementById('btn-submit');
if(submitBtn) {
    submitBtn.onclick = async () => {
        const email = document.getElementById('email-input').value.trim();
        const pass = document.getElementById('pass-input').value;
        
        if(!email || !pass) return alert("Vui lòng nhập đầy đủ thông tin!");

        // Hack nhẹ: Nếu người dùng nhập tên thay vì email (vd: "admin"), tự động thêm đuôi email giả
        const fakeEmail = email.includes('@') ? email : email + "@dream.app";
        const fakePass = pass === "123" ? "123123" : pass; // Hack pass 123 cho nhanh

        try {
            let user;
            if(isRegisterMode) {
                // Gọi hàm Đăng Ký từ firebase-config
                user = await registerWithEmail(fakeEmail, fakePass);
                alert("Đăng ký thành công! Đang đăng nhập...");
            } else {
                // Gọi hàm Đăng Nhập
                user = await loginWithEmail(fakeEmail, fakePass);
            }
            
            if(user) showMainApp(user);
            
        } catch(e) {
            // Việt hóa thông báo lỗi phổ biến
            let msg = e.message;
            if(msg.includes("email-already-in-use")) msg = "Tên tài khoản/Email này đã có người dùng.";
            if(msg.includes("weak-password")) msg = "Mật khẩu quá yếu (cần ít nhất 6 ký tự).";
            if(msg.includes("user-not-found") || msg.includes("invalid-credential")) msg = "Sai tài khoản hoặc mật khẩu.";
            alert("Lỗi: " + msg);
        }
    };
}

const btnGoogle = document.getElementById('btn-google');
if(btnGoogle) btnGoogle.addEventListener('click', async () => { await loginWithGoogle(); checkAuth(); });
const btnLogout = document.getElementById('btn-logout');
if(btnLogout) btnLogout.addEventListener('click', () => { logoutUser(); window.location.reload(); });

function toggleModal(show) {
    if(show) { if(modalOverlay) { modalOverlay.classList.remove('hidden'); modalOverlay.style.display = 'flex'; } }
    else { if(modalOverlay) modalOverlay.classList.add('hidden'); }
}
const closeModalBtn = document.getElementById('modal-close');
if(closeModalBtn) closeModalBtn.addEventListener('click', () => toggleModal(false));