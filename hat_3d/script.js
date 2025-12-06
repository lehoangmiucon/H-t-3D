// --- 1. CẤU HÌNH THREE.JS (Đồ họa 3D) ---
const container = document.getElementById('canvas-container');
const colorPicker = document.getElementById('colorPicker');

// Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050505, 0.002);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Tạo hệ thống hạt (Particle System)
const particleCount = 4000;
const geometry = new THREE.BufferGeometry();
const originalPositions = new Float32Array(particleCount * 3);
const positions = new Float32Array(particleCount * 3);
const velocities = [];

const sphereRadius = 15;

for (let i = 0; i < particleCount; i++) {
    // Tạo vị trí ngẫu nhiên trong hình cầu
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    const r = Math.cbrt(Math.random()) * sphereRadius;

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    originalPositions[i * 3] = x;
    originalPositions[i * 3 + 1] = y;
    originalPositions[i * 3 + 2] = z;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    velocities.push({
        x: (Math.random() - 0.5) * 0.05,
        y: (Math.random() - 0.5) * 0.05,
        z: (Math.random() - 0.5) * 0.05
    });
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

// Material
const material = new THREE.PointsMaterial({
    color: 0x00ffff,
    size: 0.3,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// Sự kiện đổi màu
colorPicker.addEventListener('input', (e) => {
    material.color.set(e.target.value);
});

// Sự kiện resize màn hình
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- 2. LOGIC CHUYỂN ĐỘNG ---
let targetExpansion = 1.0;
let currentExpansion = 1.0;

function animateParticles() {
    // Lerp để chuyển động mượt
    currentExpansion += (targetExpansion - currentExpansion) * 0.1;

    const positionsAttribute = geometry.attributes.position;
    const array = positionsAttribute.array;

    // Xoay nhẹ
    particles.rotation.y += 0.002;
    if (currentExpansion > 1.2) {
        particles.rotation.y += 0.005;
    }

    // Cập nhật vị trí từng hạt
    for (let i = 0; i < particleCount; i++) {
        const ix = i * 3;
        const iy = i * 3 + 1;
        const iz = i * 3 + 2;

        const ox = originalPositions[ix];
        const oy = originalPositions[iy];
        const oz = originalPositions[iz];

        const noise = (currentExpansion - 1) * 2.0; 
        
        array[ix] = ox * currentExpansion + velocities[i].x * noise;
        array[iy] = oy * currentExpansion + velocities[i].y * noise;
        array[iz] = oz * currentExpansion + velocities[i].z * noise;
    }

    positionsAttribute.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);
    animateParticles();
    renderer.render(scene, camera);
}

animate();

// --- 3. MEDIAPIPE (Xử lý 1 tay) ---
const videoElement = document.getElementById('input-video');
const statusElement = document.getElementById('status');
const loadingElement = document.getElementById('loading');

// Hàm tính khoảng cách 2 điểm
function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function onResults(results) {
    loadingElement.style.display = 'none';

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        
        statusElement.innerText = "Trạng thái: Đã kết nối tay";
        statusElement.style.color = "#4caf50";

        // Lấy bàn tay đầu tiên
        const landmarks = results.multiHandLandmarks[0];

        // 1. Kích thước lòng bàn tay (Cổ tay -> Đốt ngón giữa)
        const palmSize = getDistance(landmarks[0], landmarks[9]);

        // 2. Độ dài từ cổ tay -> Đầu ngón giữa
        const fingerExtension = getDistance(landmarks[0], landmarks[12]);

        // 3. Tính tỷ lệ
        let ratio = fingerExtension / palmSize;

        // 4. Map tỷ lệ sang Expansion
        // Nắm tay ~ 1.0 | Xòe tay ~ 2.2
        const minRatio = 0.9;
        const maxRatio = 2.2;

        let factor = (ratio - minRatio) / (maxRatio - minRatio);
        factor = Math.max(0, Math.min(1, factor));

        targetExpansion = 1 + (factor * 3.5); 

    } else {
        statusElement.innerText = "Trạng thái: Đang tìm bàn tay...";
        statusElement.style.color = "#ffeb3b";
        targetExpansion = 1.0;
    }
}

const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

// Khởi động Camera
const cameraUtils = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 640,
    height: 480
});

cameraUtils.start()
    .then(() => {
        console.log("Camera started");
    })
    .catch(err => {
        console.error("Camera error:", err);
        statusElement.innerText = "Lỗi Camera";
        loadingElement.innerText = "Hãy chạy bằng Live Server để dùng Camera";
    });