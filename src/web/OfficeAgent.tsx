import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace, SpriteMaterial, type Group, type Mesh } from 'three';
import type { ProviderId, State } from '../shared/contracts';
import type { WorkflowStep } from '../shared/workflows';
import { dockFor, handoffPath, isLivePose, pathLength, samplePath, shouldHandoff, type OfficeTheme, type Point } from '../shared/office-scene';
import { Block, cylinder, geometries, material, materials } from './OfficeFurniture';
import { AnimeModel, type ModelStatus } from './AnimeModel';
import type { CastMember } from './anime-cast';
import { restingMotion } from './agent-pose';

interface Journey { points: readonly Point[]; back: readonly Point[]; length: number; elapsed: number }
const providerColor: Record<ProviderId, string> = { codex: '#7ed7df', claude: '#e48a64' };
// The fixed isometric camera sits at +x/+z; facing it reads as "looking at the user".
const towardUser = Math.atan2(12, 16);
const damp = (current: number, target: number, lambda: number, dt: number) => current + (target - current) * (1 - Math.exp(-lambda * dt));
const dampAngle = (current: number, target: number, lambda: number, dt: number) => {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-lambda * dt));
};

/** Floating name tag drawn once per change into a canvas sprite: role, and what it is doing now. */
function NameTag({ name, status, color, height = 2.66 }: { name: string; status: string; color: string; height?: number }) {
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 128 }), []);
  const texture = useMemo(() => { const value = new CanvasTexture(canvas); value.colorSpace = SRGBColorSpace; return value; }, [canvas]);
  const sprite = useMemo(() => new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }), [texture]);
  useEffect(() => {
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, 512, 128);
    context.fillStyle = 'rgba(12, 18, 16, 0.82)';
    context.beginPath(); context.roundRect(8, 10, 496, 108, 26); context.fill();
    context.fillStyle = color; context.beginPath(); context.arc(44, 46, 11, 0, Math.PI * 2); context.fill();
    context.font = '700 34px "Segoe UI", system-ui, sans-serif'; context.fillStyle = '#eef1ea';
    context.fillText(name.length > 22 ? name.slice(0, 21) + '…' : name, 66, 58);
    context.font = '500 26px "Segoe UI", system-ui, sans-serif'; context.fillStyle = '#b6c0b1';
    context.fillText(status.length > 34 ? status.slice(0, 33) + '…' : status, 30, 98);
    texture.needsUpdate = true;
  }, [canvas, texture, name, status, color]);
  useEffect(() => () => { texture.dispose(); sprite.dispose(); }, [texture, sprite]);
  return <sprite material={sprite} position={[0, height, 0]} scale={[2.4, 0.6, 1]} renderOrder={10} />;
}

function Accessory({ kind, color }: { kind: WorkflowStep['kind'] | undefined; color: string }) {
  // Visual role cue only: planner headset, builder cap, QA magnifier, reviewer glasses.
  if (kind === 'plan') return <group position={[0, 1.24, 0]}>
    <mesh geometry={cylinder(16)} material={material(materials.metal)} position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.04, 0.72, 0.04]} />
    {[-1, 1].map(side => <mesh key={side} geometry={cylinder(14)} material={material(color)} position={[side * 0.36, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.11, 0.07, 0.11]} />)}
    <Block position={[0.3, -0.12, 0.2]} size={[0.04, 0.04, 0.22]} color={materials.metal} />
  </group>;
  if (kind === 'work') return <group position={[0, 1.52, 0]}>
    <mesh geometry={cylinder(20)} material={material(color, false, 0.4)} scale={[0.3, 0.16, 0.3]} />
    <Block position={[0, -0.06, 0.25]} size={[0.42, 0.035, 0.2]} color={color} />
  </group>;
  if (kind === 'review') return <group position={[0, 1.25, 0.36]}>
    {[-1, 1].map(side => <mesh key={side} rotation={[0, 0, 0]} position={[side * 0.12, 0, 0]}><torusGeometry args={[0.075, 0.014, 6, 18]} /><meshStandardMaterial color={materials.metal} /></mesh>)}
    <Block position={[0, 0, 0]} size={[0.09, 0.016, 0.016]} color={materials.metal} />
  </group>;
  return null;
}

export function OfficeAgent({ station, index, color, state, kind, provider, name, status, thinking, selected, motionDisabled, theme, onSelect, anime = false, member, onModelStatus }: {
  station: Point; index: number; color: string; state: State | undefined; kind?: WorkflowStep['kind']; provider: ProviderId;
  name: string; status: string; thinking: boolean; selected: boolean; motionDisabled: boolean; theme: OfficeTheme; onSelect?: () => void; anime?: boolean; member?: CastMember; onModelStatus?: (id: string, status: ModelStatus) => void;
}) {
  const [modelLoaded, setModelLoaded] = useState(false);
  const motion = useRef(restingMotion());
  const handleModelStatus = useCallback((id: string, status: ModelStatus) => {
    setModelLoaded(status === 'ready'); onModelStatus?.(id, status);
  }, [onModelStatus]);
  const bubbleHeight = member && modelLoaded ? member.height + 0.35 : 2.05;
  const root = useRef<Group>(null), body = useRef<Group>(null), head = useRef<Group>(null);
  const leftArm = useRef<Group>(null), rightArm = useRef<Group>(null), leftLeg = useRef<Group>(null), rightLeg = useRef<Group>(null);
  const leftEye = useRef<Mesh>(null), rightEye = useRef<Mesh>(null), magnifier = useRef<Group>(null);
  const parcel = useRef<Group>(null), bubble = useRef<Group>(null), dots = useRef<Group>(null), halo = useRef<Mesh>(null);
  const journey = useRef<Journey | null>(null), previous = useRef(state), phase = useRef(index * 0.9);
  const blink = useRef({ next: 2 + index * 0.7, until: 0 });
  const pose = useRef({ heading: Math.PI * 0.16, bodyY: 0, lean: 0, headX: 0, headY: 0, lArmX: 0, lArmZ: 0, rArmX: 0, rArmZ: 0, walk: 0, tap: 0 });
  const invalidate = useThree(s => s.invalidate), home = dockFor(station);
  useEffect(() => {
    if (!motionDisabled && shouldHandoff(previous.current, state)) {
      const points = handoffPath(station, index);
      journey.current = { points, back: [...points].reverse(), length: pathLength(points), elapsed: 0 };
    }
    previous.current = state;
    if (motionDisabled || state === 'failed' || state === 'canceled' || state === 'interrupted') journey.current = null;
    invalidate();
  }, [state, motionDisabled, station, index, invalidate]);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);
  useFrame((_, delta) => {
    if (!root.current || !body.current) return;
    const dt = Math.min(delta, 0.05), p = pose.current;
    phase.current += dt;
    const t = phase.current;
    let walking = false, carrying = false, atDelivery = false, x = home[0], z = home[1], heading = 0;
    const trip = journey.current;
    if (trip && !motionDisabled) {
      trip.elapsed += dt;
      const outgoing = trip.length / 3.2, hold = 1.4;
      atDelivery = trip.elapsed >= outgoing && trip.elapsed < outgoing + hold;
      carrying = trip.elapsed < outgoing + hold * 0.45;
      const returning = trip.elapsed >= outgoing + hold;
      const sample = samplePath(returning ? trip.back : trip.points, (returning ? trip.elapsed - outgoing - hold : trip.elapsed) * 3.2);
      [x, z] = sample.position; heading = atDelivery ? towardUser : sample.heading;
      walking = !atDelivery && !sample.finished;
      if (returning && sample.finished) journey.current = null;
    }
    const live = isLivePose(state), still = motionDisabled;
    const mode = walking ? 'walk' : atDelivery ? 'celebrate' : state === 'running' ? 'work' : state === 'waiting_input' ? 'ask' : state === 'waiting_approval' ? 'approve' : state === 'waiting_capacity' ? 'wait' : state === 'failed' ? 'sad' : state === 'succeeded' ? 'happy' : 'idle';
    Object.assign(motion.current, { time: t, walking, working: mode === 'work', waiting: ['ask', 'approve', 'wait'].includes(mode), carrying, atDelivery, disabled: still, asking: mode === 'ask', celebrating: mode === 'celebrate', thinking, sad: mode === 'sad' });
    if (!trip || motionDisabled) heading = mode === 'work' ? Math.PI : ['ask', 'approve', 'happy', 'sad'].includes(mode) ? towardUser : Math.PI * 0.16 + (still ? 0 : Math.sin(t * 0.21 + index) * 0.25);
    const typing = thinking ? 5 : 11;
    const target = {
      bodyY: still ? 0 : mode === 'walk' ? Math.abs(Math.sin(t * 11)) * 0.07 : mode === 'celebrate' ? Math.abs(Math.sin(t * 7)) * 0.32 : mode === 'ask' ? Math.abs(Math.sin(t * 3.2)) * 0.06 : Math.sin(t * 1.8) * 0.016,
      lean: mode === 'sad' ? 0.12 : mode === 'work' ? 0.08 : 0,
      headX: mode === 'sad' ? 0.45 : mode === 'work' ? 0.1 + (still ? 0 : Math.sin(t * 2.3) * 0.04) : mode === 'wait' ? 0.32 : thinking ? -0.18 : 0,
      headY: still ? 0 : mode === 'idle' ? Math.sin(t * 0.5 + index) * 0.4 : mode === 'approve' ? Math.sin(t * 0.9) * 0.15 : mode === 'work' ? Math.sin(t * 0.65) * 0.1 : 0,
      lArmX: mode === 'work' ? -0.95 + (still ? 0 : Math.sin(t * typing) * 0.14) : mode === 'celebrate' ? -2.8 : mode === 'approve' ? -0.6 : mode === 'wait' ? -1.25 : 0,
      lArmZ: mode === 'wait' ? 0.55 : mode === 'celebrate' ? 0.3 : 0,
      rArmX: carrying ? -1.25 : mode === 'work' ? -0.95 - (still ? 0 : Math.sin(t * typing) * 0.14) : mode === 'ask' ? -2.85 : mode === 'celebrate' ? -2.8 : mode === 'approve' ? -0.6 : 0,
      rArmZ: mode === 'ask' ? -0.2 + (still ? 0 : Math.sin(t * 6) * 0.28) : mode === 'celebrate' ? -0.3 : 0,
    };
    const k = 9;
    p.heading = dampAngle(p.heading, heading, walking ? 14 : 5, dt);
    for (const key of ['bodyY', 'lean', 'headX', 'headY', 'lArmX', 'lArmZ', 'rArmX', 'rArmZ'] as const) p[key] = damp(p[key], target[key], k, dt);
    p.walk = damp(p.walk, walking ? 1 : 0, 10, dt);
    p.tap = damp(p.tap, mode === 'approve' && !still ? 1 : 0, 6, dt);
    root.current.position.set(x, 0.08, z);
    root.current.rotation.y = p.heading;
    body.current.position.y = p.bodyY;
    body.current.rotation.x = p.lean;
    body.current.rotation.z = p.walk * Math.sin(t * 11) * 0.035;
    const stride = Math.sin(t * 11) * 0.55 * p.walk;
    if (head.current) { head.current.rotation.x = p.headX; head.current.rotation.y = p.headY; }
    if (leftLeg.current) leftLeg.current.rotation.x = stride;
    if (rightLeg.current) rightLeg.current.rotation.x = -stride + p.tap * Math.max(0, Math.sin(t * 7)) * -0.35;
    if (leftArm.current) { leftArm.current.rotation.x = p.lArmX - stride * 0.9; leftArm.current.rotation.z = p.lArmZ; }
    if (rightArm.current) { rightArm.current.rotation.x = p.rArmX + (carrying ? 0 : stride * 0.9); rightArm.current.rotation.z = p.rArmZ; }
    if (parcel.current) parcel.current.visible = carrying;
    if (magnifier.current) magnifier.current.rotation.z = mode === 'work' && !still ? Math.sin(t * 1.5) * 0.25 : 0;
    // Blink every few seconds; happy and sad change the eye shape.
    const b = blink.current;
    if (!still && t > b.next) { b.until = t + 0.13; b.next = t + 2.4 + ((index * 1.37 + t) % 2.6); }
    const eyeY = t < b.until ? 0.12 : mode === 'happy' || mode === 'celebrate' ? 0.4 : mode === 'sad' ? 0.55 : 1;
    if (leftEye.current) leftEye.current.scale.y = damp(leftEye.current.scale.y, eyeY * 0.055, 30, dt);
    if (rightEye.current) rightEye.current.scale.y = damp(rightEye.current.scale.y, eyeY * 0.055, 30, dt);
    if (bubble.current) { bubble.current.position.y = bubbleHeight + (still ? 0 : Math.sin(t * 2.6) * 0.06); bubble.current.rotation.y = still ? 0 : Math.sin(t * 1.3) * 0.4; }
    if (dots.current) dots.current.children.forEach((dot, i) => { dot.position.y = still ? 0 : Math.max(0, Math.sin(t * 6 - i * 0.8)) * 0.08; });
    if (halo.current) { const pulse = selected && !still ? 1 + Math.sin(t * 4) * 0.05 : 1; halo.current.scale.set(pulse, pulse, pulse); }
    // Demand rendering: keep frames coming only while something moves; the scene ticker covers idle life.
    if (!still && (journey.current || live || selected || Math.abs(p.heading - heading) > 0.01 || p.walk > 0.01)) invalidate();
  });
  const light = state === 'failed' ? '#ef8f7f' : state === 'succeeded' ? '#a7d5b0' : state === 'canceled' || state === 'interrupted' ? '#8a948c' : color;
  const glow = isLivePose(state);
  const chest = providerColor[provider];
  return <group ref={root} position={[home[0], 0.08, home[1]]}
    onClick={event => { event.stopPropagation(); onSelect?.(); }}
    onPointerOver={event => { event.stopPropagation(); if (onSelect) document.body.style.cursor = 'pointer'; }}
    onPointerOut={() => { document.body.style.cursor = ''; }}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}><circleGeometry args={[0.46, 24]} /><meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} /></mesh>
    <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}><ringGeometry args={[selected ? 0.5 : 0.45, selected ? 0.6 : 0.49, 40]} /><meshBasicMaterial color={selected ? '#ffffff' : glow ? light : theme.edge} transparent opacity={selected ? 0.9 : 0.8} /></mesh>
    <group ref={body}>
      <group visible={!member || !modelLoaded}>
      <group ref={leftLeg} position={[-0.17, 0.38, 0]}><Block position={[0, -0.16, 0]} size={[0.19, 0.31, 0.23]} color={materials.metal} /><Block position={[0, -0.3, 0.05]} size={[0.23, 0.12, 0.32]} color={materials.bot} /></group>
      <group ref={rightLeg} position={[0.17, 0.38, 0]}><Block position={[0, -0.16, 0]} size={[0.19, 0.31, 0.23]} color={materials.metal} /><Block position={[0, -0.3, 0.05]} size={[0.23, 0.12, 0.32]} color={materials.bot} /></group>
      <mesh position={[0, 0.68, 0]} castShadow material={material(materials.bot, false, 0.45)}><capsuleGeometry args={[0.28, 0.32, 4, 14]} /></mesh>
      <Block position={[0, 0.72, 0.262]} size={[0.3, 0.16, 0.03]} color={materials.visor} />
      <mesh geometry={geometries.box} material={material(chest, true)} position={[-0.06, 0.73, 0.28]} scale={[0.05, 0.05, 0.02]} />
      <mesh geometry={geometries.box} material={material(glow ? light : materials.metal, glow)} position={[0.06, 0.73, 0.28]} scale={[0.1, 0.03, 0.02]} />
      <Block position={[0, 0.69, -0.26]} size={[0.3, 0.28, 0.06]} color={color} />
      <group ref={head} position={[0, 1.22, 0]}>
        <mesh castShadow material={material(materials.bot, false, 0.35)}><sphereGeometry args={[0.34, 24, 18]} /></mesh>
        <Block position={[0, 0.01, 0.27]} size={[0.48, 0.22, 0.13]} color={materials.visor} />
        <mesh ref={leftEye} geometry={geometries.box} material={material(light, glow || state === 'succeeded')} position={[-0.11, 0.025, 0.343]} scale={[0.07, 0.055, 0.02]} />
        <mesh ref={rightEye} geometry={geometries.box} material={material(light, glow || state === 'succeeded')} position={[0.11, 0.025, 0.343]} scale={[0.07, 0.055, 0.02]} />
        {anime ? <>{[-1, 1].map(side => <group key={side}>
          <mesh position={[side * 0.24, 0.31, 0]} rotation={[0, Math.PI / 4, side * -0.22]} material={material(materials.bot)}><coneGeometry args={[0.145, 0.29, 4]} /></mesh>
          <mesh position={[side * 0.24, 0.32, 0.07]} rotation={[0, Math.PI / 4, side * -0.22]} material={material(color)}><coneGeometry args={[0.075, 0.18, 4]} /></mesh>
          <Block position={[side * 0.22, -0.09, 0.29]} size={[0.09, 0.035, 0.025]} color={materials.blush} />
        </group>)}</> : <>
          <Block position={[0, 0.4, 0]} size={[0.035, 0.15, 0.035]} color={materials.metal} />
          <mesh position={[0, 0.51, 0]} material={material(chest, glow)}><sphereGeometry args={[0.065, 12, 10]} /></mesh>
        </>}
      </group>
      <Accessory kind={kind} color={color} />
      <group ref={leftArm} position={[-0.37, 0.87, 0]}><Block position={[0, -0.17, 0]} size={[0.14, 0.36, 0.16]} color={materials.bot} /><Block position={[0, -0.36, 0]} size={[0.16, 0.11, 0.18]} color={materials.metal} />
        {kind === 'check' && <group ref={magnifier} position={[0, -0.46, 0.08]}><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.1, 0.022, 6, 20]} /><meshStandardMaterial color={color} /></mesh><Block position={[0, -0.14, 0]} size={[0.035, 0.16, 0.035]} color={materials.metal} /></group>}
      </group>
      <group ref={rightArm} position={[0.37, 0.87, 0]}><Block position={[0, -0.17, 0]} size={[0.14, 0.36, 0.16]} color={materials.bot} /><Block position={[0, -0.36, 0]} size={[0.16, 0.11, 0.18]} color={materials.metal} />
        <group ref={parcel} visible={false} position={[0, -0.42, 0.07]}><Block position={[0, 0, 0]} size={[0.43, 0.31, 0.09]} color={theme.secondary} /><Block position={[0, 0.05, 0.05]} size={[0.3, 0.045, 0.015]} color={materials.paper} /></group>
      </group>
      </group>
      {member && <AnimeModel member={member} motion={motion} color={color} onStatus={handleModelStatus} />}
    </group>
    <group ref={bubble} position={[0, bubbleHeight, 0]}>
      {state === 'waiting_input' && <group><mesh geometry={cylinder(24)} material={material('#f6cb8b', true)} rotation={[Math.PI / 2, 0, 0]} scale={[0.24, 0.05, 0.24]} />
        <Block position={[0.02, 0.07, 0.03]} size={[0.06, 0.12, 0.02]} color={materials.visor} /><Block position={[-0.03, 0.12, 0.03]} size={[0.1, 0.04, 0.02]} color={materials.visor} /><Block position={[0, -0.09, 0.03]} size={[0.05, 0.05, 0.02]} color={materials.visor} /></group>}
      {state === 'waiting_approval' && <group><mesh geometry={cylinder(6)} material={material(color, true)} rotation={[Math.PI / 2, 0, 0]} scale={[0.2, 0.05, 0.24]} /><Block position={[0, 0, 0.03]} size={[0.05, 0.16, 0.02]} color={materials.paper} /></group>}
      {state === 'waiting_capacity' && <group rotation={[0, 0, Math.PI / 4]}><mesh geometry={cylinder(3)} material={material(theme.secondary, true)} position={[0, 0.08, 0]} scale={[0.12, 0.14, 0.12]} /><mesh geometry={cylinder(3)} material={material(theme.secondary, true)} position={[0, -0.08, 0]} rotation={[Math.PI, 0, 0]} scale={[0.12, 0.14, 0.12]} /></group>}
      {state === 'failed' && <group><Block position={[0, 0.05, 0]} size={[0.07, 0.2, 0.05]} color={light} glow /><Block position={[0, -0.12, 0]} size={[0.07, 0.07, 0.05]} color={light} glow /></group>}
      {state === 'succeeded' && <group rotation={[0, 0, -Math.PI / 5]}><Block position={[-0.06, -0.025, 0]} size={[0.06, 0.14, 0.045]} color={light} glow /><Block position={[0.035, 0.045, 0]} size={[0.06, 0.28, 0.045]} color={light} glow /></group>}
      {state === 'running' && thinking && <group ref={dots}>{[-1, 0, 1].map(i => <mesh key={i} geometry={geometries.box} material={material(light, true)} position={[i * 0.13, 0, 0]} scale={[0.07, 0.07, 0.07]} />)}</group>}
    </group>
    <NameTag name={name} status={status} color={chest} height={Math.max(2.66, bubbleHeight + 0.55)} />
  </group>;
}
