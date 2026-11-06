import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { buildKart } from '../game/kartModel.js';

function Turntable({ look, spin }) {
  const group = useRef();
  const view = useMemo(() => buildKart(look), [look.body, look.trim, look.helmet, look.stripe, look.wing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { view.blob.visible = false; return () => view.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }, [view]);
  useFrame((_, dt) => {
    if (!group.current) return;
    if (!spin.drag) spin.angle += dt * 0.5;
    group.current.rotation.y = spin.angle;
    for (const w of view.wheels) w.rotation.x += dt * 2;
  });
  return (
    <group>
      <mesh position={[0, -0.12, 0]} receiveShadow><cylinderGeometry args={[3.3, 3.5, 0.24, 36]} /><meshLambertMaterial color="#56627f" /></mesh>
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[3.0, 0.07, 6, 48]} /><meshBasicMaterial color="#38bdf8" /></mesh>
      <mesh position={[0, 0.0, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.95, 3.1, 48]} /><meshBasicMaterial color="#ffd23f" /></mesh>
      <group ref={group}><primitive object={view.root} /></group>
    </group>
  );
}

// A kart on a pedestal. Drag to rotate it; it also turns slowly by itself.
export default function GaragePreview({ look }) {
  const spin = useRef({ angle: 0.6, drag: false, x: 0 }).current;
  return (
    <div className="preview3d" role="img" aria-label="3D kart preview. Drag to rotate."
      onPointerDown={(e) => { spin.drag = true; spin.x = e.clientX; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } }}
      onPointerMove={(e) => { if (spin.drag) { spin.angle += (e.clientX - spin.x) * 0.012; spin.x = e.clientX; } }}
      onPointerUp={() => { spin.drag = false; }} onPointerCancel={() => { spin.drag = false; }}>
      <Canvas dpr={[1, 1.6]} camera={{ position: [7.4, 4.4, 8.4], fov: 33 }} gl={{ antialias: true, alpha: true }} onCreated={({ camera }) => camera.lookAt(0, 0.7, 0)}>
        <hemisphereLight args={['#dff1ff', '#8a7a5a', 1.0]} />
        <directionalLight position={[4, 8, 5]} intensity={1.2} />
        <directionalLight position={[-5, 3, -4]} intensity={0.5} color="#9ec5ff" />
        <Turntable look={look} spin={spin} />
      </Canvas>
    </div>
  );
}
