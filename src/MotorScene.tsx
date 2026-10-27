import { Component, Suspense, useEffect, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
} from "@react-three/drei";
import * as THREE from "three";
import type { Machine, Thresholds } from "./simulation";
import { condition, severity } from "./simulation";

type Props = {
  machine: Machine;
  thresholds: Thresholds;
  thermal: boolean;
  cutaway: boolean;
  view: string;
  viewTick: number;
};
const tau = Math.PI * 2;
const radial = (i: number, count: number, radius: number): [number, number] => [
  Math.sin((i * tau) / count) * radius,
  Math.cos((i * tau) / count) * radius,
];
function Camera({ view, viewTick }: Pick<Props, "view" | "viewTick">) {
  const { camera } = useThree();
  useEffect(() => {
    const positions: Record<string, [number, number, number]> = {
      Isometric: [5, 3.4, 5],
      Front: [6, 1.1, 0],
      Side: [0, 1.3, 7],
      Top: [0, 7, 0.01],
    };
    camera.position.set(...(positions[view] || positions.Isometric));
    camera.lookAt(0, 0.7, 0);
  }, [view, viewTick, camera]);
  return (
    <OrbitControls
      makeDefault
      target={[0, 0.7, 0]}
      minDistance={3.5}
      maxDistance={12}
      maxPolarAngle={Math.PI / 2.02}
      enableDamping
      enablePan={false}
    />
  );
}
function Cylinder({
  position,
  radius,
  length,
  color = "#8a9da9",
  metalness = 0.8,
  opacity = 1,
  emissive = "#000000",
}: {
  position: [number, number, number];
  radius: number;
  length: number;
  color?: string;
  metalness?: number;
  opacity?: number;
  emissive?: string;
}) {
  return (
    <mesh
      position={position}
      rotation={[0, 0, Math.PI / 2]}
      castShadow={opacity === 1}
      receiveShadow
    >
      <cylinderGeometry args={[radius, radius, length, 48]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={0.32}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
        emissive={emissive}
        emissiveIntensity={0.18}
      />
    </mesh>
  );
}
function Ring({
  x,
  radius,
  tube,
  color,
}: {
  x: number;
  radius: number;
  tube: number;
  color: string;
}) {
  return (
    <mesh position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
      <torusGeometry args={[radius, tube, 10, 48]} />
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.25} />
    </mesh>
  );
}
function Motor({ machine, thermal, cutaway, thresholds }: Props) {
  const assembly = useRef<THREE.Group>(null),
    rotating = useRef<THREE.Group>(null),
    motion = useRef<THREE.Mesh>(null),
    speed = useRef(0),
    elapsed = useRef(0);
  const active = machine.power && machine.running && machine.params.rpm > 0;
  const tempLevel = severity(
    "temperature",
    machine.params.temperature,
    thresholds,
  );
  const vibrationLevel = severity(
    "vibration",
    machine.params.vibration,
    thresholds,
  );
  const currentLevel = severity("current", machine.params.current, thresholds);
  const status = condition(machine.params, thresholds);
  const thermalColor =
    machine.params.temperature > 90
      ? "#d74d39"
      : machine.params.temperature >= 70
        ? "#c88a35"
        : "#267d91";
  const casingColor =
    tempLevel === "Critical"
      ? "#b7453d"
      : tempLevel === "Warning"
        ? "#a87e3f"
        : thermal
          ? thermalColor
          : "#357b83";
  const bearingColor =
    vibrationLevel === "Critical"
      ? "#ed6752"
      : vibrationLevel === "Warning"
        ? "#d5a24c"
        : "#a9bac4";
  const terminalColor =
    currentLevel === "Critical"
      ? "#c34539"
      : currentLevel === "Warning"
        ? "#b7813c"
        : "#376b76";
  const stressColor =
    machine.params.load >= 90
      ? "#ec8860"
      : machine.params.load >= 70
        ? "#c2a063"
        : "#378390";
  useEffect(() => {
    speed.current = 0;
    elapsed.current = 0;
    if (rotating.current) rotating.current.rotation.x = 0;
  }, [machine.id]);
  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05);
    // The view deliberately uses a bounded visual speed, not physical RPM, to avoid strobing.
    if (!active) speed.current = 0;
    else if (!machine.paused)
      speed.current = THREE.MathUtils.damp(
        speed.current,
        machine.params.rpm,
        5,
        dt,
      );
    if (machine.paused && active) return;
    elapsed.current += dt;
    if (rotating.current && active)
      rotating.current.rotation.x =
        (rotating.current.rotation.x + (speed.current / 5000) * 18 * dt) % tau;
    if (motion.current) {
      const material = motion.current.material as THREE.MeshBasicMaterial;
      material.opacity = active ? 0.05 + (speed.current / 5000) * 0.23 : 0;
    }
    if (assembly.current) {
      const amplitude = active ? machine.params.vibration * 0.0024 : 0;
      assembly.current.position.y =
        0.95 + Math.sin(elapsed.current * 49) * amplitude;
      assembly.current.rotation.z =
        Math.sin(elapsed.current * 37) * amplitude * 0.25;
    }
  });
  return (
    <group>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[5, 0.13, 2.9]} />
        <meshStandardMaterial
          color="#203441"
          metalness={0.65}
          roughness={0.5}
        />
      </mesh>
      {[-2.25, 2.25].flatMap((x) =>
        [-1.18, 1.18].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.06, z]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.04, 6]} />
            <meshStandardMaterial
              color="#a3b0b7"
              metalness={0.85}
              roughness={0.25}
            />
          </mesh>
        )),
      )}
      {[-0.85, 0.85].map((x) => (
        <group key={x}>
          {[-0.64, 0.64].map((z) => (
            <group key={z}>
              <mesh position={[x, 0.19, z]} castShadow>
                <boxGeometry args={[0.55, 0.34, 0.42]} />
                <meshStandardMaterial
                  color={stressColor}
                  metalness={0.65}
                  roughness={0.4}
                />
              </mesh>
              <mesh position={[x, 0.37, z]}>
                <cylinderGeometry args={[0.075, 0.075, 0.07, 6]} />
                <meshStandardMaterial
                  color="#adbbc5"
                  metalness={0.9}
                  roughness={0.25}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      <group ref={assembly} position={[0, 0.95, 0]}>
        {!cutaway && (
          <Cylinder
            position={[0, 0, 0]}
            radius={0.64}
            length={2.1}
            color={casingColor}
            emissive={tempLevel === "Critical" ? "#8b1b13" : "#000000"}
          />
        )}
        {!cutaway &&
          Array.from({ length: 22 }, (_, i) => {
            const [y, z] = radial(i, 22, 0.67);
            return (
              <mesh
                key={i}
                position={[0, y, z]}
                rotation={[(-i * tau) / 22, 0, 0]}
                castShadow
              >
                <boxGeometry args={[1.98, 0.035, 0.16]} />
                <meshStandardMaterial
                  color={casingColor}
                  metalness={0.7}
                  roughness={0.4}
                />
              </mesh>
            );
          })}
        {[-1.12, 1.12].map((x) => (
          <group key={x}>
            {!cutaway && (
              <Cylinder
                position={[x, 0, 0]}
                radius={0.74}
                length={0.15}
                color={casingColor}
              />
            )}
            <Ring
              x={x + (x > 0 ? 0.08 : -0.08)}
              radius={0.68}
              tube={0.025}
              color="#60969c"
            />
            {Array.from({ length: 8 }, (_, i) => {
              const [y, z] = radial(i, 8, 0.59);
              return (
                <Cylinder
                  key={i}
                  position={[x + (x > 0 ? 0.09 : -0.09), y, z]}
                  radius={0.045}
                  length={0.065}
                  color="#b2c2cb"
                />
              );
            })}
            <Cylinder
              position={[x + (x > 0 ? 0.15 : -0.15), 0, 0]}
              radius={0.25}
              length={0.2}
              color={bearingColor}
            />
            <Ring
              x={x + (x > 0 ? 0.26 : -0.26)}
              radius={0.19}
              tube={0.035}
              color={bearingColor}
            />
            {cutaway &&
              Array.from({ length: 10 }, (_, i) => {
                const [y, z] = radial(i, 10, 0.2);
                return (
                  <mesh key={i} position={[x + (x > 0 ? 0.21 : -0.21), y, z]}>
                    <sphereGeometry args={[0.04, 12, 8]} />
                    <meshStandardMaterial
                      color="#d4dce0"
                      metalness={1}
                      roughness={0.2}
                    />
                  </mesh>
                );
              })}
          </group>
        ))}
        {cutaway &&
          [-0.84, 0.84].map((x) => (
            <Ring key={x} x={x} radius={0.53} tube={0.065} color="#bc7b48" />
          ))}
        <group ref={rotating}>
          <Cylinder
            position={[0.1, 0, 0]}
            radius={0.13}
            length={3.7}
            color="#c0ced5"
          />
          <Cylinder
            position={[0, 0, 0]}
            radius={0.47}
            length={1.8}
            color="#a6aab1"
          />
          {Array.from({ length: 12 }, (_, i) => {
            const [y, z] = radial(i, 12, 0.47);
            return (
              <mesh
                key={i}
                position={[0, y, z]}
                rotation={[(-i * tau) / 12, 0, 0]}
              >
                <boxGeometry args={[1.72, 0.045, 0.055]} />
                <meshStandardMaterial
                  color="#bb8655"
                  metalness={0.9}
                  roughness={0.3}
                />
              </mesh>
            );
          })}
          <Cylinder position={[-1.4, 0, 0]} radius={0.17} length={0.13} />
          {Array.from({ length: 8 }, (_, i) => (
            <group key={i} rotation={[(i * Math.PI) / 4, 0, 0]}>
              <mesh
                position={[-1.43, 0.31, 0]}
                rotation={[0.25, 0.2, 0]}
                castShadow
              >
                <boxGeometry args={[0.07, 0.46, 0.17]} />
                <meshStandardMaterial
                  color="#6b8d9c"
                  metalness={0.8}
                  roughness={0.3}
                />
              </mesh>
            </group>
          ))}
          <Cylinder
            position={[1.67, 0, 0]}
            radius={0.27}
            length={0.35}
            color="#9baeb9"
          />
          {[0, 1, 2, 3].map((i) => {
            const [y, z] = radial(i, 4, 0.24);
            return (
              <mesh key={i} position={[1.67, y, z]}>
                <boxGeometry args={[0.25, 0.08, 0.08]} />
                <meshStandardMaterial color="#30414c" />
              </mesh>
            );
          })}
        </group>
        <mesh
          ref={motion}
          position={[1.88, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <ringGeometry args={[0.3, 0.36, 48]} />
          <meshBasicMaterial
            color="#6cdee3"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {!cutaway && (
          <>
            <Cylinder
              position={[-1.6, 0, 0]}
              radius={0.72}
              length={0.13}
              color="#264b5a"
            />
            {Array.from({ length: 16 }, (_, i) => {
              const [y, z] = radial(i, 16, 0.48);
              return (
                <mesh
                  key={i}
                  position={[-1.675, y, z]}
                  rotation={[(-i * tau) / 16, 0, 0]}
                >
                  <boxGeometry args={[0.015, 0.19, 0.055]} />
                  <meshStandardMaterial color="#101e27" />
                </mesh>
              );
            })}
          </>
        )}
        <mesh position={[0.2, 0.78, 0]} castShadow>
          <boxGeometry args={[0.66, 0.32, 0.57]} />
          <meshStandardMaterial
            color={terminalColor}
            metalness={0.7}
            roughness={0.35}
            emissive={currentLevel === "Critical" ? "#6b1b0d" : "#000000"}
            emissiveIntensity={0.3}
          />
        </mesh>
        <mesh position={[0.2, 0.95, 0]}>
          <boxGeometry args={[0.73, 0.04, 0.64]} />
          <meshStandardMaterial
            color={terminalColor}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        {[-0.04, 0.44].flatMap((x) =>
          [-0.22, 0.22].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.98, z]}>
              <cylinderGeometry args={[0.028, 0.028, 0.02, 6]} />
              <meshStandardMaterial
                color="#c5ccce"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>
          )),
        )}
        <mesh position={[0.2, 0.75, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.2, 16]} />
          <meshStandardMaterial
            color="#a7b2b7"
            metalness={0.8}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[-0.55, 0.73, 0]}>
          <torusGeometry args={[0.1, 0.028, 10, 24]} />
          <meshStandardMaterial
            color="#91a6af"
            metalness={0.9}
            roughness={0.3}
          />
        </mesh>
        {!cutaway && (
          <mesh position={[0.1, 0.25, 0.706]}>
            <boxGeometry args={[0.55, 0.22, 0.025]} />
            <meshStandardMaterial
              color="#bbc4c6"
              metalness={0.8}
              roughness={0.25}
            />
          </mesh>
        )}
        <pointLight
          position={[0, 0.3, 1]}
          color={
            status === "Critical"
              ? "#f04c4c"
              : thermal
                ? thermalColor
                : "#4bdddb"
          }
          intensity={status === "Critical" ? 3 : thermal ? 2 : 0.3}
          distance={3}
        />
      </group>
      <mesh
        position={[0, -0.085, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0e1823" roughness={0.8} />
      </mesh>
      <Grid
        position={[0, -0.077, 0]}
        args={[18, 18]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#263a46"
        sectionSize={2}
        sectionColor="#304b58"
        fadeDistance={16}
        infiniteGrid
      />
      <ContactShadows
        position={[0, -0.075, 0]}
        opacity={0.45}
        scale={10}
        blur={2.5}
        far={4}
        resolution={256}
        frames={1}
      />
    </group>
  );
}
function Fallback() {
  return (
    <div className="webgl-fallback" role="status">
      <b>3D rendering unavailable</b>
      <p>
        Enable WebGL or hardware acceleration. Manual controls, diagnostics and
        reports remain available.
      </p>
    </div>
  );
}
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? <Fallback /> : this.props.children;
  }
}
export default function MotorScene(props: Props) {
  return (
    <Boundary>
      <Suspense
        fallback={
          <div className="webgl-fallback" role="status">
            Preparing digital twin…
          </div>
        }
      >
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [5, 3.4, 5], fov: 38 }}
          gl={{ antialias: true }}
          fallback={<Fallback />}
        >
          <color attach="background" args={["#101b27"]} />
          <fog attach="fog" args={["#101b27", 10, 25]} />
          <ambientLight intensity={0.8} />
          <hemisphereLight args={["#c9edff", "#1c2832", 1.6]} />
          <directionalLight
            position={[3, 7, 4]}
            intensity={3}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight
            position={[-4, 3, -3]}
            intensity={2}
            color="#66b6c7"
          />
          <Environment resolution={128}>
            <Lightformer
              position={[0, 5, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[8, 5, 1]}
              intensity={2}
            />
            <Lightformer
              position={[-4, 2, 0]}
              rotation={[0, Math.PI / 2, 0]}
              scale={[5, 2, 1]}
              intensity={1.5}
              color="#c5e9f1"
            />
          </Environment>
          <Motor {...props} />
          <Camera view={props.view} viewTick={props.viewTick} />
        </Canvas>
      </Suspense>
    </Boundary>
  );
}
