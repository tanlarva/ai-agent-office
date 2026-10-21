import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { State } from '../shared/contracts';
import { dockFor, handoffPath, isLivePose, pathLength, samplePath, shouldHandoff, type OfficeTheme, type Point } from '../shared/office-scene';
import { Block, materials } from './OfficeFurniture';

interface Journey { points: readonly Point[]; back: readonly Point[]; length: number; elapsed: number }
export function OfficeAgent({ station, index, color, state, motionDisabled, theme }: {
  station: Point; index: number; color: string; state: State | undefined; motionDisabled: boolean; theme: OfficeTheme;
}) {
  const root = useRef<Group>(null), body = useRef<Group>(null), head = useRef<Group>(null);
  const leftArm = useRef<Group>(null), rightArm = useRef<Group>(null), leftLeg = useRef<Group>(null), rightLeg = useRef<Group>(null);
  const parcel = useRef<Group>(null), signal = useRef<Group>(null);
  const journey = useRef<Journey | null>(null), previous = useRef(state), phase = useRef(index * 0.9);
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
  useFrame((_, delta) => {
    if (!root.current || !body.current) return;
    const dt = Math.min(delta, 0.05);
    phase.current += dt;
    const t = phase.current;
    let walking = false, carrying = false, atDelivery = false;
    const trip = journey.current;
    if (trip && !motionDisabled) {
      trip.elapsed += dt;
      const outgoing = trip.length / 3.5, hold = 0.9;
      atDelivery = trip.elapsed >= outgoing && trip.elapsed < outgoing + hold;
      carrying = trip.elapsed < outgoing + hold;
      const returning = trip.elapsed >= outgoing + hold;
      const sample = samplePath(returning ? trip.back : trip.points, (returning ? trip.elapsed - outgoing - hold : trip.elapsed) * 3.5);
      root.current.position.set(sample.position[0], 0.08, sample.position[1]);
      root.current.rotation.y = atDelivery ? 0 : sample.heading;
      walking = !atDelivery && !sample.finished;
      if (returning && sample.finished) journey.current = null;
    } else {
      root.current.position.set(home[0], 0.08, home[1]);
      root.current.rotation.y = state === 'running' ? Math.PI : Math.PI * 0.16;
    }
    const live = !motionDisabled && isLivePose(state), working = live && state === 'running', waiting = live && !working;
    body.current.position.y = motionDisabled ? 0 : walking ? Math.abs(Math.sin(t * 12)) * 0.07 : live ? Math.sin(t * 2) * 0.018 : 0;
    body.current.rotation.z = walking ? Math.sin(t * 12) * 0.035 : 0;
    if (head.current) { head.current.rotation.y = waiting ? Math.sin(t * 0.8) * 0.33 : working ? Math.sin(t * 0.65) * 0.09 : 0; head.current.rotation.x = working ? 0.1 : 0; }
    if (leftLeg.current) leftLeg.current.rotation.x = walking ? Math.sin(t * 12) * 0.5 : 0;
    if (rightLeg.current) rightLeg.current.rotation.x = walking ? -Math.sin(t * 12) * 0.5 : 0;
    if (leftArm.current) leftArm.current.rotation.x = walking ? -Math.sin(t * 12) * 0.5 : working ? -0.95 + Math.sin(t * 9) * 0.13 : waiting ? -0.2 : 0;
    if (rightArm.current) { rightArm.current.rotation.x = carrying ? -1.25 : walking ? Math.sin(t * 12) * 0.5 : working ? -0.95 - Math.sin(t * 9) * 0.13 : 0; rightArm.current.rotation.z = atDelivery ? -0.4 : 0; }
    if (parcel.current) parcel.current.visible = carrying;
    if (signal.current) { signal.current.rotation.y = live ? t * 0.7 : 0; signal.current.scale.setScalar(waiting ? 1 + Math.sin(t * 2.5) * 0.08 : 1); }
    // Demand rendering sleeps after finite handoffs and whenever no live pose remains.
    if (!motionDisabled && (journey.current || live)) invalidate();
    else if (trip) invalidate();
  });
  const light = state === 'failed' ? '#e99d8d' : state === 'succeeded' ? '#a7d5b0' : color;
  return <group ref={root} position={[home[0], 0.08, home[1]]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}><ringGeometry args={[0.45, 0.49, 32]} /><meshBasicMaterial color={isLivePose(state) ? light : theme.edge} transparent opacity={0.8} /></mesh>
    <group ref={body}>
      <group ref={leftLeg} position={[-0.17, 0.38, 0]}><Block position={[0, -0.16, 0]} size={[0.19, 0.31, 0.23]} color={materials.metal} /><Block position={[0, -0.3, 0.05]} size={[0.23, 0.12, 0.32]} color={materials.bot} /></group>
      <group ref={rightLeg} position={[0.17, 0.38, 0]}><Block position={[0, -0.16, 0]} size={[0.19, 0.31, 0.23]} color={materials.metal} /><Block position={[0, -0.3, 0.05]} size={[0.23, 0.12, 0.32]} color={materials.bot} /></group>
      <mesh position={[0, 0.68, 0]} castShadow><capsuleGeometry args={[0.28, 0.32, 4, 12]} /><meshStandardMaterial color={materials.bot} roughness={0.5} /></mesh>
      <Block position={[0, 0.69, 0.26]} size={[0.3, 0.1, 0.035]} color={color} />
      <Block position={[0, 0.69, -0.26]} size={[0.3, 0.28, 0.06]} color={color} />
      <group ref={head} position={[0, 1.22, 0]}>
        <mesh castShadow><sphereGeometry args={[0.34, 20, 16]} /><meshStandardMaterial color={materials.bot} roughness={0.4} /></mesh>
        <Block position={[0, 0.01, 0.27]} size={[0.48, 0.2, 0.13]} color={materials.visor} />
        {[-1, 1].map(side => <Block key={side} position={[side * 0.12, 0.025, 0.345]} size={[0.065, state === 'succeeded' ? 0.025 : 0.055, 0.02]} color={light} glow={isLivePose(state)} />)}
        <Block position={[0, 0.4, 0]} size={[0.035, 0.15, 0.035]} color={materials.metal} />
        <mesh position={[0, 0.51, 0]}><sphereGeometry args={[0.065, 10, 8]} /><meshStandardMaterial color={light} emissive={light} emissiveIntensity={isLivePose(state) ? 0.7 : 0.15} /></mesh>
      </group>
      <group ref={leftArm} position={[-0.37, 0.87, 0]}><Block position={[0, -0.17, 0]} size={[0.14, 0.36, 0.16]} color={materials.bot} /><Block position={[0, -0.36, 0]} size={[0.16, 0.11, 0.18]} color={materials.metal} /></group>
      <group ref={rightArm} position={[0.37, 0.87, 0]}><Block position={[0, -0.17, 0]} size={[0.14, 0.36, 0.16]} color={materials.bot} /><Block position={[0, -0.36, 0]} size={[0.16, 0.11, 0.18]} color={materials.metal} />
        <group ref={parcel} visible={false} position={[0, -0.42, 0.07]}><Block position={[0, 0, 0]} size={[0.43, 0.31, 0.09]} color={theme.secondary} /><Block position={[0, 0.05, 0.05]} size={[0.3, 0.045, 0.015]} color={materials.paper} /></group>
      </group>
    </group>
    {(state === 'waiting_capacity' || state === 'waiting_approval') && <group ref={signal} position={[0, 2.02, 0]}><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.13, 0.025, 6, 16]} /><meshBasicMaterial color={state === 'waiting_capacity' ? theme.secondary : color} /></mesh><Block position={[0, 0.03, 0]} size={[0.025, 0.1, 0.025]} color={theme.secondary} /></group>}
    {state === 'succeeded' && <group position={[0, 1.95, 0]} rotation={[0, 0, -Math.PI / 5]}><Block position={[-0.06, -0.025, 0]} size={[0.06, 0.14, 0.045]} color={light} /><Block position={[0.035, 0.045, 0]} size={[0.06, 0.28, 0.045]} color={light} /></group>}
  </group>;
}
