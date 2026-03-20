"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Center,
  Environment,
  OrbitControls,
  Sparkles,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
} from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* ═══════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════ */

type Phase = "intro" | "idle" | "throwing" | "shaking" | "captured" | "fled";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const asset = (p: string) => `${BASE_PATH}${p}`;

// Encounter position & camera offsets
const ENCOUNTER = new THREE.Vector3(0, 2.9, 6);
const CAM_INTRO_OFFSET = new THREE.Vector3(-4.2, 4.6, 8.2);
const CAM_IDLE_OFFSET = new THREE.Vector3(-3.2, 3.8, 7.0);
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
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-0"
    >
      <Canvas
        dpr={[1, 2]}
        shadows
        camera={{ position: [0, 9, 14], fov: 42, near: 0.1, far: 80 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          logarithmicDepthBuffer: true,
        }}
      >
        {/* Sky & atmosphere */}
        <color attach="background" args={["#050810"]} />
        <fog attach="fog" args={["#050810", 30, 120]} />

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[18, 28, 12]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={80}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
        />

        {/* Subtle rim light for Suicune */}
        <pointLight
          position={[ENCOUNTER.x - 2, ENCOUNTER.y + 3, ENCOUNTER.z + 2]}
          intensity={0.6}
          color="#38bdf8"
          distance={12}
          decay={2}
        />

        <Environment preset="night" />

        {/* World */}
        <TownModel />
        <LogoOverlay />

        {/* Encounter VFX */}
        <EncounterPortal
          phase={phase}
          onIntroDone={onIntroDone}
          debugCam={debugCam}
          position={ENCOUNTER}
        />
        <Sparkles
          count={80}
          size={1.2}
          speed={0.4}
          opacity={0.2}
          scale={[6, 3, 6]}
          position={[ENCOUNTER.x, ENCOUNTER.y + 1.2, ENCOUNTER.z]}
          color="#38bdf8"
        />

        {/* Characters */}
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
            intensity={0.5}
            luminanceThreshold={0.3}
            luminanceSmoothing={0.9}
          />
          <Vignette eskil={false} offset={0.12} darkness={0.65} />
        </EffectComposer>

        {/* Debug orbit (press C) */}
        {debugCam && (
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            enablePan
            minDistance={3}
            maxDistance={80}
          />
        )}
      </Canvas>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TOWN MODEL
   ═══════════════════════════════════════════════ */

function TownModel() {
  const { scene } = useGLTF(asset("/models/town.glb"));
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy();

    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      mats.forEach((m) => {
        if (!m) return;
        const std = m as THREE.MeshStandardMaterial;
        const textures = [
          std.map,
          std.emissiveMap,
          std.roughnessMap,
          std.metalnessMap,
          std.normalMap,
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
      position={[0, -0.25, 0]}
      rotation={[0, Math.PI, 0]}
      scale={1}
    />
  );
}

/* ═══════════════════════════════════════════════
   LOGO OVERLAY (RPPLF badge in 3D)
   ═══════════════════════════════════════════════ */

function LogoOverlay() {
  const tex = useTexture(asset("/textures/logo.png"));
  const { camera } = useThree();

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  return (
    <mesh
      position={[
        camera.position.x + 13,
        camera.position.y - 9,
        camera.position.z - 9,
      ]}
      scale={1.5}
    >
      <planeGeometry args={[3, 3]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={1}
        toneMapped={false}
        depthTest={false}
      />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════
   ENCOUNTER PORTAL + CAMERA CONTROLLER
   ═══════════════════════════════════════════════ */

function EncounterPortal({
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
  const ringRef = useRef<THREE.Mesh>(null!);
  const diskRef = useRef<THREE.Mesh>(null!);
  const elapsed = useRef(0);

  // Reset timer on intro
  useEffect(() => {
    if (phase === "intro") elapsed.current = 0;
  }, [phase]);

  useFrame((state, delta) => {
    elapsed.current += delta;

    /* ── Camera ── */
    if (!debugCam) {
      const lookAt = new THREE.Vector3(
        position.x,
        position.y + 1.15,
        position.z
      );
      const offset = phase === "intro" ? CAM_INTRO_OFFSET : CAM_IDLE_OFFSET;
      const targetCam = position.clone().add(offset);

      state.camera.position.lerp(targetCam, 0.06);
      state.camera.lookAt(lookAt);
    }

    /* ── Portal animation ── */
    if (!ringRef.current || !diskRef.current) return;

    const pulse = 0.5 + 0.5 * Math.sin(elapsed.current * 2.1);
    const open =
      phase === "intro"
        ? THREE.MathUtils.clamp(elapsed.current / 2.0, 0, 1)
        : 1;

    ringRef.current.scale.setScalar(1 + open * 0.18);
    diskRef.current.scale.setScalar(0.55 + open * 0.55);
    ringRef.current.rotation.z += delta * 0.35;

    const ringMat = ringRef.current.material as THREE.MeshStandardMaterial;
    const diskMat = diskRef.current.material as THREE.MeshStandardMaterial;
    ringMat.emissiveIntensity = 1.4 + pulse * 1.1;
    diskMat.emissiveIntensity = 1.1 + pulse * 1.0;

    // Transition to idle after 2.3s
    if (!debugCam && phase === "intro" && elapsed.current > 2.3) {
      onIntroDone();
    }
  });

  return (
    <group position={[position.x, position.y + 1.2, position.z]}>
      {/* Glowing ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1, 0.085, 16, 96]} />
        <meshStandardMaterial
          color="#87a9ff"
          emissive="#6bb7ff"
          emissiveIntensity={2}
          roughness={0.25}
          metalness={0.6}
        />
      </mesh>

      {/* Inner disk */}
      <mesh ref={diskRef} position={[0, 0, -0.06]} renderOrder={0}>
        <circleGeometry args={[1, 64]} />
        <meshStandardMaterial
          color="#071a2a"
          emissive="#2aa7ff"
          emissiveIntensity={1.6}
          transparent
          opacity={0.16}
          roughness={0.4}
          metalness={0.2}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
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
  const [smokeActive, setSmokeActive] = useState(false);
  const smokePos = useRef(new THREE.Vector3());

  // Setup materials for transparency
  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
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

    // Emerge from portal during intro
    const emerge =
      phase === "intro"
        ? THREE.MathUtils.clamp(elapsed.current / 2, 0, 1)
        : 1;

    const yTarget = THREE.MathUtils.lerp(p.y - 0.8, p.y + 1.1, emerge);
    const zTarget = THREE.MathUtils.lerp(p.z - 2.2, p.z - 0.6, emerge);
    const bob = phase === "idle" ? Math.sin(elapsed.current * 2) * 0.03 : 0;

    if (phase === "fled") {
      // Run away
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        -Math.PI / 2,
        0.12
      );
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        p.x + 4.5,
        0.1
      );
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        p.z - 2.0,
        0.1
      );
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        p.y + 0.2,
        0.1
      );

      smokePos.current.copy(groupRef.current.position);
      if (!smokeActive) setSmokeActive(true);
      fadeTo(0, 0.1);
      return;
    }

    if (smokeActive) setSmokeActive(false);

    groupRef.current.position.set(
      THREE.MathUtils.lerp(groupRef.current.position.x, p.x, 0.1),
      THREE.MathUtils.lerp(groupRef.current.position.y, yTarget + bob, 0.1),
      THREE.MathUtils.lerp(groupRef.current.position.z, zTarget, 0.1)
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      0,
      0.1
    );

    const vanish = phase === "shaking" || phase === "captured";
    fadeTo(vanish ? 0 : 1, vanish ? 0.25 : 0.12);
  });

  return (
    <>
      <group ref={groupRef}>
        <Center>
          <primitive object={scene} scale={0.065} />
        </Center>
      </group>
      <SmokeBurst
        active={smokeActive}
        position={smokePos.current}
        strength={2.2}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════
   SMOKE BURST (when Suicune flees)
   ═══════════════════════════════════════════════ */

function SmokeBurst({
  active,
  position,
  strength = 1,
}: {
  active: boolean;
  position: THREE.Vector3;
  strength?: number;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const elapsed = useRef(0);

  useEffect(() => {
    if (active) elapsed.current = 0;
  }, [active]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (!active) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    elapsed.current += delta;

    const life = Math.min(elapsed.current / 0.85, 1);
    groupRef.current.position.copy(position);
    groupRef.current.scale.setScalar((0.6 + life * 2.4) * strength);

    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;

      mat.opacity = (1 - life) * 0.35 * strength;
      mesh.position.y = i * 0.08 + life * 0.55;
      mesh.position.x =
        (i % 2 === 0 ? 1 : -1) * (0.1 + life * 0.22) * Math.sin(i * 1.7);
      mesh.position.z = (0.1 + life * 0.22) * Math.cos(i * 1.3);
    });
  });

  return (
    <group ref={groupRef} visible={false}>
      {Array.from({ length: 18 }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.22, 10, 10]} />
          <meshStandardMaterial
            color="#cbd5e1"
            transparent
            opacity={0}
            roughness={1}
            metalness={0}
            depthWrite={false}
          />
        </mesh>
      ))}
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

  const targetCenter = useMemo(
    () => new THREE.Vector3(position.x, position.y + 1.1, position.z - 0.6),
    [position]
  );

  // Collect all materials for glow
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
        ? mesh.material
        : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (std && "roughness" in std) {
          if (!std.emissive) std.emissive = new THREE.Color("#000000");
          materials.current.push(std);
        }
      });
    });
  }, [scene]);

  const setGlow = (level: number) => {
    materials.current.forEach((m) => {
      m.emissive.set("#ffffff");
      m.emissiveIntensity = level;
    });
  };

  // Initialize throw trajectory
  useEffect(() => {
    if (phase !== "throwing") return;

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
  }, [phase, camera, targetCenter]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    switch (phase) {
      case "throwing": {
        elapsed.current = Math.min(elapsed.current + delta * 1.7, 1);

        const p = startPos.current.clone().lerp(endPos.current, elapsed.current);
        // Parabolic arc
        p.y += Math.sin(elapsed.current * Math.PI) * 1.6;

        groupRef.current.position.copy(p);
        groupRef.current.rotation.x += delta * 10;
        groupRef.current.rotation.z += delta * 8;

        // Hit detection
        if (!hitFired.current && p.distanceTo(endPos.current) < 0.45) {
          hitFired.current = true;
          onHit();
        }
        break;
      }

      case "shaking": {
        groupRef.current.visible = true;
        groupRef.current.position.copy(endPos.current);

        const shake = Math.sin(Date.now() * 0.02) * 0.22;
        groupRef.current.rotation.y = shake;
        groupRef.current.rotation.z = shake * 0.4;

        setGlow(0.35 + 0.25 * Math.sin(Date.now() * 0.02));
        break;
      }

      case "captured": {
        groupRef.current.visible = true;
        groupRef.current.position.copy(endPos.current);
        groupRef.current.rotation.y += delta * 3;
        setGlow(0.7);
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
   PRELOAD ASSETS
   ═══════════════════════════════════════════════ */

useGLTF.preload(asset("/models/town.glb"));
useGLTF.preload(asset("/models/suicune.glb"));
useGLTF.preload(asset("/models/pokeball.glb"));
