"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Center,
  Environment,
  OrbitControls,
  Sparkles,
  useGLTF,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
} from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import * as THREE from "three";

/* ═══════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════ */

type Phase = "intro" | "idle" | "throwing" | "shaking" | "captured" | "fled";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const asset = (p: string) => `${BASE_PATH}${p}`;

// Island
const ISLAND_POS = new THREE.Vector3(0, -4, 0);
const ISLAND_SCALE = 0.035;
const ISLAND_ROTATION_Y = Math.PI * 1.1;

// Suicune
const ENCOUNTER = new THREE.Vector3(0.5, 5.5, -0.6);

// Camera
const CAM_POS = new THREE.Vector3(7, 6.5, 3);
const CAM_LOOK_AT_OFFSET = new THREE.Vector3(0, 0.3, 0);

const POKEBALL_SCALE = 0.1;

/* ═══════════════════════════════════════════════
   MAIN SCENE
   ═══════════════════════════════════════════════ */

interface SceneProps {
  phase: Phase;
  onIntroDone: () => void;
  onBallHit: () => void;
}

export function Scene({ phase, onIntroDone, onBallHit }: SceneProps) {
  const [debugCam, setDebugCam] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "c") setDebugCam((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div onContextMenu={(e) => e.preventDefault()} className="absolute inset-0">
      <Canvas
        dpr={[1, 1.5]}
        shadows
        camera={{ position: [7, 6.5, 3], fov: 40, near: 0.1, far: 300 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={["#0a0a1a"]} />
          <fog attach="fog" args={["#0a0a1a", 40, 120]} />

          {/* === LIGHTING === */}
          <ambientLight intensity={0.15} color="#0a0a2e" />

          <directionalLight
            position={[-5, 25, -10]}
            intensity={0.7}
            color="#6677cc"
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={1}
            shadow-camera-far={60}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
            shadow-bias={-0.005}
          />

          <spotLight
            position={[ENCOUNTER.x + 1, ENCOUNTER.y + 8, ENCOUNTER.z + 3]}
            intensity={12}
            color="#38bdf8"
            distance={25}
            angle={0.4}
            penumbra={1}
            decay={2}
            castShadow
          />

          <pointLight
            position={[ENCOUNTER.x - 5, ENCOUNTER.y + 2, ENCOUNTER.z + 2]}
            intensity={3}
            color="#ec4899"
            distance={18}
            decay={2}
          />

          <pointLight
            position={[ENCOUNTER.x + 5, ENCOUNTER.y + 1, ENCOUNTER.z - 1]}
            intensity={2}
            color="#7c3aed"
            distance={15}
            decay={2}
          />

          <pointLight
            position={[ENCOUNTER.x + 3, ENCOUNTER.y + 1, ENCOUNTER.z + 8]}
            intensity={1.2}
            color="#94a3b8"
            distance={15}
            decay={2}
          />

          <Environment preset="night" />

          {/* === WORLD === */}
          <IslandModel />
          <LanternFlames />
          <Moon />
          <Fireflies />

          {/* === VFX === */}
          <FloatingCrystals />
          <StarField />

          <Sparkles
            count={100}
            size={1.5}
            speed={0.3}
            opacity={0.25}
            scale={[10, 6, 10]}
            position={[ENCOUNTER.x, ENCOUNTER.y + 2, ENCOUNTER.z]}
            color="#60a5fa"
          />
          <Sparkles
            count={50}
            size={0.8}
            speed={0.5}
            opacity={0.2}
            scale={[6, 4, 6]}
            position={[ENCOUNTER.x, ENCOUNTER.y + 2, ENCOUNTER.z]}
            color="#f9a8d4"
          />

          {/* === ENCOUNTER === */}
          <CameraController
            phase={phase}
            onIntroDone={onIntroDone}
            debugCam={debugCam}
            position={ENCOUNTER}
          />
          <SuicuneAura position={ENCOUNTER} phase={phase} />
          <SuicuneModel phase={phase} position={ENCOUNTER} />
          <PokeballModel
            phase={phase}
            position={ENCOUNTER}
            onHit={onBallHit}
            ballScale={POKEBALL_SCALE}
          />

          {/* Post-processing */}
          <EffectComposer>
            <SMAA />
            <Bloom
              intensity={0.8}
              luminanceThreshold={0.15}
              luminanceSmoothing={0.8}
              mipmapBlur
            />
            <Vignette eskil={false} offset={0.2} darkness={0.75} />
          </EffectComposer>

          {debugCam && (
            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.08}
              enablePan
              minDistance={2}
              maxDistance={80}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CAMERA CONTROLLER — with subtle breathing sway
   ═══════════════════════════════════════════════ */

function CameraController({
  phase,
  onIntroDone,
  debugCam,
  position,
}: {
  phase: Phase;
  onIntroDone: () => void;
  debugCam: boolean;
  position: THREE.Vector3;
}) {
  const elapsed = useRef(0);

  useEffect(() => {
    if (phase === "intro") elapsed.current = 0;
  }, [phase]);

  useFrame((state, delta) => {
    elapsed.current += delta;

    if (!debugCam) {
      const lookAt = position.clone().add(CAM_LOOK_AT_OFFSET);

      // Subtle breathing sway
      const t = elapsed.current;
      const swayTarget = CAM_POS.clone();
      swayTarget.x += Math.sin(t * 0.25) * 0.08;
      swayTarget.y += Math.sin(t * 0.18) * 0.04;
      swayTarget.z += Math.cos(t * 0.2) * 0.05;

      state.camera.position.lerp(swayTarget, 0.06);
      state.camera.lookAt(lookAt);
    }

    if (!debugCam && phase === "intro" && elapsed.current > 1.5) {
      onIntroDone();
    }
  });

  return null;
}

/* ═══════════════════════════════════════════════
   MOON — large glowing sphere in the sky
   ═══════════════════════════════════════════════ */

function Moon() {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 0.3) * 0.15;
  });

  return (
    <group position={[-15, 28, -25]}>
      {/* Moon sphere */}
      <mesh ref={ref}>
        <sphereGeometry args={[3, 32, 32]} />
        <meshStandardMaterial
          color="#e8e0d0"
          emissive="#b8c4e8"
          emissiveIntensity={1.2}
          roughness={1}
          metalness={0}
        />
      </mesh>
      {/* Moonlight glow */}
      <pointLight
        intensity={2}
        color="#8899cc"
        distance={80}
        decay={2}
      />
      {/* Halo effect — slightly larger translucent sphere */}
      <mesh>
        <sphereGeometry args={[4.5, 32, 32]} />
        <meshStandardMaterial
          color="#8899cc"
          emissive="#6677aa"
          emissiveIntensity={0.5}
          transparent
          opacity={0.08}
          roughness={1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════
   FIREFLIES — soft glowing particles above the water
   ═══════════════════════════════════════════════ */

function Fireflies() {
  const flies = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 1 + Math.random() * 3;
      arr.push({
        basePos: [
          ENCOUNTER.x + Math.cos(angle) * dist,
          ENCOUNTER.y - 0.5 + Math.random() * 1.5,
          ENCOUNTER.z + Math.sin(angle) * dist,
        ] as [number, number, number],
        speed: 0.4 + Math.random() * 0.6,
        range: 0.2 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 1 + Math.random() * 2,
        color: Math.random() > 0.3 ? "#67e8f9" : "#fde68a",
      });
    }
    return arr;
  }, []);

  return (
    <group>
      {flies.map((f, i) => (
        <Firefly key={i} {...f} />
      ))}
    </group>
  );
}

function Firefly({
  basePos,
  speed,
  range,
  phase,
  pulseSpeed,
  color,
}: {
  basePos: [number, number, number];
  speed: number;
  range: number;
  phase: number;
  pulseSpeed: number;
  color: string;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.position.x = basePos[0] + Math.sin(t * speed + phase) * range;
      ref.current.position.y = basePos[1] + Math.sin(t * speed * 0.7 + phase + 1) * range * 0.6;
      ref.current.position.z = basePos[2] + Math.cos(t * speed * 0.8 + phase) * range;

      // Pulse opacity
      const pulse = 0.4 + Math.sin(t * pulseSpeed + phase) * 0.4;
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0.05, pulse);
      ref.current.scale.setScalar(0.02 + pulse * 0.015);
    }
    if (lightRef.current) {
      const pulse = 0.4 + Math.sin(t * pulseSpeed + phase) * 0.4;
      lightRef.current.intensity = pulse * 0.8;
    }
  });

  return (
    <group>
      <mesh ref={ref} position={basePos}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        position={basePos}
        intensity={0.5}
        color={color}
        distance={2}
        decay={2}
      />
    </group>
  );
}

/* ═══════════════════════════════════════════════
   SUICUNE AURA
   ═══════════════════════════════════════════════ */

function SuicuneAura({
  position,
  phase,
}: {
  position: THREE.Vector3;
  phase: Phase;
}) {
  const glowRef = useRef<THREE.PointLight>(null!);
  const glowRef2 = useRef<THREE.PointLight>(null!);

  const visible = phase === "idle" || phase === "intro";

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (glowRef.current) {
      glowRef.current.intensity = visible
        ? 8 + Math.sin(t * 1.2) * 3
        : THREE.MathUtils.lerp(glowRef.current.intensity, 0, 0.05);
    }

    if (glowRef2.current) {
      glowRef2.current.intensity = visible
        ? 5 + Math.sin(t * 1.8 + 1) * 2
        : THREE.MathUtils.lerp(glowRef2.current.intensity, 0, 0.05);
    }
  });

  return (
    <group position={[position.x, position.y, position.z]}>
      <pointLight
        ref={glowRef}
        position={[0, 0.5, 0.5]}
        intensity={8}
        color="#38bdf8"
        distance={10}
        decay={2}
      />
      <pointLight
        ref={glowRef2}
        position={[0, 1.5, -1]}
        intensity={5}
        color="#a78bfa"
        distance={8}
        decay={2}
      />
    </group>
  );
}

/* ═══════════════════════════════════════════════
   LANTERN FLAMES
   ═══════════════════════════════════════════════ */

function LanternFlames() {
  const flames = useMemo(() => [
    { pos: [-0.74, 5.55, 1.75] as [number, number, number] },
    { pos: [1.45, 5.55, 1.0] as [number, number, number] },
  ], []);

  return (
    <group>
      {flames.map((f, i) => (
        <LanternFlame key={i} position={f.pos} />
      ))}
    </group>
  );
}

function LanternFlame({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      const flicker = 0.04 + Math.sin(t * 2 + position[0] * 10) * 0.01;
      ref.current.scale.setScalar(flicker);
    }
    if (lightRef.current) {
      lightRef.current.intensity = 3 + Math.sin(t * 1.5 + position[0] * 5) * 0.8;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#ff8c00"
          emissiveIntensity={3}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        intensity={3}
        color="#ff9933"
        distance={3}
        decay={2}
      />
    </group>
  );
}

/* ═══════════════════════════════════════════════
   ISLAND MODEL
   ═══════════════════════════════════════════════ */

function IslandModel() {
  const { scene } = useGLTF(asset("/models/island.glb"));
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy();

    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      mesh.receiveShadow = true;
      mesh.castShadow = true;

      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      mats.forEach((m) => {
        if (!m) return;
        const std = m as THREE.MeshStandardMaterial;
        const textures = [
          std.map, std.emissiveMap, std.roughnessMap, std.metalnessMap, std.normalMap,
        ].filter(Boolean) as THREE.Texture[];

        textures.forEach((tex) => {
          tex.anisotropy = maxAniso;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = true;
          tex.needsUpdate = true;
        });
      });
    });
  }, [scene, gl]);

  return (
    <primitive
      object={scene}
      position={[ISLAND_POS.x, ISLAND_POS.y, ISLAND_POS.z]}
      rotation={[0, ISLAND_ROTATION_Y, 0]}
      scale={ISLAND_SCALE}
    />
  );
}

/* ═══════════════════════════════════════════════
   FLOATING CRYSTALS
   ═══════════════════════════════════════════════ */

function FloatingCrystals() {
  const crystals = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 10 + Math.random() * 12;
      arr.push({
        pos: [
          Math.cos(angle) * dist,
          -2 + Math.random() * 8,
          Math.sin(angle) * dist,
        ] as [number, number, number],
        scale: 0.06 + Math.random() * 0.18,
        speed: 0.3 + Math.random() * 0.5,
        rotSpeed: 0.2 + Math.random() * 0.8,
        color: ["#38bdf8", "#818cf8", "#c084fc", "#22d3ee", "#f9a8d4"][
          Math.floor(Math.random() * 5)
        ],
        floatRange: 0.3 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, []);

  return (
    <group>
      {crystals.map((c, i) => (
        <CrystalShard key={i} {...c} />
      ))}
    </group>
  );
}

function CrystalShard({
  pos, scale, speed, rotSpeed, color, floatRange, phase,
}: {
  pos: [number, number, number]; scale: number; speed: number;
  rotSpeed: number; color: string; floatRange: number; phase: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = pos[1] + Math.sin(t * speed + phase) * floatRange;
    ref.current.rotation.x = t * rotSpeed * 0.5;
    ref.current.rotation.y = t * rotSpeed;
    ref.current.rotation.z = t * rotSpeed * 0.3;
  });

  return (
    <mesh ref={ref} position={pos} scale={scale}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color={color} emissive={color} emissiveIntensity={0.6}
        roughness={0.2} metalness={0.8} transparent opacity={0.7}
      />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════
   STAR FIELD
   ═══════════════════════════════════════════════ */

function StarField() {
  const points = useMemo(() => {
    const p = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 50 + Math.random() * 50;
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 5;
      p[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return p;
  }, []);

  const ref = useRef<THREE.Points>(null!);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.003;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.12} color="#a5b4fc" transparent opacity={0.5}
        sizeAttenuation depthWrite={false}
      />
    </points>
  );
}

/* ═══════════════════════════════════════════════
   SUICUNE MODEL
   ═══════════════════════════════════════════════ */

function SuicuneModel({
  phase,
  position,
}: {
  phase: Phase;
  position: THREE.Vector3;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene } = useGLTF(asset("/models/suicune.glb"));
  const elapsed = useRef(0);

  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const mats = Array.isArray(mesh.material)
        ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        const std = m as THREE.MeshStandardMaterial;
        std.transparent = true;
        std.opacity = 1;
        std.depthWrite = true;
      });
    });
  }, [scene]);

  const fadeTo = (target: number, alpha: number) => {
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mats = Array.isArray((obj as THREE.Mesh).material)
        ? ((obj as THREE.Mesh).material as THREE.MeshStandardMaterial[])
        : [(obj as THREE.Mesh).material as THREE.MeshStandardMaterial];
      mats.forEach((m) => {
        if (!m) return;
        m.opacity = THREE.MathUtils.lerp(m.opacity ?? 1, target, alpha);
      });
    });
  };

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (!groupRef.current) return;

    const p = position;

    if (phase === "fled") {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y, -Math.PI * 0.6, 0.06
      );
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x, p.x + 8, 0.04
      );
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z, p.z - 4, 0.04
      );
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y, p.y + 1, 0.04
      );
      fadeTo(0, 0.04);
      return;
    }

    groupRef.current.position.set(
      THREE.MathUtils.lerp(groupRef.current.position.x, p.x, 0.1),
      THREE.MathUtils.lerp(groupRef.current.position.y, p.y, 0.1),
      THREE.MathUtils.lerp(groupRef.current.position.z, p.z, 0.1)
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y, Math.PI * 0.2, 0.1
    );

    if (phase === "shaking") {
      fadeTo(0, 0.06);
    } else if (phase === "captured") {
      fadeTo(0, 0.1);
    } else {
      fadeTo(1, 0.08);
    }
  });

  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={scene} scale={0.065} />
      </Center>
    </group>
  );
}

/* ═══════════════════════════════════════════════
   POKÉBALL MODEL
   ═══════════════════════════════════════════════ */

function PokeballModel({
  phase,
  position,
  onHit,
  ballScale,
}: {
  phase: Phase;
  position: THREE.Vector3;
  onHit: () => void;
  ballScale: number;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene } = useGLTF(asset("/models/pokeball.glb"));
  const { camera } = useThree();

  const elapsed = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const hitFired = useRef(false);
  const shakeStart = useRef(0);

  const targetCenter = useMemo(
    () => new THREE.Vector3(position.x, position.y + 0.8, position.z),
    [position]
  );

  const materials = useRef<THREE.MeshStandardMaterial[]>([]);
  useEffect(() => {
    materials.current = [];
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const mats = Array.isArray(mesh.material)
        ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (std && "roughness" in std) {
          if (!std.emissive) std.emissive = new THREE.Color("#000000");
          materials.current.push(std);
        }
      });
    });
  }, [scene]);

  const setGlow = (level: number, color: string = "#ffffff") => {
    materials.current.forEach((m) => {
      m.emissive.set(color);
      m.emissiveIntensity = level;
    });
  };

  useEffect(() => {
    if (phase === "throwing") {
      elapsed.current = 0;
      hitFired.current = false;

      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);

      startPos.current
        .copy(camera.position)
        .add(dir.multiplyScalar(1.2))
        .add(new THREE.Vector3(0, -0.6, 0));

      endPos.current.copy(targetCenter);

      groupRef.current.visible = true;
      groupRef.current.position.copy(startPos.current);
      groupRef.current.rotation.set(0, 0, 0);
      setGlow(0);
    }

    if (phase === "shaking") {
      shakeStart.current = 0;
    }
  }, [phase, camera, targetCenter]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    switch (phase) {
      case "throwing": {
        elapsed.current = Math.min(elapsed.current + delta * 1.7, 1);

        const p = startPos.current.clone().lerp(endPos.current, elapsed.current);
        p.y += Math.sin(elapsed.current * Math.PI) * 1.6;

        groupRef.current.position.copy(p);
        groupRef.current.rotation.x += delta * 10;
        groupRef.current.rotation.z += delta * 8;

        if (!hitFired.current && p.distanceTo(endPos.current) < 0.45) {
          hitFired.current = true;
          onHit();
        }
        break;
      }

      case "shaking": {
        shakeStart.current += delta;
        groupRef.current.visible = true;
        groupRef.current.position.copy(endPos.current);

        const t = shakeStart.current;
        const shakeCount = 3;
        const shakeDuration = 0.4;
        const totalShake = shakeCount * shakeDuration;

        if (t < totalShake) {
          const progress = (t % shakeDuration) / shakeDuration;
          const swing = Math.sin(progress * Math.PI * 2) * 0.18;
          const dampening = 1 - (t / totalShake) * 0.5;
          groupRef.current.rotation.z = swing * dampening;
          groupRef.current.rotation.y = swing * 0.3 * dampening;
        } else {
          groupRef.current.rotation.z = THREE.MathUtils.lerp(
            groupRef.current.rotation.z, 0, 0.1
          );
          groupRef.current.rotation.y = THREE.MathUtils.lerp(
            groupRef.current.rotation.y, 0, 0.1
          );
        }

        setGlow(0.15, "#38bdf8");
        break;
      }

      case "captured": {
        groupRef.current.visible = true;
        groupRef.current.position.copy(endPos.current);
        groupRef.current.rotation.y += delta * 1.5;
        groupRef.current.rotation.z = THREE.MathUtils.lerp(
          groupRef.current.rotation.z, 0, 0.1
        );
        setGlow(0.4, "#fbbf24");
        break;
      }

      case "fled": {
        groupRef.current.visible = false;
        setGlow(0);
        break;
      }

      default: {
        groupRef.current.visible = false;
        elapsed.current = 0;
        setGlow(0);
      }
    }
  });

  return (
    <group ref={groupRef} visible={false} renderOrder={5} scale={ballScale}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

/* ═══════════════════════════════════════════════
   PRELOAD
   ═══════════════════════════════════════════════ */

useGLTF.preload(asset("/models/island.glb"));
useGLTF.preload(asset("/models/suicune.glb"));
useGLTF.preload(asset("/models/pokeball.glb"));
