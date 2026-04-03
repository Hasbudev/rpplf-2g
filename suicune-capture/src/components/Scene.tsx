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
// import { useControls } from "leva";
import { getPokemonConfig, type PokemonConfig } from "../lib/pokemonConfig";

type Phase = "intro" | "idle" | "throwing" | "shaking" | "captured" | "fled";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const asset = (p: string) => `${BASE_PATH}${p}`;
const POKEBALL_SCALE = 0.1;

interface SceneProps {
  phase: Phase;
  onIntroDone: () => void;
  onBallHit: () => void;
  pokemon: string;
}

export function Scene({ phase, onIntroDone, onBallHit, pokemon }: SceneProps) {
  const [debugCam, setDebugCam] = useState(false);
  const cfg = getPokemonConfig(pokemon);

  // // === LEVA DEBUG PANEL — tweak values live, then copy to pokemonConfig.ts ===
  // const island = useControls("Island", {
  //   posX: { value: cfgBase.islandPos[0], min: -20, max: 20, step: 0.1 },
  //   posY: { value: cfgBase.islandPos[1], min: -20, max: 20, step: 0.1 },
  //   posZ: { value: cfgBase.islandPos[2], min: -20, max: 20, step: 0.1 },
  //   scale: { value: cfgBase.islandScale, min: 0.001, max: 0.5, step: 0.001 },
  //   rotY: { value: cfgBase.islandRotationY, min: 0, max: Math.PI * 2, step: 0.01 },
  // });
  // const encounter = useControls("Pokemon", {
  //   posX: { value: cfgBase.encounterPos[0], min: -10, max: 10, step: 0.1 },
  //   posY: { value: cfgBase.encounterPos[1], min: -10, max: 10, step: 0.1 },
  //   posZ: { value: cfgBase.encounterPos[2], min: -10, max: 10, step: 0.1 },
  // });
  // const cam = useControls("Camera", {
  //   posX: { value: cfgBase.camPos[0], min: -20, max: 20, step: 0.1 },
  //   posY: { value: cfgBase.camPos[1], min: -20, max: 20, step: 0.1 },
  //   posZ: { value: cfgBase.camPos[2], min: -20, max: 20, step: 0.1 },
  // });

  // const cfg = {
  //   ...cfgBase,
  //   islandPos: [island.posX, island.posY, island.posZ] as [number, number, number],
  //   islandScale: island.scale,
  //   islandRotationY: island.rotY,
  //   encounterPos: [encounter.posX, encounter.posY, encounter.posZ] as [number, number, number],
  //   camPos: [cam.posX, cam.posY, cam.posZ] as [number, number, number],
  // };
  // // === END LEVA ===

   const ENCOUNTER = useMemo(() => new THREE.Vector3(...cfg.encounterPos), [cfg.encounterPos]);
  const CAM_POS = useMemo(() => new THREE.Vector3(...cfg.camPos), [cfg.camPos]);
  const CAM_LOOK_OFFSET = useMemo(() => new THREE.Vector3(...cfg.camLookAtOffset), [cfg.camLookAtOffset]);

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
        camera={{ position: [cfg.camPos[0], cfg.camPos[1], cfg.camPos[2]], fov: 40, near: 0.1, far: 300 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={[cfg.bgColor]} />
          <fog attach="fog" args={[cfg.fogColor, 40, 120]} />

          {/* === LIGHTING — dynamic per pokemon === */}
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

          {/* Hero spotlight */}
          <spotLight
            position={[ENCOUNTER.x + 1, ENCOUNTER.y + 8, ENCOUNTER.z + 3]}
            intensity={cfg.spotlightIntensity}
            color={cfg.spotlightColor}
            distance={25}
            angle={0.4}
            penumbra={1}
            decay={2}
            castShadow
          />

          {/* Rim light */}
          <pointLight
            position={[ENCOUNTER.x - 5, ENCOUNTER.y + 2, ENCOUNTER.z + 2]}
            intensity={cfg.rimIntensity}
            color={cfg.rimColor}
            distance={18}
            decay={2}
          />

          {/* Accent light */}
          <pointLight
            position={[ENCOUNTER.x + 5, ENCOUNTER.y + 1, ENCOUNTER.z - 1]}
            intensity={2}
            color={cfg.accentLightColor}
            distance={15}
            decay={2}
          />

          {/* Front fill */}
          <pointLight
            position={[ENCOUNTER.x + 3, ENCOUNTER.y + 1, ENCOUNTER.z + 8]}
            intensity={1.2}
            color="#94a3b8"
            distance={15}
            decay={2}
          />

          <Environment preset="night" />

          {/* === WORLD === */}
          <IslandModel cfg={cfg} />
          <LanternFlames cfg={cfg} />
          <Moon cfg={cfg} />
          <Fireflies cfg={cfg} encounter={ENCOUNTER} />

          {/* === VFX === */}
          <FloatingCrystals cfg={cfg} />
          <StarField />

          <Sparkles
            count={100}
            size={1.5}
            speed={0.3}
            opacity={0.25}
            scale={[10, 6, 10]}
            position={[ENCOUNTER.x, ENCOUNTER.y + 2, ENCOUNTER.z]}
            color={cfg.sparkleColor1}
          />
          <Sparkles
            count={50}
            size={0.8}
            speed={0.5}
            opacity={0.2}
            scale={[6, 4, 6]}
            position={[ENCOUNTER.x, ENCOUNTER.y + 2, ENCOUNTER.z]}
            color={cfg.sparkleColor2}
          />

          {/* === ENCOUNTER === */}
          <CameraController
            phase={phase}
            onIntroDone={onIntroDone}
            debugCam={debugCam}
            position={ENCOUNTER}
            camPos={CAM_POS}
            camLookOffset={CAM_LOOK_OFFSET}
          />
          <PokemonAura position={ENCOUNTER} phase={phase} cfg={cfg} />
          <PokemonModel phase={phase} position={ENCOUNTER} cfg={cfg} />
          <PokeballModel
            phase={phase}
            position={ENCOUNTER}
            onHit={onBallHit}
            ballScale={POKEBALL_SCALE}
          />

          <EffectComposer>
            <SMAA />
            <Bloom intensity={0.8} luminanceThreshold={0.15} luminanceSmoothing={0.8} mipmapBlur />
            <Vignette eskil={false} offset={0.2} darkness={0.75} />
          </EffectComposer>

          {debugCam && (
            <OrbitControls makeDefault enableDamping dampingFactor={0.08} enablePan minDistance={2} maxDistance={80} />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}

/* ═══════════════════════════════════════════════ */

function CameraController({ phase, onIntroDone, debugCam, position, camPos, camLookOffset }: {
  phase: Phase; onIntroDone: () => void; debugCam: boolean;
  position: THREE.Vector3; camPos: THREE.Vector3; camLookOffset: THREE.Vector3;
}) {
  const elapsed = useRef(0);
  useEffect(() => { if (phase === "intro") elapsed.current = 0; }, [phase]);

  useFrame((state, delta) => {
    elapsed.current += delta;
    if (!debugCam) {
      const lookAt = position.clone().add(camLookOffset);
      const t = elapsed.current;
      const swayTarget = camPos.clone();
      swayTarget.x += Math.sin(t * 0.25) * 0.08;
      swayTarget.y += Math.sin(t * 0.18) * 0.04;
      swayTarget.z += Math.cos(t * 0.2) * 0.05;
      state.camera.position.lerp(swayTarget, 0.06);
      state.camera.lookAt(lookAt);
    }
    if (!debugCam && phase === "intro" && elapsed.current > 1.5) onIntroDone();
  });
  return null;
}

/* ═══════════════════════════════════════════════ */

function PokemonAura({ position, phase, cfg }: { position: THREE.Vector3; phase: Phase; cfg: PokemonConfig }) {
  const glowRef = useRef<THREE.PointLight>(null!);
  const glowRef2 = useRef<THREE.PointLight>(null!);
  const visible = phase === "idle" || phase === "intro";

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (glowRef.current) {
      glowRef.current.intensity = visible ? 8 + Math.sin(t * 1.2) * 3 : THREE.MathUtils.lerp(glowRef.current.intensity, 0, 0.05);
    }
    if (glowRef2.current) {
      glowRef2.current.intensity = visible ? 5 + Math.sin(t * 1.8 + 1) * 2 : THREE.MathUtils.lerp(glowRef2.current.intensity, 0, 0.05);
    }
  });

  return (
    <group position={[position.x, position.y, position.z]}>
      <pointLight ref={glowRef} position={[0, 0.5, 0.5]} intensity={8} color={cfg.auraColor1} distance={10} decay={2} />
      <pointLight ref={glowRef2} position={[0, 1.5, -1]} intensity={5} color={cfg.auraColor2} distance={8} decay={2} />
    </group>
  );
}

/* ═══════════════════════════════════════════════ */

function IslandModel({ cfg }: { cfg: PokemonConfig }) {
  const { scene } = useGLTF(asset(`/models/${cfg.island}.glb`));
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        const std = m as THREE.MeshStandardMaterial;
        [std.map, std.emissiveMap, std.roughnessMap, std.metalnessMap, std.normalMap]
          .filter(Boolean).forEach((tex) => {
            (tex as THREE.Texture).anisotropy = maxAniso;
            (tex as THREE.Texture).minFilter = THREE.LinearMipmapLinearFilter;
            (tex as THREE.Texture).magFilter = THREE.LinearFilter;
            (tex as THREE.Texture).generateMipmaps = true;
            (tex as THREE.Texture).needsUpdate = true;
          });
      });
    });
  }, [scene, gl]);

  return (
    <primitive
      object={scene}
      position={cfg.islandPos}
      rotation={[0, cfg.islandRotationY, 0]}
      scale={cfg.islandScale}
    />
  );
}

/* ═══════════════════════════════════════════════ */

function LanternFlames({ cfg }: { cfg: PokemonConfig }) {
  // Only show lanterns for suicune island
  if (cfg.name !== "suicune") return null;

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
      ref.current.scale.setScalar(0.04 + Math.sin(t * 2 + position[0] * 10) * 0.01);
    }
    if (lightRef.current) {
      lightRef.current.intensity = 3 + Math.sin(t * 1.5 + position[0] * 5) * 0.8;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color="#fbbf24" emissive="#ff8c00" emissiveIntensity={3} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <pointLight ref={lightRef} intensity={3} color="#ff9933" distance={3} decay={2} />
    </group>
  );
}

/* ═══════════════════════════════════════════════ */

function Moon({ cfg }: { cfg: PokemonConfig }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 0.3) * 0.15;
  });

  return (
    <group position={[-15, 28, -25]}>
      <mesh ref={ref}>
        <sphereGeometry args={[3, 32, 32]} />
        <meshStandardMaterial color="#e8e0d0" emissive={cfg.moonColor} emissiveIntensity={1.2} roughness={1} metalness={0} />
      </mesh>
      <pointLight intensity={2} color={cfg.moonColor} distance={80} decay={2} />
      <mesh>
        <sphereGeometry args={[4.5, 32, 32]} />
        <meshStandardMaterial color={cfg.moonColor} emissive={cfg.moonColor} emissiveIntensity={0.5} transparent opacity={0.08} roughness={1} metalness={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════ */

function Fireflies({ cfg, encounter }: { cfg: PokemonConfig; encounter: THREE.Vector3 }) {
  const flies = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 1 + Math.random() * 3;
      arr.push({
        basePos: [encounter.x + Math.cos(angle) * dist, encounter.y - 0.5 + Math.random() * 1.5, encounter.z + Math.sin(angle) * dist] as [number, number, number],
        speed: 0.4 + Math.random() * 0.6,
        range: 0.2 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 1 + Math.random() * 2,
        color: Math.random() > 0.3 ? cfg.fireflyColor1 : cfg.fireflyColor2,
      });
    }
    return arr;
  }, [cfg, encounter]);

  return <group>{flies.map((f, i) => <Firefly key={i} {...f} />)}</group>;
}

function Firefly({ basePos, speed, range, phase, pulseSpeed, color }: {
  basePos: [number, number, number]; speed: number; range: number; phase: number; pulseSpeed: number; color: string;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.position.x = basePos[0] + Math.sin(t * speed + phase) * range;
      ref.current.position.y = basePos[1] + Math.sin(t * speed * 0.7 + phase + 1) * range * 0.6;
      ref.current.position.z = basePos[2] + Math.cos(t * speed * 0.8 + phase) * range;
      const pulse = 0.4 + Math.sin(t * pulseSpeed + phase) * 0.4;
      (ref.current.material as THREE.MeshStandardMaterial).opacity = Math.max(0.05, pulse);
      ref.current.scale.setScalar(0.02 + pulse * 0.015);
    }
    if (lightRef.current) {
      lightRef.current.intensity = (0.4 + Math.sin(t * pulseSpeed + phase) * 0.4) * 0.8;
    }
  });

  return (
    <group>
      <mesh ref={ref} position={basePos}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <pointLight ref={lightRef} position={basePos} intensity={0.5} color={color} distance={2} decay={2} />
    </group>
  );
}

/* ═══════════════════════════════════════════════ */

function FloatingCrystals({ cfg }: { cfg: PokemonConfig }) {
  const crystals = useMemo(() => {
    const arr = [];
    const colors = [cfg.accentColorHex, cfg.secondaryColor, cfg.glowColor, cfg.auraColor1, cfg.auraColor2];
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 10 + Math.random() * 12;
      arr.push({
        pos: [Math.cos(angle) * dist, -2 + Math.random() * 8, Math.sin(angle) * dist] as [number, number, number],
        scale: 0.06 + Math.random() * 0.18,
        speed: 0.3 + Math.random() * 0.5,
        rotSpeed: 0.2 + Math.random() * 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        floatRange: 0.3 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, [cfg]);

  return <group>{crystals.map((c, i) => <CrystalShard key={i} {...c} />)}</group>;
}

function CrystalShard({ pos, scale, speed, rotSpeed, color, floatRange, phase }: {
  pos: [number, number, number]; scale: number; speed: number; rotSpeed: number; color: string; floatRange: number; phase: number;
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
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.2} metalness={0.8} transparent opacity={0.7} />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════ */

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
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.003; });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.12} color="#a5b4fc" transparent opacity={0.5} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/* ═══════════════════════════════════════════════ */

function PokemonModel({ phase, position, cfg }: { phase: Phase; position: THREE.Vector3; cfg: PokemonConfig }) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene } = useGLTF(asset(`/models/${cfg.model}.glb`));
  const elapsed = useRef(0);

  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
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
      mats.forEach((m) => { if (m) m.opacity = THREE.MathUtils.lerp(m.opacity ?? 1, target, alpha); });
    });
  };

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (!groupRef.current) return;
    const p = position;

    if (phase === "fled") {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, -Math.PI * 0.6, 0.06);
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, p.x + 8, 0.04);
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, p.z - 4, 0.04);
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, p.y + 1, 0.04);
      fadeTo(0, 0.04);
      return;
    }

    groupRef.current.position.set(
      THREE.MathUtils.lerp(groupRef.current.position.x, p.x, 0.1),
      THREE.MathUtils.lerp(groupRef.current.position.y, p.y, 0.1),
      THREE.MathUtils.lerp(groupRef.current.position.z, p.z, 0.1)
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, Math.PI * 0.2, 0.1);

    if (phase === "shaking") fadeTo(0, 0.06);
    else if (phase === "captured") fadeTo(0, 0.1);
    else fadeTo(1, 0.08);
  });

  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={scene} scale={0.065} />
      </Center>
    </group>
  );
}

/* ═══════════════════════════════════════════════ */

function PokeballModel({ phase, position, onHit, ballScale }: {
  phase: Phase; position: THREE.Vector3; onHit: () => void; ballScale: number;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene } = useGLTF(asset("/models/pokeball.glb"));
  const { camera } = useThree();
  const elapsed = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const hitFired = useRef(false);
  const shakeStart = useRef(0);
  const targetCenter = useMemo(() => new THREE.Vector3(position.x, position.y + 0.8, position.z), [position]);

  const materials = useRef<THREE.MeshStandardMaterial[]>([]);
  useEffect(() => {
    materials.current = [];
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
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
    materials.current.forEach((m) => { m.emissive.set(color); m.emissiveIntensity = level; });
  };

  useEffect(() => {
    if (phase === "throwing") {
      elapsed.current = 0; hitFired.current = false;
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      startPos.current.copy(camera.position).add(dir.multiplyScalar(1.2)).add(new THREE.Vector3(0, -0.6, 0));
      endPos.current.copy(targetCenter);
      groupRef.current.visible = true;
      groupRef.current.position.copy(startPos.current);
      groupRef.current.rotation.set(0, 0, 0);
      setGlow(0);
    }
    if (phase === "shaking") shakeStart.current = 0;
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
        if (!hitFired.current && p.distanceTo(endPos.current) < 0.45) { hitFired.current = true; onHit(); }
        break;
      }
      case "shaking": {
        shakeStart.current += delta;
        groupRef.current.visible = true;
        groupRef.current.position.copy(endPos.current);
        const t = shakeStart.current;
        const totalShake = 1.2;
        if (t < totalShake) {
          const progress = (t % 0.4) / 0.4;
          const swing = Math.sin(progress * Math.PI * 2) * 0.18 * (1 - t / totalShake * 0.5);
          groupRef.current.rotation.z = swing;
          groupRef.current.rotation.y = swing * 0.3;
        } else {
          groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.1);
          groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, 0.1);
        }
        setGlow(0.15, "#38bdf8");
        break;
      }
      case "captured": {
        groupRef.current.visible = true;
        groupRef.current.position.copy(endPos.current);
        groupRef.current.rotation.y += delta * 1.5;
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.1);
        setGlow(0.4, "#fbbf24");
        break;
      }
      case "fled": { groupRef.current.visible = false; setGlow(0); break; }
      default: { groupRef.current.visible = false; elapsed.current = 0; setGlow(0); }
    }
  });

  return (
    <group ref={groupRef} visible={false} renderOrder={5} scale={ballScale}>
      <Center><primitive object={scene} /></Center>
    </group>
  );
}

/* ═══════════════════════════════════════════════ */

useGLTF.preload(asset("/models/pokeball.glb"));
