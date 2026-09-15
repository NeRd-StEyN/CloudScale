import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const ThreeMicroVmScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animationFrameId: number;
    const width = container.clientWidth || 480;
    const height = container.clientHeight || 220;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0, 14);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const clusterGroup = new THREE.Group();
    scene.add(clusterGroup);

    // Holographic Floating Server Blades / MicroVM Shards
    const shards: THREE.Mesh[] = [];
    const shardGeo = new THREE.BoxGeometry(1.6, 0.15, 2.4);
    const shardMat = new THREE.MeshPhongMaterial({
      color: 0x064e3b,
      emissive: 0x059669,
      emissiveIntensity: 0.35,
      specular: 0x34d399,
      shininess: 90,
      transparent: true,
      opacity: 0.85,
    });

    const edgeGeo = new THREE.EdgesGeometry(shardGeo);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.8 });

    for (let i = 0; i < 5; i++) {
      const shard = new THREE.Mesh(shardGeo, shardMat);
      shard.position.set(0, (i - 2) * 0.9, 0);
      const wire = new THREE.LineSegments(edgeGeo, edgeMat);
      shard.add(wire);
      clusterGroup.add(shard);
      shards.push(shard);
    }

    // Central Glowing Core Sphere
    const coreGeo = new THREE.IcosahedronGeometry(0.85, 2);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.7,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    clusterGroup.add(coreMesh);

    // Orbital Edge Rings
    const ringGeo = new THREE.TorusGeometry(3.6, 0.02, 16, 80);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.3;
    clusterGroup.add(ring);

    // Edge Telemetry Particles
    const particleCount = 60;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const angles = new Float32Array(particleCount);
    const radii = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      angles[i] = Math.random() * Math.PI * 2;
      radii[i] = 2.0 + Math.random() * 2.8;
      speeds[i] = 0.008 + Math.random() * 0.015;
      positions[i * 3] = Math.cos(angles[i]) * radii[i];
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3.5;
      positions[i * 3 + 2] = Math.sin(angles[i]) * radii[i];
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x6ee7b7,
      size: 0.22,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    clusterGroup.add(particleSystem);

    // Lights
    const ambient = new THREE.AmbientLight(0x064e3b, 1.2);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0x34d399, 2.0);
    dirLight.position.set(6, 8, 8);
    scene.add(dirLight);

    const cyanLight = new THREE.PointLight(0x38bdf8, 1.8, 20);
    cyanLight.position.set(-6, -4, 4);
    scene.add(cyanLight);

    // Mouse Parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      mouseX = (x / rect.width) * 0.8;
      mouseY = (y / rect.height) * 0.8;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 480;
      const h = container.clientHeight || 220;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Orbital motion
      clusterGroup.rotation.y += 0.004;
      ring.rotation.z += 0.006;
      coreMesh.rotation.x += 0.01;
      coreMesh.rotation.y += 0.012;

      // Mouse damping
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;
      clusterGroup.rotation.y += targetX * 0.02;
      clusterGroup.rotation.x = targetY * 0.4 + Math.sin(time * 0.8) * 0.08;

      // Hover wave on shards
      shards.forEach((s, idx) => {
        s.position.y = (idx - 2) * 0.9 + Math.sin(time * 2.0 + idx * 0.8) * 0.08;
        s.rotation.y = Math.sin(time * 0.5 + idx) * 0.1;
      });

      // Particle flow
      const posArr = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        angles[i] += speeds[i];
        posArr[i * 3] = Math.cos(angles[i]) * radii[i];
        posArr[i * 3 + 2] = Math.sin(angles[i]) * radii[i];
      }
      particleGeo.attributes.position.needsUpdate = true;

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
      shardGeo.dispose();
      shardMat.dispose();
      edgeGeo.dispose();
      edgeMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full bg-transparent block relative z-10" />;
};
