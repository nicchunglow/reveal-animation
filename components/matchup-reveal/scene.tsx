'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CARD_W, CARD_H, vsTexture } from './textures';

/* ==================================================================
   timing helpers — the three-act structure carried over from v3
================================================================== */
export const T = {
  aIn: 0.1, aLand: 0.48, aOut: 1.6,
  bIn: 1.7, bLand: 2.08, bOut: 3.2,
  conv: 3.28, clash: 3.8, vs: 3.86, rest: 4.3,
};
const SKEW = -0.19;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const snap = (t: number) => 1 - Math.pow(1 - t, 5);

export type BeatKey = 'soloA' | 'soloAout' | 'soloB' | 'soloBout' | 'clash' | 'vs';

/* ==================================================================
   animated backdrop — raw GLSL, the cheapest source of real flash
================================================================== */
const bgVert = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const bgFrag = `
  uniform float uTime;
  uniform float uHeat;
  uniform vec3  uTint;
  uniform float uDir;
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }

  void main(){
    vec2 uv = vUv - 0.5;
    /* shear so the bands run along the same diagonal as the layout */
    uv.x += uv.y * 0.19;

    /* streaking energy bands */
    float flow = uv.x * 6.0 - uTime * uDir * 1.35;
    float bands = sin(flow) * 0.5 + 0.5;
    bands = pow(bands, 6.0);

    /* turbulence so it never reads as a flat gradient */
    float n = noise(vec2(uv.x*3.0 + uTime*0.4*uDir, uv.y*2.2 - uTime*0.2));
    bands *= 0.55 + n * 0.9;

    /* radial falloff keeps the centre clean behind the dancer */
    float r = length(uv * vec2(1.0, 1.5));
    float halo = smoothstep(0.85, 0.06, r);
    float core = smoothstep(0.55, 0.0, r);

    float energy = bands * halo * (0.7 + uHeat * 1.9) + core * (0.10 + uHeat * 0.55);
    vec3 col = uTint * energy;
    col += vec3(1.0, 0.72, 0.55) * core * uHeat * 0.7;   // white-hot centre when charged

    gl_FragColor = vec4(col, 1.0);
  }
`;

function Backdrop({
  tint,
  dir,
  visible,
  heatRef,
}: {
  tint: string;
  dir: number;
  visible: boolean;
  heatRef: React.RefObject<number>;
}) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHeat: { value: 0 },
      uTint: { value: new THREE.Color(tint) },
      uDir: { value: dir },
    }),
    [tint, dir],
  );
  useFrame((_state, dt) => {
    if (!mat.current) return;
    uniforms.uTime.value += dt;
    uniforms.uHeat.value = THREE.MathUtils.lerp(uniforms.uHeat.value, heatRef.current, 0.12);
  });
  return (
    <mesh position={[0, 0, -9]} visible={visible}>
      <planeGeometry args={[60, 34]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={bgVert}
        fragmentShader={bgFrag}
        transparent={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ==================================================================
   a fighter card, with its floor reflection
================================================================== */
export type CardHandle = {
  group: () => THREE.Group | null;
  reflection: () => THREE.Group | null;
};

const Card = React.forwardRef<CardHandle, { texture: THREE.Texture; tint: string }>(
  function Card({ texture, tint }, ref) {
    const grp = useRef<THREE.Group>(null);
    const refl = useRef<THREE.Group>(null);
    React.useImperativeHandle(ref, () => ({
      group: () => grp.current,
      reflection: () => refl.current,
    }));
    return (
      <group>
        <group ref={grp}>
          {/* emissive rim: bright enough to cross the bloom threshold */}
          <mesh position={[0, 0, -0.03]}>
            <planeGeometry args={[CARD_W + 0.12, CARD_H + 0.12]} />
            <meshBasicMaterial color={tint} toneMapped={false} />
          </mesh>
          <mesh>
            <planeGeometry args={[CARD_W, CARD_H]} />
            <meshBasicMaterial map={texture} toneMapped={false} />
          </mesh>
        </group>
        {/* mirrored copy on the floor, faded */}
        <group ref={refl}>
          <mesh scale={[1, -1, 1]}>
            <planeGeometry args={[CARD_W, CARD_H]} />
            <meshBasicMaterial
              map={texture}
              transparent
              opacity={0.16}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>
    );
  },
);

/* ==================================================================
   the diagonal seam — a thin emissive blade that ignites on impact
================================================================== */
function Seam({ igniteRef, visible }: { igniteRef: React.RefObject<number>; visible: boolean }) {
  const core = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const ig = igniteRef.current;
    if (core.current) {
      (core.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + ig * 0.8;
    }
    if (glow.current) {
      (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.08 + ig * 0.7;
      glow.current.scale.x = 1 + ig * 3.2;
    }
  });
  return (
    <group rotation={[0, 0, SKEW]} position={[0, 0, -1.2]} visible={visible}>
      <mesh ref={glow}>
        <planeGeometry args={[2.6, 44]} />
        <meshBasicMaterial
          color="#FF3B1F"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={core}>
        <planeGeometry args={[0.07, 44]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* ==================================================================
   spark burst on the clash
================================================================== */
const SPARKS = 260;
function Sparks({ fireRef }: { fireRef: React.RefObject<boolean> }) {
  const pts = useRef<THREE.Points>(null);
  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(SPARKS * 3);
    const velocities: THREE.Vector3[] = [];
    for (let i = 0; i < SPARKS; i++) {
      const a = (Math.random() - 0.5) * 1.5,
        s = 5 + Math.random() * 16;
      velocities.push(
        new THREE.Vector3(
          Math.cos(a) * s * (Math.random() < 0.5 ? -1 : 1),
          Math.sin(a) * s * 0.8,
          (Math.random() - 0.5) * 4,
        ),
      );
    }
    return { positions, velocities };
  }, []);
  const age = useRef(99);
  useFrame((_state, dt) => {
    if (!pts.current) return;
    if (fireRef.current) {
      fireRef.current = false;
      age.current = 0;
      const p = pts.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < SPARKS; i++) {
        p[i * 3] = 0;
        p[i * 3 + 1] = (Math.random() - 0.5) * 9;
        p[i * 3 + 2] = 0;
      }
    }
    age.current += dt;
    const a = age.current;
    const m = pts.current.material as THREE.PointsMaterial;
    if (a < 1.9) {
      m.opacity = 1 - a / 1.9;
      const p = pts.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < SPARKS; i++) {
        p[i * 3] += velocities[i].x * dt;
        p[i * 3 + 1] += velocities[i].y * dt - 3.8 * a * dt;
        p[i * 3 + 2] += velocities[i].z * dt;
      }
      pts.current.geometry.attributes.position.needsUpdate = true;
    } else m.opacity = 0;
  });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#FFC38A"
        size={0.16}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

/* ==================================================================
   ambient embers
================================================================== */
const EMBERS = 260;
function Embers() {
  const pts = useRef<THREE.Points>(null);
  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(EMBERS * 3);
    const speeds: number[] = [];
    for (let i = 0; i < EMBERS; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 34;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 2] = -8 + Math.random() * 9;
      speeds.push(0.15 + Math.random() * 0.5);
    }
    return { positions, speeds };
  }, []);
  useFrame((_state, dt) => {
    if (!pts.current) return;
    const p = pts.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < EMBERS; i++) {
      p[i * 3 + 1] += speeds[i] * dt;
      if (p[i * 3 + 1] > 11) p[i * 3 + 1] = -11;
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#FF5A2E"
        size={0.07}
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

/* ==================================================================
   the director — owns the clock and drives everything each frame
================================================================== */
export function Director({
  texA,
  texB,
  runId,
  onBeat,
}: {
  texA: THREE.Texture;
  texB: THREE.Texture;
  runId: number;
  onBeat: (key: BeatKey) => void;
}) {
  const { viewport, camera } = useThree();
  const cardA = useRef<CardHandle>(null);
  const cardB = useRef<CardHandle>(null);
  const vsRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const heatA = useRef(0),
    heatB = useRef(0),
    ignite = useRef(0);
  const fireSparks = useRef(false);
  const shake = useRef({ amp: 0, age: 99 });
  const fired = useRef<Record<string, 1>>({});
  const [act, setAct] = useState(1);

  const vsTex = useMemo(() => vsTexture(), []);

  /* ---- responsive geometry: spacing derived from the viewport ---- */
  const L = useMemo(() => {
    const vw = viewport.width,
      vh = viewport.height;
    const vsW = Math.min(vw * 0.28, 5.6),
      vsH = vsW * 0.5;
    let scale = Math.min(1.25, Math.max(0.4, vw / 17));
    let restX = 0;
    for (let i = 0; i < 16; i++) {
      const half = (CARD_W * scale) / 2;
      restX = Math.max(vsW / 2 + half + vw * 0.035, vw * 0.235);
      if (restX + half <= vw / 2 - vw * 0.02) break;
      scale *= 0.92;
    }
    const soloScale = Math.min(scale * 1.45, (vh * 0.6) / CARD_H, (vw * 0.7) / CARD_W);
    return { vw, vh, vsW, vsH, scale, restX, soloScale };
  }, [viewport.width, viewport.height]);

  useEffect(() => {
    t.current = 0;
    fired.current = {};
    setAct(1);
  }, [runId]);

  useFrame((_state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    t.current += dt;
    const now = t.current;
    const A = cardA.current,
      B = cardB.current;
    if (!A || !B) return;

    const gA = A.group()!,
      gB = B.group()!;
    const rA = A.reflection()!,
      rB = B.reflection()!;
    if (!gA || !gB || !rA || !rB) return;

    const beat = (k: string, at: number, fn: () => void) => {
      if (!fired.current[k] && now > at) {
        fired.current[k] = 1;
        fn();
      }
    };
    const kick = (amp: number) => {
      shake.current = { amp, age: 0 };
    };

    /* -------- ACT 1 / ACT 2: one dancer, centred, own backdrop -------- */
    if (now < T.bOut) {
      const first = now < T.aOut;
      if (first && act !== 1) setAct(1);
      if (!first && act !== 2) setAct(2);

      const solo = first ? gA : gB,
        otherG = first ? gB : gA;
      const soloR = first ? rA : rB,
        otherR = first ? rB : rA;
      const p = first ? seg(now, T.aIn, T.aLand) : seg(now, T.bIn, T.bLand);
      const dir = first ? -1 : 1;

      solo.visible = true;
      otherG.visible = false;
      soloR.visible = true;
      otherR.visible = false;

      const x = dir * L.vw * 0.9 * (1 - snap(p));
      const s = L.soloScale * (1 + (1 - snap(p)) * 0.12);
      solo.position.set(x, 0.42, 0);
      solo.rotation.set(0, dir * 0.3 * (1 - snap(p)) + dir * -0.06, SKEW * 0.35);
      solo.scale.set(s, s, 1);

      soloR.position.set(x, 0.42 - CARD_H * s - 0.18, 0);
      soloR.rotation.copy(solo.rotation);
      soloR.scale.set(s, s, 1);

      const heat = Math.sin(clamp01(p) * Math.PI) * 0.55 + 0.28;
      if (first) {
        heatA.current = heat;
        heatB.current = 0;
      } else {
        heatB.current = heat;
        heatA.current = 0;
      }

      beat(first ? 'a' : 'b', first ? T.aLand : T.bLand, () => kick(0.26));
      beat(first ? 'as' : 'bs', first ? T.aLand - 0.02 : T.bLand - 0.02, () =>
        onBeat(first ? 'soloA' : 'soloB'),
      );
      beat(first ? 'ao' : 'bo', first ? T.aOut - 0.24 : T.bOut - 0.24, () =>
        onBeat(first ? 'soloAout' : 'soloBout'),
      );

      ignite.current = 0;
      if (vsRef.current) vsRef.current.scale.setScalar(0.0001);
    }

    /* -------- ACT 3: converge, clash, split screen -------- */ else {
      if (act !== 3) {
        setAct(3);
      }
      gA.visible = gB.visible = true;
      rA.visible = rB.visible = true;
      heatA.current = heatB.current = 0;

      const pc = seg(now, T.conv, T.clash);
      const meet = L.restX * 0.62;
      let xa = -L.vw * 0.85 + (-meet + L.vw * 0.85) * snap(pc);
      let xb = L.vw * 0.85 + (meet - L.vw * 0.85) * snap(pc);
      const pb = seg(now, T.clash, T.rest);
      if (now > T.clash) {
        xa = -L.restX - (1 - ease(pb)) * (L.restX - meet);
        xb = L.restX + (1 - ease(pb)) * (L.restX - meet);
      }

      const idle = now > T.rest ? now - T.rest : 0;
      const ya = -0.18 + (idle ? Math.sin(idle * 0.7) * 0.05 : 0);
      const yb = -0.18 + (idle ? Math.sin(idle * 0.7 + Math.PI) * 0.05 : 0);

      gA.position.set(xa, ya, 0);
      gB.position.set(xb, yb, 0);
      gA.rotation.set(0, 0.42 - 0.1 * snap(pc), SKEW * 0.55);
      gB.rotation.set(0, -0.42 + 0.1 * snap(pc), SKEW * 0.55);
      gA.scale.set(L.scale, L.scale, 1);
      gB.scale.set(L.scale, L.scale, 1);

      const ry = -0.18 - CARD_H * L.scale - 0.16;
      rA.position.set(xa, ry, 0);
      rA.rotation.copy(gA.rotation);
      rA.scale.set(L.scale, L.scale, 1);
      rB.position.set(xb, ry, 0);
      rB.rotation.copy(gB.rotation);
      rB.scale.set(L.scale, L.scale, 1);

      beat('clash', T.clash, () => {
        kick(0.8);
        fireSparks.current = true;
        onBeat('clash');
      });
      beat('vs', T.vs, () => onBeat('vs'));

      const ig = now - T.clash;
      ignite.current = ig > 0 && ig < 1.5 ? 1 - ig / 1.5 : 0;

      /* VS snaps in and then breathes */
      if (vsRef.current) {
        const pv = seg(now, T.vs, T.vs + 0.3);
        const over = pv < 1 ? 3.4 - 2.4 * ease(pv) : 1 + Math.sin((now - T.vs) * 2.2) * 0.012;
        vsRef.current.scale.set(L.vsW * over, L.vsH * over, 1);
        (vsRef.current.material as THREE.MeshBasicMaterial).opacity = pv;
      }
    }

    /* -------- camera: shake with exponential decay -------- */
    shake.current.age += dt;
    const d = Math.exp(-shake.current.age * 10) * shake.current.amp;
    camera.position.x = (Math.random() - 0.5) * d;
    camera.position.y = 0.15 + (Math.random() - 0.5) * d + Math.sin(now * 0.4) * 0.05;
    camera.lookAt(0, -0.05, 0);
  });

  return (
    <>
      <Backdrop tint="#E10600" dir={1} visible={act === 1} heatRef={heatA} />
      <Backdrop tint="#FF3B1F" dir={-1} visible={act === 2} heatRef={heatB} />
      <Seam igniteRef={ignite} visible={act === 3} />
      <Card ref={cardA} texture={texA} tint="#E10600" />
      <Card ref={cardB} texture={texB} tint="#FF3B1F" />
      <mesh ref={vsRef} position={[0, 0, 0.4]} rotation={[0, 0, SKEW]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={vsTex} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <Sparks fireRef={fireSparks} />
      <Embers />
    </>
  );
}
