# 3D交互地球

一个使用Three.js创建的真实3D地球模拟器，展示地球的大陆板块、海洋和云层。

## 功能特点

- ✨ **真实地球纹理**：使用高分辨率的地球贴图，显示真实的大陆和海洋
- 🌊 **法线贴图**：增强地形细节，展现山脉和海底的起伏
- 💎 **高光贴图**：海洋表面有真实的反光效果
- ☁️ **云层系统**：半透明的云层独立旋转
- ⭐ **星空背景**：10000个星点组成的宇宙背景
- 🖱️ **交互控制**：
  - 鼠标左键拖拽：旋转地球
  - 鼠标滚轮：缩放视图
  - 鼠标右键拖拽：平移视角
- 🔄 **自动旋转**：地球和云层自动缓慢旋转

## 使用方法

1. 直接双击 `index.html` 文件在浏览器中打开
2. 或者使用本地服务器运行（推荐）：

```bash
# 使用Python
python -m http.server 8000

# 使用Node.js
npx serve

# 使用PHP
php -S localhost:8000
```

然后在浏览器中访问 `http://localhost:8000`

## 技术栈

- **Three.js** - 3D图形库
- **OrbitControls** - 相机控制
- 原生 JavaScript (ES6 Modules)

## 浏览器要求

需要支持ES6模块和WebGL的现代浏览器：
- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 79+

## 项目结构

```
3d-earth/
├── index.html      # 主HTML文件
├── style.css       # 样式文件
├── main.js         # Three.js逻辑
└── README.md       # 项目说明
```

## 自定义选项

在 `main.js` 中可以调整以下参数：

- `controls.autoRotateSpeed`：自动旋转速度
- `earth.rotation.y += 0.001`：地球自转速度
- `camera.position.z = 3`：初始相机距离
- `starsMaterial.size`：星星大小
- 光照强度和位置

## 许可

MIT License - 自由使用和修改
