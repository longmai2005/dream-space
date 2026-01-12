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
let currentRoomConfig = null;

let isDragging = false;
let draggedObject = null;
let dragStartTransform = null; 
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const intersectPoint = new THREE.Vector3();
const offset = new THREE.Vector3();
let isRegisterMode = false;

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
    if(n.includes('chair') || n.includes('sofa') || n.includes('couch') || n.includes('bench') || n.includes('lounge')) return 'couch';
    if(n.includes('bed')) return 'bed';
    if(n.includes('table') || n.includes('desk') || n.includes('countertop')) return 'table';
    if(n.includes('lamp') || n.includes('light')) return 'lightbulb';
    if(n.includes('plant') || n.includes('houseplant')) return 'seedling';
    if(n.includes('cabinet') || n.includes('shelf') || n.includes('wardrobe') || n.includes('bookcase') || n.includes('dresser')) return 'box-archive';
    if(n.includes('computer') || n.includes('tv') || n.includes('monitor') || n.includes('laptop')) return 'computer';
    if(n.includes('bath') || n.includes('toilet') || n.includes('sink') || n.includes('shower')) return 'bath';
    if(n.includes('fridge') || n.includes('stove') || n.includes('kitchen') || n.includes('pot') || n.includes('pan') || n.includes('kettle')) return 'utensils';
    if(n.includes('window') || n.includes('curtain') || n.includes('blinds')) return 'border-all';
    if(n.includes('rug') || n.includes('mat')) return 'rug';
    if(n.includes('clock')) return 'clock';
    if(n.includes('speaker') || n.includes('radio')) return 'volume-high';
    return 'cube';
}

function isWallItem(name) {
    if (!name || typeof name !== 'string') return false;
    const n = name.toLowerCase();
    return n.includes('window') || n.includes('curtain') || n.includes('blind') || 
           n.includes('art') || n.includes('picture') || n.includes('frame') || 
           n.includes('clock') || n.includes('wall') || n.includes('switch') || 
           n.includes('ac') || n.includes('fan') || n.includes('ceiling') || n.includes('vent');
}

// --- DATABASE NỘI THẤT ---
const ROOM_DATABASE = {
    livingroom: {
        name: "Phòng Khách", width: 20, depth: 15, floorColor: 0x8d6e63, wallColor: 0xeeeeee, folder: '/models/livingroom/',
        defaults: ["Couch Large.glb", "Round Table.glb", "Lamp Floor.glb"],
        items: [
            "Bed Bunk.glb", "Bed Double.glb", "Bed Single.glb", "Bench Cushion Low.glb", "Bench Cushion.glb", "Bench.glb", 
            "Bookcase Closed Doors.glb", "Bookcase Closed Wide.glb", "Bookcase Closed.glb", "Bookcase Open Low.glb", "Bookcase Open.glb", "Books.glb", 
            "Cabinet Bed Drawer Tabl.glb", "Cabinet Bed Drawer.glb", "Cabinet Bed.glb", "Cabinet Television Doo.glb", "Cabinet Television.glb", 
            "Cardboard Box Closed.glb", "Cardboard Box Open.glb", "Ceiling Fan.glb", "Chair Cushion.glb", "Chair Desk.glb", 
            "Chair Modern Cushion.glb", "Chair Modern Frame Cush.glb", "Chair Rounded.glb", "Chair.glb", "Coat Rack Standing.glb", "Coat Rack.glb", 
            "Computer Keyboard.glb", "Computer Screen.glb", "Couch Large.glb", "Couch Medium.glb", "Couch Small.glb", "Desk Corner.glb", "Desk.glb", 
            "Doorway Front.glb", "Doorway Open.glb", "Doorway.glb", "Dryer.glb", "L Couch.glb", "Lamp Round Floor.glb", "Lamp Round Table.glb", 
            "Lamp Square Ceiling.glb", "Lamp Square Floor.glb", "Lamp Square Table.glb", "Lamp Wall.glb", "Laptop.glb", "Living Room 2.glb", "Living Room.glb", 
            "Lounge Chair.glb", "Lounge Chair-PImRvMqW1O.glb", "Lounge Design Chair.glb", "Lounge Design Sofa Corn.glb", "Lounge Design Sofa.glb", 
            "Lounge Sofa Corner.glb", "Lounge Sofa Long.glb", "Lounge Sofa Ottoman.glb", "Lounge Sofa.glb", "Paneling.glb", "Plant Small.glb", "Potted Plant.glb", 
            "Radio.glb", "Round Table.glb", "Rug Doormat.glb", "Rug Rectangle.glb", "Rug Round.glb", "Rug Rounded.glb", "Rug Square.glb", "Shower Round.glb", 
            "Side Table Drawers.glb", "Side Table.glb", "Speaker Small.glb", "Speaker.glb"
        ].map(f => ({ fileName: f, name: f.replace('.glb',''), type: 'model', icon: getIcon(f), isWallMounted: isWallItem(f) }))
    },
    bedroom: {
        name: "Phòng Ngủ", width: 18, depth: 14, floorColor: 0xe0e0e0, wallColor: 0xffccbc, folder: '/models/bedroom/',
        defaults: ["Bed Double.glb", "Night Stand.glb", "Large Wardrobe.glb"],
        items: [
            "Bed Double.glb", "Bedroom.glb", "Bunk Bed.glb", "Cabinet Bed Drawer.glb", "Ceiling Lamp.glb", "Dresser.glb", "Dumbell.glb", 
            "Floating Shelf.glb", "Floor Lamp.glb", "Football.glb", "Glass Cup.glb", "Guitar.glb", "L Shaped Desk.glb", "Lamp Round Floor.glb", 
            "Lamp Round Table.glb", "Lamp Square Ceiling.glb", "Lamp Square Floor.glb", "Lamp Square Table.glb", "Lamp Wall.glb", "Large Book Shelf.glb", 
            "Large Wardrobe.glb", "Lingerie Dresser.glb", "Monitor.glb", "Night Stand.glb", "Painting Canvas.glb", "Pencil.glb", "Plastic Cup.glb", 
            "Plate.glb", "Small Wardrobe.glb", "Tv.glb", "Wooden Arm Chair.glb", "Wooden Chair.glb"
        ].map(f => ({ fileName: f, name: f.replace('.glb',''), type: 'model', icon: getIcon(f), isWallMounted: isWallItem(f) }))
    },
    kitchen: {
        name: "Nhà Bếp", width: 16, depth: 12, floorColor: 0x616161, wallColor: 0xb2dfdb, folder: '/models/kitchen/',
        defaults: ["Kitchen Fridge.glb", "Kitchen Stove.glb", "Kitchen Cabinet.glb"],
        items: [
            "Blue Mug.glb", "Container Kitchen A.glb", "Container Kitchen A-RmXOsLpzXc.glb", "Container Kitchen A-qlI5D097uW.glb", 
            "Container Kitchen B.glb", "Container Kitchen B-EKO6vOLQZd.glb", "Container Kitchen B-RYYfoJovT9.glb", "Countertop Corner.glb", 
            "Countertop Counter O.glb", "Countertop Single.glb", "Countertop Sink.glb", "Countertop Straight.glb", "Countertop Straight-LXwzLcN9XM.glb", 
            "Countertop Straight-ipDw2lbUn2.glb", "Cutting Board.glb", "Dishrack Plates.glb", "Dishrack.glb", "Extractor Hood.glb", "Floor Tiles Kitchen.glb", 
            "Fridge.glb", "Kettle.glb", "Kitchen Bar.glb", "Kitchen Blender.glb", "Kitchen Blinds.glb", "Kitchen Cabinet Corner.glb", 
            "Kitchen Cabinet Corner-t2IJurty30.glb", "Kitchen Cabinet Drawer.glb", "Kitchen Cabinet Upper.glb", "Kitchen Cabinet Upperc.glb", 
            "Kitchen Cabinet Upperl.glb", "Kitchen Cabinet.glb", "Kitchen Cabinet-jRPnkxtk8s.glb", "Kitchen Coffee Machine.glb", "Kitchen Fridge Built In.glb", 
            "Kitchen Fridge Large.glb", "Kitchen Fridge Small.glb", "Kitchen Fridge.glb", "Kitchen Hood Large.glb", "Kitchen Knife.glb", "Kitchen Microwave.glb", 
            "Kitchen Sink.glb", "Kitchen Stove Electric.glb", "Kitchen Stove Hood.glb", "Kitchen Stove.glb", "Lamp Round Floor.glb", "Lamp Round Table.glb", 
            "Lamp Square Ceiling.glb", "Lamp Square Floor.glb", "Lamp Square Table.glb", "Lamp Wall.glb", "Lid.glb", "Mug Yellow.glb", "Oven Glove.glb", 
            "Pan.glb", "Papertowel Holder.glb", "Plate.glb", "Pot.glb", "Red Mug.glb", "Spatula.glb", "Spoon.glb", "Stove.glb", "Toaster.glb", "Utensils Cup.glb", 
            "Wall Cabinet Corner.glb", "Wall Cabinet Single.glb", "Wall Cabinet Single-TPEJeA6HQM.glb", "Wall Cabinet Straight.glb", "Wall Knife Rack.glb", 
            "Wall Papertowel.glb", "Wall Plain Kitchen.glb", "Wall Plain Kitchen-Sgh2HG9ERM.glb", "Wall Plain Kitchen-o2tecBL394.glb", 
            "Wall Plain Kitchen-reQyVpOQW3.glb", "Wall Shelf Kitchen.glb", "Wall Shelf Kitchen H.glb", "Wall Shelf Kitchen-j8D5pqHUKm.glb", 
            "Wall Shelf Kitchen-l0Or3HvwJR.glb", "Wall Tiles Kitchen.glb", "Wall Tiles Kitchen W.glb", "Wall Tiles Kitchen-kmZKEPYWVf.glb", 
            "Wall Tiles Kitchen-uYl2trxmns.glb", "Wall Tiles Kitchen-ypup5Vp53J.glb"
        ].map(f => ({ fileName: f, name: f.replace('.glb',''), type: 'model', icon: getIcon(f), isWallMounted: isWallItem(f) }))
    },
    bathroom: {
        name: "Phòng Tắm", width: 10, depth: 10, floorColor: 0xffffff, wallColor: 0x81d4fa, folder: '/models/bathroom/',
        defaults: ["Bathtub.glb", "Toilet.glb", "Bathroom Mirror.glb"],
        items: [
            "Bath.glb", "Bathroom Cabinet.glb", "Bathroom Cabinet Drawe.glb", "Bathroom Mirror.glb", "Bathroom Sink Square.glb", "Bathroom Sink.glb", 
            "Bathtub.glb", "Cabinet Bathroom.glb", "Candle.glb", "Container Bathroom A.glb", "Container Bathroom A-II0VEKf1mK.glb", 
            "Container Bathroom A-xddz7Cu53w.glb", "Container Bathroom B.glb", "Container Bathroom B-U6R9p9WkD4.glb", "Container Bathroom B-zUJlMOTIFt.glb", 
            "Container Bathroom C.glb", "Container Bathroom C-0kR8QSr5eU.glb", "Container Bathroom C-QBzD2oKe9c.glb", "Container Bathroom D.glb", 
            "Container Bathroom D-8HoMtrtGcl.glb", "Container Bathroom D-S4MytAYJb9.glb", "Ducky.glb", "Floor Tiled.glb", "Mat.glb", "Mirror.glb", "Plant.glb", 
            "Slippers.glb", "Toothbrush Blue.glb", "Toothbrush Cup Decor.glb", "Toothbrush Cup.glb", "Toothbrush Pink.glb", "Towel Blue.glb", "Towel Pink.glb", 
            "Towel Stacked.glb", "Towel Yellow.glb", "Wall Shelf.glb", "Wall Tiled Corner In.glb", "Wall Tiled Corner Ou.glb", "Wall Tiled Doorway.glb", 
            "Wall Tiled Straight.glb", "Wall Tiled Window.glb"
        ].map(f => ({ fileName: f, name: f.replace('.glb',''), type: 'model', icon: getIcon(f), isWallMounted: isWallItem(f) }))
    },
    officeroom: {
        name: "Văn Phòng", width: 18, depth: 14, floorColor: 0x455a64, wallColor: 0xcfd8dc, folder: '/models/officeroom/',
        defaults: ["Adjustable Desk.glb", "Office Chair.glb", "Computer.glb"],
        items: [
            "Adjustable Desk.glb", "Air Vent.glb", "Analog clock.glb", "Bathroom Sink.glb", "Bathroom Toilet Paper.glb", "Binder.glb", "Bins.glb", 
            "Blank Picture Frame.glb", "Book Stack.glb", "Briefcase.glb", "Cabinet Bed Drawer Tabl.glb", "Cabinet.glb", "Calendar.glb", 
            "Calendar-8GqQAqxi3qk.glb", "Cardboard Box.glb", "Cardboard Boxes.glb", "Cardboard Boxes-pMdXdrUHvX.glb", "CCTV Camera.glb", "Ceiling Fan.glb", 
            "Ceiling Light.glb", "Chair.glb", "Chair-1MFMOaz3zqe.glb", "clipboard.glb", "Coat rack.glb", "Coffee Table.glb", "Coffee cup.glb", 
            "Computer Screen.glb", "Computer mouse.glb", "Computer.glb", "Couch Medium.glb", "Couch Small.glb", "Couch Small-ZOPP3KzNIk.glb", 
            "Couch _ Wide.glb", "Crushed Soda Can.glb", "Cup.glb", "Curtains Double.glb", "Cushions.glb", "Dartboard.glb", "Darts.glb", "Desk Toy.glb", 
            "Desk.glb", "Desk-7ban171PzCS.glb", "Desk-EtJlOllzbf.glb", "Desk-ISpMh81QGq.glb", "Desk-V86Go2rlnq.glb", "Doorway Front.glb", "Doorway.glb", 
            "Dual Monitors on sit-stand arm.glb", "Electrical outlet.glb", "File Cabinet.glb", "Fire Exit Sign.glb", "Fire Exit Sign-0ywPpb36cyK.glb", 
            "Fire Extinguisher.glb", "Houseplant.glb", "Houseplant-VtJh4Irl4w.glb", "Houseplant-bfLOqIV5uP.glb", "Houseplant-e9oRt-Ct6js.glb", "Keyboard.glb", 
            "Keyboard-fOy2zvPJAj-.glb", "Ladder.glb", "Lamp.glb", "Laptop bag.glb", "Light Cube.glb", "Light Desk.glb", "Light Floor.glb", 
            "Light Icosahedron.glb", "Light Switch.glb", "Magazine.glb", "Manhole cover.glb", "Medium Book Shelf.glb", "Message board.glb", "Monitor.glb", 
            "Mouse.glb", "Mousepad.glb", "MS Gundam RX-78-2 with weapons.glb", "Mug With Office Tool.glb", "Mug.glb", "Night Stand.glb", "Notebook.glb", 
            "Office Chair.glb", "Office Phone.glb", "Pens.glb", "Phone.glb", "Phone-1L9oJAw6nY2.glb", "Plant - White Pot.glb", "Polaroids.glb", 
            "Potted Plant.glb", "Printer.glb", "Rubik's cube.glb", "Rug Round.glb", "Rug.glb", "Shelf Small.glb", "Shelf.glb", "Skateboard.glb", 
            "Small Stack of Paper.glb", "Soda Can.glb", "Soda.glb", "Standing Desk.glb", "Stapler.glb", "Sticky Notes.glb", "Table Large Circular.glb", 
            "Table Tennis Paddle.glb", "Table tennis table.glb", "Table.glb", "Tissue Box.glb", "Toilet Paper stack.glb", "Toilet.glb", "Towel Rack.glb", 
            "Trash Bin.glb", "Trashcan Small.glb", "Trashcan.glb", "Trophy.glb", "Various Stacks of Paper.glb", "Vending Machine.glb", "Wall Art 02.glb", 
            "Wall Art 03.glb", "Wall Art 05.glb", "Wall Art 06.glb", "Wall Art 06-1U5roiXQZAM.glb", "Wall Shelf.glb", "Water Cooler.glb", "Webcam.glb", 
            "Whiteboard.glb", "Window Blinds.glb"
        ].map(f => ({ fileName: f, name: f.replace('.glb',''), type: 'model', icon: getIcon(f), isWallMounted: isWallItem(f) }))
    },
    empty: {
        name: "Sân Khấu", width: 30, depth: 30, floorColor: 0x222222, wallColor: null, folder: '',
        items: [{ name: "Khối Vuông", icon: "cube", type: 'box', color: 0xaaaaaa, scale: {x:1, y:1, z:1} }]
    }
};

for (let key in ROOM_DATABASE) {
    if (ROOM_DATABASE[key].items) {
        ROOM_DATABASE[key].items = ROOM_DATABASE[key].items.map(item => {
            if (typeof item === 'string') {
                return { fileName: item, name: item.replace('.glb',''), type: 'model', icon: getIcon(item), isWallMounted: isWallItem(item) };
            }
            return item;
        });
    }
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 30); 

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.domElement.setAttribute('tabindex', '1'); 
renderer.domElement.style.outline = 'none';

const container = document.getElementById('canvas-container');
if(container) { container.innerHTML = ''; container.appendChild(renderer.domElement); }

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048); 
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const orbit = new OrbitControls(camera, renderer.domElement);
const transformControl = new TransformControls(camera, renderer.domElement);
transformControl.visible = false; transformControl.enabled = false;
transformControl.addEventListener('dragging-changed', (e) => orbit.enabled = !e.value);
scene.add(transformControl);

const loader = new GLTFLoader();

// --- 2. HÀM GIỚI HẠN DI CHUYỂN (CHỐNG XUYÊN TƯỜNG) ---
function limitObjectBounds(obj) {
    if (!currentRoomConfig) return;

    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);

    const halfRoomW = currentRoomConfig.width / 2;
    const halfRoomD = currentRoomConfig.depth / 2;
    
    const padding = 0.1;
    const limitX = halfRoomW - (size.x / 2) - padding;
    const limitZ = halfRoomD - (size.z / 2) - padding;

    if (obj.position.x > limitX) obj.position.x = limitX;
    if (obj.position.x < -limitX) obj.position.x = -limitX;

    if (!obj.userData.isWallMounted) {
        if (obj.position.z > limitZ) obj.position.z = limitZ;
        if (obj.position.z < -limitZ) obj.position.z = -limitZ;
    }
}

function buildRoomShell(config) {
    currentRoomConfig = config;
    const toRemove = [];
    scene.traverse(child => {
        if (child.userData.isShell) toRemove.push(child);
    });
    toRemove.forEach(c => scene.remove(c));

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(config.width, config.depth), new THREE.MeshStandardMaterial({ color: config.floorColor }));
    floor.rotation.x = -Math.PI / 2; 
    floor.receiveShadow = true;
    floor.userData.isShell = true; 
    scene.add(floor);

    if (config.wallColor) {
        const h = 6; 
        const wallMat = new THREE.MeshStandardMaterial({ color: config.wallColor, side: THREE.DoubleSide });
        const createWall = (w, h, x, y, z, ry) => {
            const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
            wall.position.set(x, y, z);
            if(ry) wall.rotation.y = ry;
            wall.receiveShadow = true;
            wall.userData.isShell = true;
            scene.add(wall);
        };
        createWall(config.width, h, 0, h/2, -config.depth/2, 0); 
        createWall(config.depth, h, -config.width/2, h/2, 0, Math.PI/2); 
        createWall(config.depth, h, config.width/2, h/2, 0, -Math.PI/2); 
    }
}

function createObjectFromConfig(item, folderPath, pos = null) {
    if (item.type === 'model' && item.fileName) {
        loader.load(folderPath + item.fileName, (gltf) => {
            const model = gltf.scene;
            
            let s = 1.2;
            if (item.scale) {
                s = typeof item.scale === 'object' ? (item.scale.x || 1.2) : item.scale;
            }
            
            const n = item.name.toLowerCase();
            if (n.includes('bed')) s = 0.015;
            if (n.includes('cup') || n.includes('pen')) s = 2.0;
            model.scale.set(s, s, s);

            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            box.getCenter(center);
            
            const yShift = -box.min.y;
            
            model.traverse(child => {
                if (child.isMesh) {
                    child.position.y += yShift; 
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            if (pos) {
                model.position.set(pos.x, pos.y, pos.z);
            } else {
                if (item.isWallMounted) {
                    let wallY = 2.0;
                    if (n.includes('window')) wallY = 2.5;
                    if (n.includes('pic') || n.includes('art')) wallY = 1.8;
                    if (n.includes('fan') || n.includes('ceiling')) wallY = 5.0; 
                    
                    const newBox = new THREE.Box3().setFromObject(model);
                    const sizeZ = newBox.max.z - newBox.min.z;
                    
                    model.position.set(0, wallY, -currentRoomConfig.depth/2 + sizeZ/2);
                } else {
                    model.position.set(0, 0, 0); 
                }
            }

            model.userData = { 
                type: 'model', name: item.name, fileName: item.fileName, 
                folder: folderPath, isWallMounted: item.isWallMounted 
            };

            scene.add(model); objects.push(model);
            limitObjectBounds(model); 
            if(!pos) selectObject(model);
            addToHistory({ type: 'ADD', object: model });

        }, undefined, (err) => console.warn(err));
    }
}

renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.floating-toolbar')) return;
    renderer.domElement.focus();
    if (e.button !== 0) return; 

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(objects, true);
    if (intersects.length > 0) {
        let target = intersects[0].object;
        while (target.parent && !objects.includes(target)) target = target.parent;
        
        if (objects.includes(target)) {
            isDragging = true;
            draggedObject = target;
            orbit.enabled = false;
            
            if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
                offset.copy(intersectPoint).sub(draggedObject.position);
            }
            selectObject(draggedObject);
            transformControl.visible = false; 
            return;
        }
    }
    selectObject(null);
    transformControl.visible = false;
});

renderer.domElement.addEventListener('pointermove', (e) => {
    if (!isDragging || !draggedObject) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
        draggedObject.position.x = intersectPoint.x - offset.x;
        
        if (!draggedObject.userData.isWallMounted) {
            draggedObject.position.z = intersectPoint.z - offset.z;
        }

        limitObjectBounds(draggedObject);
    }
});

renderer.domElement.addEventListener('pointerup', () => {
    if(isDragging && draggedObject) {
        limitObjectBounds(draggedObject);
        addToHistory({ 
            type: 'TRANSFORM', 
            object: draggedObject,
            oldPos: dragStartTransform ? dragStartTransform.pos : draggedObject.position.clone(),
            newPos: draggedObject.position.clone() 
        });
    }
    isDragging = false; 
    draggedObject = null;
    orbit.enabled = true;
    if(transformControl.object) transformControl.visible = true;
});

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
    const index = objects.indexOf(obj);
    if (index > -1) {
        addToHistory({ type: 'REMOVE', object: obj });
        scene.remove(obj);
        objects.splice(index, 1); 
        selectObject(null);
        console.log("Đã xóa vật thể");
    }
}

transformControl.addEventListener('dragging-changed', (event) => {
    orbit.enabled = !event.value;
    if (event.value) { 
        if(transformControl.object) {
            dragStartTransform = {
                pos: transformControl.object.position.clone(),
                rot: transformControl.object.rotation.clone(),
                scale: transformControl.object.scale.clone()
            };
        }
    } else { 
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
    if (user) {
        const uDisplay = document.getElementById('user-display');
        if (uDisplay) uDisplay.innerText = user.displayName || user.email.split('@')[0];
    } else {
        showHomepage();
    }
});

function showHomepage() {
    document.getElementById('homepage').classList.remove('hidden');
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('main-ui').classList.add('hidden');
    document.getElementById('intro-splash').classList.add('hidden'); 
}

function showMainApp(user) {
    document.getElementById('homepage').classList.add('hidden');
    document.getElementById('login-overlay').classList.add('hidden');
    
    const nameEl = document.getElementById('intro-name');
    if (nameEl) nameEl.innerText = user.displayName || user.email.split('@')[0];
    
    const uDisplay = document.getElementById('user-display'); 
    if (uDisplay) uDisplay.innerText = user.displayName || user.email.split('@')[0];

    const intro = document.getElementById('intro-splash');
    intro.classList.remove('hidden');
    intro.style.display = 'flex';
    intro.style.opacity = '1';

    const selector = document.getElementById('room-selector');
    if(selector && selector.value === "") { 
        selector.value = 'livingroom'; 
        selector.dispatchEvent(new Event('change')); 
    }

    const mainUI = document.getElementById('main-ui');
    mainUI.classList.remove('hidden');
    
    const dashboard = document.getElementById('studio-welcome');
    dashboard.classList.remove('hidden');
    dashboard.style.display = 'flex';
    dashboard.style.opacity = '1';

    setTimeout(() => {
        intro.style.opacity = '0';
        setTimeout(() => {
            intro.classList.add('hidden');
            intro.style.display = 'none';
        }, 800);
    }, 2000);
}


const btnSave = document.getElementById('btn-save');
if(btnSave) btnSave.addEventListener('click', () => {
    if (!currentUser) return alert("Đăng nhập để lưu!");
    
    const data = objects.map(o => ({ 
        type: o.userData.type, 
        name: o.userData.name, 
        fileName: o.userData.fileName, 
        folder: o.userData.folder,
        position: { x: o.position.x, y: o.position.y, z: o.position.z },
        rotation: { x: o.rotation.x, y: o.rotation.y, z: o.rotation.z },
        scale: { x: o.scale.x, y: o.scale.y, z: o.scale.z },
        isWallMounted: o.userData.isWallMounted 
    }));
    
    saveDesignToCloud(currentUser.uid, data).then(() => {
        alert("Đã lưu thiết kế thành công!");
    }).catch(e => alert("Lỗi lưu: " + e.message));
});

const btnLoad = document.getElementById('btn-load');
if(btnLoad) btnLoad.addEventListener('click', async () => {
    if(!currentUser) return alert("Vui lòng đăng nhập!");
    
    toggleModal(true);
    const list = document.getElementById('save-list'); 
    list.innerHTML = '<div style="color:white; text-align:center;">Đang tải dữ liệu...</div>';
    
    try {
        const data = await loadDesignFromCloud(currentUser.uid);
        list.innerHTML = ''; 

        if(data && data.length > 0) {
            const div = document.createElement('div'); 
            div.className = 'save-item';
            div.innerHTML = `
                <div>
                    <div class="save-name">Bản lưu gần nhất</div>
                    <div class="save-date">Click để mở thiết kế</div>
                </div>
                <i class="fa-solid fa-cloud-arrow-down"></i>
            `;
            
            div.onclick = () => {
                objects.forEach(o => scene.remove(o)); 
                objects.length = 0; 
                transformControl.detach();
                
                data.forEach(item => {
                    createObjectFromConfig(
                        { 
                            fileName: item.fileName, 
                            name: item.name, 
                            type: item.type, 
                            isWallMounted: item.isWallMounted,
                            scale: item.scale 
                        }, 
                        item.folder, 
                        item.position 
                    );
                });
                toggleModal(false);
            };
            list.appendChild(div);
        } else {
            list.innerHTML = '<div style="color:#aaa; text-align:center;">Chưa có bản lưu nào.</div>';
        }
    } catch (e) {
        list.innerHTML = `<div style="color:red;">Lỗi: ${e.message}</div>`;
    }
});

const btnStartNav = document.getElementById('btn-start-nav');
if(btnStartNav) btnStartNav.addEventListener('click', () => checkAuth());

const btnStartHero = document.getElementById('btn-start-hero');
if(btnStartHero) btnStartHero.addEventListener('click', () => checkAuth());

const toggleBtn = document.getElementById('toggle-mode');
const formTitle = document.getElementById('form-title');
const submitBtnLabel = document.getElementById('btn-submit');

if(toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode; 
        
        if(isRegisterMode) {
            formTitle.innerText = "Tạo tài khoản";
            submitBtnLabel.innerText = "Đăng ký";
            toggleBtn.innerText = "Đã có tài khoản? Đăng nhập";
        } else {
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

        const fakeEmail = email.includes('@') ? email : email + "@vnuk.edu";
        const fakePass = pass === "123" ? "123123" : pass; 

        try {
            let user;
            if(isRegisterMode) {
                user = await registerWithEmail(fakeEmail, fakePass);
                alert("Đăng ký thành công! Đang đăng nhập...");
            } else {
                user = await loginWithEmail(fakeEmail, fakePass);
            }
            
            if(user) showMainApp(user);
            
        } catch(e) {
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
    const modalOverlay = document.getElementById('modal-overlay');
    if(show) { 
        if(modalOverlay) { modalOverlay.classList.remove('hidden'); modalOverlay.style.display = 'flex'; } 
    } else { 
        if(modalOverlay) modalOverlay.classList.add('hidden'); 
    }
}

const closeModalBtn = document.getElementById('modal-close');
if(closeModalBtn) closeModalBtn.addEventListener('click', () => toggleModal(false));