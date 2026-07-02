import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 场景、相机、渲染器
let scene, camera, renderer, earth, clouds, controls;
let stars, sunLight;

// 模式控制
let mode = 'realTime'; // 'realTime' 或 'freeRotate'
let rotationPeriod = 30; // 自由自转模式的周期（秒）
let autoRotateSpeed = 0; // 当前自转速度

// 时间预览控制
let previewEnabled = false; // 是否开启预览
let previewOffset = 0; // 预览时间偏移（小时）

// 初始化场景
function init() {
    // 创建场景
    scene = new THREE.Scene();

    // 创建相机
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 3;

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // 添加轨道控制器
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 10;
    controls.autoRotate = false; // 我们自己控制旋转

    // 创建星空背景
    createStarfield();

    // 创建地球
    createEarth();

    // 添加光照
    createLights();

    // 窗口大小调整
    window.addEventListener('resize', onWindowResize);

    // 初始化UI控制
    initControls();

    // 开始动画
    animate();
}

// 创建星空背景
function createStarfield() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.7,
        transparent: true
    });

    const starsVertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

// 创建地球
function createEarth() {
    const earthGeometry = new THREE.SphereGeometry(1, 128, 128); // 提升几何精度
    const textureLoader = new THREE.TextureLoader();
    const loadingEl = document.getElementById('loading');

    let loadedCount = 0;
    const totalTextures = 4; // 使用4个纹理：白天、夜晚、法线、云层

    function checkAllLoaded() {
        loadedCount++;
        console.log(`纹理加载进度: ${loadedCount}/${totalTextures}`);
        if (loadedCount === totalTextures) {
            loadingEl.classList.add('hidden');
            console.log('所有纹理加载完成！');
        }
    }

    function onLoadError(err) {
        console.error('纹理加载失败:', err);
        loadedCount++;
        if (loadedCount === totalTextures) {
            loadingEl.classList.add('hidden');
        }
    }

    // 加载所有纹理 - 使用NASA高清素材
    const earthTexture = textureLoader.load('textures/earth_8k.jpg', checkAllLoaded, undefined, onLoadError);
    const nightTexture = textureLoader.load('textures/earth_night_8k.jpg', checkAllLoaded, undefined, onLoadError);
    const normalTexture = textureLoader.load('textures/earth_normal_2048.jpg', checkAllLoaded, undefined, onLoadError);

    // 自定义shader材质实现日夜渐变
    const uniforms = {
        dayTexture: { value: earthTexture },
        nightTexture: { value: nightTexture },
        normalMap: { value: normalTexture },
        sunDirection: { value: new THREE.Vector3(-1, 0, 0) },
        sunDeclination: { value: 0.0 } // 太阳赤纬角（根据日期变化）
    };

    const earthMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec3 vWorldNormal;

            void main() {
                vUv = uv;
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vPosition = worldPosition.xyz;
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D dayTexture;
            uniform sampler2D nightTexture;
            uniform sampler2D normalMap;
            uniform vec3 sunDirection;
            uniform float sunDeclination; // 太阳赤纬角（-23.5°到+23.5°）

            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec3 vWorldNormal;

            void main() {
                // 使用世界空间的法线计算光照
                vec3 worldNormal = normalize(vWorldNormal);

                // 采样法线贴图
                vec3 normalMapSample = texture2D(normalMap, vUv).rgb * 2.0 - 1.0;
                vec3 perturbedNormal = normalize(worldNormal + normalMapSample * 0.1);

                float intensity = dot(perturbedNormal, sunDirection);

                // 计算纬度 (从UV坐标: 0在南极，1在北极)
                float latitude = (vUv.y - 0.5) * 3.14159; // -π/2 到 π/2，弧度制

                // 极地修正：根据纬度和太阳赤纬角计算额外的光照偏移
                // 使用更宽的平滑范围，从50°开始渐变
                float polarAdjust = 0.0;

                // 北极地区 - 从50°到90°渐变
                if (latitude > 0.87) { // 约50°以上
                    float polarStrength = smoothstep(0.87, 1.57, latitude); // 50°到90°平滑过渡
                    if (sunDeclination > 0.0) {
                        // 北半球夏季：越靠近北极越亮，但适度
                        polarAdjust = polarStrength * sunDeclination * 0.5;
                    } else {
                        // 北半球冬季：越靠近北极越暗，但适度
                        polarAdjust = polarStrength * sunDeclination * 0.7;
                    }
                }
                // 南极地区 - 从-50°到-90°渐变
                else if (latitude < -0.87) { // 约-50°以下
                    float polarStrength = smoothstep(0.87, 1.57, abs(latitude)); // -50°到-90°平滑过渡
                    if (sunDeclination < 0.0) {
                        // 南半球夏季：越靠近南极越亮，但适度
                        polarAdjust = polarStrength * abs(sunDeclination) * 0.5;
                    } else {
                        // 南半球冬季：越靠近南极越暗，但适度
                        polarAdjust = -polarStrength * sunDeclination * 0.7;
                    }
                }

                intensity += polarAdjust;

                // 日夜过渡系数
                float dayMix = smoothstep(-0.05, 0.15, intensity);

                // 获取纹理颜色
                vec3 dayColor = texture2D(dayTexture, vUv).rgb;
                vec3 nightColor = texture2D(nightTexture, vUv).rgb;

                // 白天效果
                float diffuse = max(intensity, 0.0);
                vec3 litDay = dayColor * (0.8 + 0.8 * diffuse);

                // 夜晚效果
                vec3 nightLights = nightColor * 2.0;
                vec3 nightAmbient = dayColor * 0.03;
                vec3 nightFinal = nightAmbient + nightLights;

                // 混合日夜
                vec3 color = mix(nightFinal, litDay, dayMix);

                // 大气边缘光晕
                vec3 viewDir = normalize(cameraPosition - vPosition);
                float rim = 1.0 - max(dot(viewDir, worldNormal), 0.0);
                rim = pow(rim, 3.0);

                vec3 atmosColor = mix(vec3(0.3, 0.5, 1.0), vec3(0.1, 0.3, 0.6), dayMix);
                color += atmosColor * rim * 0.15;

                gl_FragColor = vec4(color, 1.0);
            }
        `
    });

    earth = new THREE.Mesh(earthGeometry, earthMaterial);

    // 保存material引用，用于更新sunDeclination
    earth.userData.material = earthMaterial;

    // 设置初始旋转：东八区（东经120度）朝向相机
    earth.rotation.y = (120 / 180) * Math.PI;

    scene.add(earth);

    // 添加云层
    const cloudsGeometry = new THREE.SphereGeometry(1.01, 128, 128);
    const cloudsTexture = textureLoader.load('textures/earth_clouds_1024.png', checkAllLoaded, undefined, onLoadError);

    const cloudsMaterial = new THREE.MeshPhongMaterial({
        map: cloudsTexture,
        transparent: true,
        opacity: 0.4, // 从0.25增加到0.4，更明显
        depthWrite: false,
        side: THREE.DoubleSide
    });

    clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
    clouds.rotation.y = earth.rotation.y;
    scene.add(clouds);
}

// 创建光照
function createLights() {
    // 环境光（提供基础照明）
    const ambientLight = new THREE.AmbientLight(0x666666, 1.0);
    scene.add(ambientLight);

    // 太阳光（方向光）- 从左侧照射（X轴负方向）
    sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(-5, 0, 0);
    scene.add(sunLight);
}

// 用户交互状态
let userInteracting = false;
let lastInteractionTime = Date.now();
let userHasMoved = false; // 跟踪用户是否主动移动过

// 监听用户交互（鼠标和触摸）
document.addEventListener('mousedown', () => {
    userInteracting = true;
    userHasMoved = true;
    lastInteractionTime = Date.now();
});

document.addEventListener('mouseup', () => {
    userInteracting = false;
    lastInteractionTime = Date.now();
});

document.addEventListener('mousemove', (e) => {
    if (userInteracting) {
        lastInteractionTime = Date.now();
    }
});

document.addEventListener('wheel', () => {
    lastInteractionTime = Date.now();
});

// 触摸事件支持
document.addEventListener('touchstart', () => {
    userInteracting = true;
    userHasMoved = true;
    lastInteractionTime = Date.now();
}, { passive: true });

document.addEventListener('touchend', () => {
    userInteracting = false;
    lastInteractionTime = Date.now();
}, { passive: true });

document.addEventListener('touchmove', () => {
    if (userInteracting) {
        lastInteractionTime = Date.now();
    }
}, { passive: true });

// 初始化UI控制
function initControls() {
    const settingsIcon = document.getElementById('settingsIcon');
    const controlPanel = document.getElementById('controlPanel');
    const closePanel = document.getElementById('closePanel');
    const realTimeBtn = document.getElementById('realTimeBtn');
    const freeRotateBtn = document.getElementById('freeRotateBtn');
    const realTimePanel = document.getElementById('realTimePanel');
    const freeRotatePanel = document.getElementById('freeRotatePanel');
    const periodSlider = document.getElementById('periodSlider');
    const periodValue = document.getElementById('periodValue');

    // 打开/关闭设置面板
    settingsIcon.addEventListener('click', () => {
        controlPanel.classList.toggle('hidden');
    });

    closePanel.addEventListener('click', () => {
        controlPanel.classList.add('hidden');
    });

    // 点击面板外部关闭
    document.addEventListener('click', (e) => {
        if (!controlPanel.contains(e.target) && !settingsIcon.contains(e.target)) {
            controlPanel.classList.add('hidden');
        }
    });

    // 切换到真实时间模式
    realTimeBtn.addEventListener('click', () => {
        mode = 'realTime';
        realTimeBtn.classList.add('active');
        freeRotateBtn.classList.remove('active');
        realTimePanel.style.display = 'block';
        freeRotatePanel.style.display = 'none';

        // 重置到当前真实时间对应的旋转
        updateEarthRotationForRealTime();
    });

    // 切换到自由自转模式
    freeRotateBtn.addEventListener('click', () => {
        mode = 'freeRotate';
        freeRotateBtn.classList.add('active');
        realTimeBtn.classList.remove('active');
        freeRotatePanel.style.display = 'block';
        realTimePanel.style.display = 'none';
    });

    // 自转周期滑块
    periodSlider.addEventListener('input', (e) => {
        rotationPeriod = parseInt(e.target.value);
        periodValue.textContent = rotationPeriod;
        autoRotateSpeed = (Math.PI * 2) / (rotationPeriod * 60); // 弧度每帧
    });

    // 时间预览控制
    const previewToggle = document.getElementById('previewToggle');
    const previewControls = document.getElementById('previewControls');
    const previewSlider = document.getElementById('previewSlider');
    const previewValue = document.getElementById('previewValue');
    const previewTime = document.getElementById('previewTime');

    // 只有在元素存在时才添加事件监听器
    if (previewToggle && previewControls && previewSlider && previewValue && previewTime) {
        // 开启/关闭预览
        previewToggle.addEventListener('change', (e) => {
            previewEnabled = e.target.checked;
            previewControls.style.display = previewEnabled ? 'block' : 'none';

            if (!previewEnabled) {
                // 关闭预览，重置偏移
                previewOffset = 0;
                previewSlider.value = 0;
            }

            // 更新地球旋转
            if (mode === 'realTime') {
                updateEarthRotationForRealTime();
            }
        });

        // 预览滑块
        previewSlider.addEventListener('input', (e) => {
            previewOffset = parseFloat(e.target.value);

            // 更新显示
            const sign = previewOffset > 0 ? '+' : '';
            previewValue.textContent = `${sign}${previewOffset}小时`;

            // 计算预览时间
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const chinaTime = new Date(utc + (3600000 * 8));
            const previewDate = new Date(chinaTime.getTime() + previewOffset * 3600000);

            const hours = String(previewDate.getHours()).padStart(2, '0');
            const minutes = String(previewDate.getMinutes()).padStart(2, '0');
            previewTime.textContent = `${hours}:${minutes}`;

            // 更新地球旋转
            if (mode === 'realTime' && previewEnabled) {
                updateEarthRotationForRealTime();
            }
        });
    } else {
        console.warn('时间预览元素未找到，功能已禁用');
    }

    // 初始化自转速度
    autoRotateSpeed = (Math.PI * 2) / (rotationPeriod * 60);

    // 初始化真实时间模式
    updateEarthRotationForRealTime();
    updateSunDeclination(); // 初始化太阳赤纬角

    // 更新时间显示
    setInterval(updateTimeDisplay, 1000);
    updateTimeDisplay();

    // 每小时更新一次太阳赤纬角（实际上一天变化很小）
    setInterval(updateSunDeclination, 3600000);

    // 每分钟校准一次地球旋转，防止累积误差
    setInterval(() => {
        if (mode === 'realTime' && !previewEnabled && !userInteracting) {
            updateEarthRotationForRealTime();
        }
    }, 60000); // 60秒校准一次
}

// 更新东八区时间显示
function updateTimeDisplay() {
    const now = new Date();
    // 获取东八区时间（UTC+8）
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const chinaTime = new Date(utc + (3600000 * 8));

    const hours = String(chinaTime.getHours()).padStart(2, '0');
    const minutes = String(chinaTime.getMinutes()).padStart(2, '0');
    const seconds = String(chinaTime.getSeconds()).padStart(2, '0');

    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = `${hours}:${minutes}:${seconds}`;
    }
}

// 计算太阳赤纬角（根据日期）
function calculateSunDeclination() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24)) + 1;

    // 使用简化公式计算太阳赤纬角
    // 春分约3月20日（第79天），夏至约6月21日（第172天），秋分约9月23日（第266天），冬至约12月21日（第355天）
    const angle = (dayOfYear - 79) * (2 * Math.PI / 365.25);
    const declination = 0.40928 * Math.sin(angle); // 23.5° = 0.40928弧度

    console.log(`当前日期第${dayOfYear}天，太阳赤纬角: ${(declination * 180 / Math.PI).toFixed(2)}°`);

    return declination;
}

// 更新太阳赤纬角到shader
function updateSunDeclination() {
    if (earth && earth.userData.material) {
        const declination = calculateSunDeclination();
        earth.userData.material.uniforms.sunDeclination.value = declination;
    }
}

// 根据真实时间更新地球旋转
function updateEarthRotationForRealTime() {
    if (!earth) return;

    const now = new Date();
    // 获取东八区时间
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const chinaTime = new Date(utc + (3600000 * 8));

    // 计算当天已经过去的小时数（包括分秒的小数部分）
    const hours = chinaTime.getHours();
    const minutes = chinaTime.getMinutes();
    const seconds = chinaTime.getSeconds();
    let totalHours = hours + minutes / 60 + seconds / 3600;

    // 如果开启预览，添加时间偏移
    if (previewEnabled) {
        totalHours += previewOffset;
        // 处理跨天情况
        if (totalHours < 0) totalHours += 24;
        if (totalHours >= 24) totalHours -= 24;
    }

    console.log(`东八区时间: ${hours}:${minutes}:${seconds}, 总小时数: ${totalHours}${previewEnabled ? ` (预览偏移: ${previewOffset}h)` : ''}`);

    // 太阳从X轴负方向照射
    // 12点时，东经120度应该正对X轴负方向

    const lon120 = (120 / 180) * Math.PI;
    const hoursFrom12 = totalHours - 12;

    // 地球自西向东转，时间越晚，Y轴旋转角度越大
    const fineAdjust = -4.7; // 微调
    const rotation = lon120 + ((hoursFrom12 + fineAdjust) * Math.PI / 12); // 改成加号

    earth.rotation.y = rotation;

    console.log(`当前时间与12点差: ${hoursFrom12}小时, 微调后: ${hoursFrom12 + fineAdjust}小时, 旋转角度: ${rotation}`);

    if (clouds) {
        clouds.rotation.y = earth.rotation.y;
    }
}

// 计算真实地球自转增量（每帧）
function getRealEarthRotationSpeed() {
    // 真实地球24小时转360度 = 2π弧度，自西向东
    // 假设60fps，24小时 = 24 * 3600 * 60 帧
    return (Math.PI * 2) / (24 * 3600 * 60);
}

// 动画循环
function animate() {
    requestAnimationFrame(animate);

    if (mode === 'realTime') {
        // 真实时间模式
        // 预览模式下暂停自动旋转
        if (!userInteracting && earth && !previewEnabled) {
            // 按照真实速度自转
            earth.rotation.y += getRealEarthRotationSpeed();
            if (clouds) {
                clouds.rotation.y += getRealEarthRotationSpeed() * 1.2; // 云层稍快
            }
        }
        // 如果用户正在交互或开启预览，只改变视角，不改变地球旋转
    } else if (mode === 'freeRotate') {
        // 自由自转模式 - 自西向东
        if (earth) {
            earth.rotation.y += autoRotateSpeed; // 改成加法，自西向东
        }
        if (clouds) {
            clouds.rotation.y += autoRotateSpeed * 1.2;
        }
    }

    // 星空缓慢旋转
    if (stars) {
        stars.rotation.y += 0.0001;
    }

    // 更新控制器
    controls.update();

    // 渲染场景
    renderer.render(scene, camera);
}

// 窗口大小调整
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 启动应用
init();
