import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const ThreeGlobeMesh: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animationFrameId: number;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 18);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // 1. Core Emerald Wireframe Icosahedron
    const coreGeo = new THREE.IcosahedronGeometry(6.2, 3);
    const coreMat = new THREE.MeshLambertMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    globeGroup.add(coreMesh);

    // 2. Inner Glowing Core Sphere
    const innerGeo = new THREE.SphereGeometry(4.8, 32, 32);
    const innerMat = new THREE.MeshPhongMaterial({
      color: 0x064e3b,
      emissive: 0x059669,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.48,
      shininess: 80,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    globeGroup.add(innerMesh);

    // 3. PoP Points / Global Nodes (140 Edge Nodes)
    const nodeCount = 140;
    const nodePositions: number[] = [];
    const nodeColors: number[] = [];
    const colorEmerald = new THREE.Color(0x34d399);
    const colorCyan = new THREE.Color(0x38bdf8);
    const colorWhite = new THREE.Color(0xffffff);

    for (let i = 0; i < nodeCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / nodeCount);
      const theta = Math.sqrt(nodeCount * Math.PI) * phi;
      const r = 6.25 + Math.random() * 0.2;

      const x = r * Math.cos(theta) * Math.sin(phi);
      const y = r * Math.sin(theta) * Math.sin(phi);
      const z = r * Math.cos(phi);
      nodePositions.push(x, y, z);

      const randC = Math.random();
      const c = randC > 0.6 ? colorEmerald : randC > 0.25 ? colorCyan : colorWhite;
      nodeColors.push(c.r, c.g, c.b);
    }

    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(nodePositions, 3));
    nodeGeo.setAttribute('color', new THREE.Float32BufferAttribute(nodeColors, 3));

    // Circle texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.3, 'rgba(52,211,153,0.9)');
      gradient.addColorStop(1, 'rgba(16,185,129,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(16, 16, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    const pointTexture = new THREE.CanvasTexture(canvas);

    const nodeMat = new THREE.PointsMaterial({
      size: 0.42,
      vertexColors: true,
      map: pointTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const nodePoints = new THREE.Points(nodeGeo, nodeMat);
    globeGroup.add(nodePoints);

    // 4. Data Arc Links
    const arcCurves: THREE.Line[] = [];
    const arcPointsCount = 6;
    for (let i = 0; i < arcPointsCount; i++) {
      const idx1 = Math.floor(Math.random() * nodeCount) * 3;
      const idx2 = Math.floor(Math.random() * nodeCount) * 3;
      const v1 = new THREE.Vector3(nodePositions[idx1], nodePositions[idx1 + 1], nodePositions[idx1 + 2]);
      const v2 = new THREE.Vector3(nodePositions[idx2], nodePositions[idx2 + 1], nodePositions[idx2 + 2]);

      const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(7.5 + Math.random() * 0.8);

      const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
      const points = curve.getPoints(30);
      const curveGeo = new THREE.BufferGeometry().setFromPoints(points);
      const curveMat = new THREE.LineBasicMaterial({
        color: i % 2 === 0 ? 0x10b981 : 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(curveGeo, curveMat);
      globeGroup.add(line);
      arcCurves.push(line);
    }

    // 5. Orbital Edge Rings
    const ringGeo1 = new THREE.TorusGeometry(8.2, 0.03, 16, 100);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.35,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    ring1.rotation.y = Math.PI / 6;
    globeGroup.add(ring1);

    const ringGeo2 = new THREE.TorusGeometry(8.8, 0.02, 16, 100);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = -Math.PI / 4;
    ring2.rotation.y = Math.PI / 4;
    globeGroup.add(ring2);

    // Subtle Atmospheric Lighting
    const ambientLight = new THREE.AmbientLight(0x0f2b20, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x34d399, 2.5);
    dirLight1.position.set(10, 15, 12);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 1.8);
    dirLight2.position.set(-15, -10, -8);
    scene.add(dirLight2);

    // Mouse Parallax Interactivity
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;

    const onMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX - windowHalfX) * 0.0006;
      mouseY = (event.clientY - windowHalfY) * 0.0006;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Constant planetary rotation
      globeGroup.rotation.y += 0.0035;
      globeGroup.rotation.x += 0.001;

      // Mouse parallax damping
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;
      globeGroup.rotation.y += targetX * 0.4;
      globeGroup.rotation.x += targetY * 0.4;

      ring1.rotation.z += 0.004;
      ring2.rotation.z -= 0.003;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      pointTexture.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      arcCurves.forEach(l => {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      });
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full pointer-events-none" />;
};
