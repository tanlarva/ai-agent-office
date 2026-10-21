import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, CanvasTexture, CylinderGeometry, IcosahedronGeometry, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace, type Mesh } from 'three';
import type { OfficeTheme } from '../shared/office-scene';

type Vector = [number, number, number];
export const materials = { metal: '#26343d', bot: '#e7e6de', visor: '#15282f', paper: '#ece5d2', leaf: '#71977d' };

// One geometry per primitive and one material per colour: hundreds of meshes share GPU buffers and
// shader programs instead of allocating their own. Sizes are applied through mesh scale.
export const geometries = { box: new BoxGeometry(1, 1, 1), ico: new IcosahedronGeometry(1, 1) };
const cylinders = new Map<number, CylinderGeometry>();
export function cylinder(sides: number): CylinderGeometry {
  let geometry = cylinders.get(sides);
  if (!geometry) { geometry = new CylinderGeometry(1, 1, 1, sides); cylinders.set(sides, geometry); }
  return geometry;
}
const standard = new Map<string, MeshStandardMaterial>();
export function material(color: string, glow = false, roughness = 0.65, flat = false): MeshStandardMaterial {
  const key = `${color}|${glow}|${roughness}|${flat}`;
  let value = standard.get(key);
  if (!value) {
    value = new MeshStandardMaterial({ color, roughness, flatShading: flat, ...(glow ? { emissive: color, emissiveIntensity: 0.45 } : {}) });
    standard.set(key, value);
  }
  return value;
}
/** Shared pulsing LED material: one uniform update animates every indicator light. */
const ledMaterials = new Map<string, MeshStandardMaterial>();
function led(color: string): MeshStandardMaterial {
  let value = ledMaterials.get(color);
  if (!value) { value = new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }); ledMaterials.set(color, value); }
  return value;
}
export function useLedPulse(enabled: boolean) {
  useFrame(({ clock }) => {
    if (!enabled) return;
    const t = clock.elapsedTime;
    let i = 0;
    for (const value of ledMaterials.values()) value.emissiveIntensity = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3.1 + i++ * 1.7));
  });
}

export function Block({ position, size, color, glow = false, rotation }: { position: Vector; size: Vector; color: string; glow?: boolean; rotation?: Vector }) {
  // Only meaningful volumes cast shadows; tiny trims would cost shadow-map draws for no visible gain.
  const cast = !glow && size[0] * size[1] * size[2] > 0.004;
  return <mesh geometry={geometries.box} material={material(color, glow)} position={position} rotation={rotation} scale={size} castShadow={cast} receiveShadow />;
}
function Disc({ position, radius, height, color, sides = 40 }: { position: Vector; radius: number; height: number; color: string; sides?: number }) {
  return <mesh geometry={cylinder(sides)} material={material(color, false, 0.75)} position={position} scale={[radius, height, radius]} castShadow receiveShadow />;
}

const screenSize = { width: 320, height: 180 };
/** Monitor surface that shows the real, recorded activity of this role (commands, status). */
function MonitorScreen({ lines, active, accent, idle, motion }: { lines: readonly string[]; active: boolean; accent: string; idle: string; motion: boolean }) {
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), screenSize), []);
  const texture = useMemo(() => { const value = new CanvasTexture(canvas); value.colorSpace = SRGBColorSpace; return value; }, [canvas]);
  const screen = useMemo(() => new MeshBasicMaterial({ map: texture, toneMapped: false }), [texture]);
  const caret = useRef<Mesh>(null);
  useEffect(() => {
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = active ? '#0b1714' : '#141c20'; context.fillRect(0, 0, screenSize.width, screenSize.height);
    context.font = '600 15px Consolas, "Cascadia Mono", monospace';
    if (!lines.length) {
      context.fillStyle = idle; context.globalAlpha = 0.65;
      for (let row = 0; row < 5; row++) context.fillRect(18 + (row % 2) * 16, 26 + row * 28, 120 + ((row * 37) % 110), 7);
      context.globalAlpha = 1;
    }
    lines.slice(-7).forEach((line, row) => {
      context.fillStyle = line.startsWith('✗') ? '#f1a59b' : line.startsWith('✓') ? '#a3cead' : line.startsWith('?') ? '#f6cb8b' : active ? accent : '#9fb0b5';
      context.fillText(line.length > 34 ? line.slice(0, 33) + '…' : line, 12, 24 + row * 23);
    });
    texture.needsUpdate = true;
  }, [canvas, texture, lines, active, accent, idle]);
  useEffect(() => () => { texture.dispose(); screen.dispose(); }, [texture, screen]);
  useFrame(({ clock }) => { if (caret.current) caret.current.visible = active && (!motion || Math.floor(clock.elapsedTime * 2.2) % 2 === 0); });
  const row = Math.min(Math.max(lines.length, 1), 7);
  return <group>
    <mesh material={screen} position={[0, 0, 0]}><planeGeometry args={[1.03, 0.58]} /></mesh>
    <mesh ref={caret} geometry={geometries.box} material={material(accent, true)} position={[-0.47, 0.27 - row * 0.074, 0.004]} scale={[0.035, 0.05, 0.004]} />
  </group>;
}

export function Workstation({ x, z, color, theme, active, screenLines, motion }: { x: number; z: number; color: string; theme: OfficeTheme; active: boolean; screenLines: readonly string[]; motion: boolean }) {
  return <group position={[x, 0, z]}>
    <Block position={[0, 0.02, 0.4]} size={[3.25, 0.035, 2.9]} color={theme.rug} />
    <Block position={[0, 1.12, 0]} size={[2.65, 0.14, 1.22]} color={theme.desk} />
    {[-1, 1].map(side => <Block key={side} position={[side, 0.54, 0]} size={[0.1, 1.05, 0.85]} color={materials.metal} />)}
    <Block position={[-0.2, 1.66, -0.24]} size={[1.15, 0.71, 0.1]} color={materials.metal} />
    <group position={[-0.2, 1.67, -0.184]}><MonitorScreen lines={screenLines} active={active} accent={theme.accent} idle={theme.edge} motion={motion} /></group>
    {active && <pointLight position={[-0.2, 1.7, 0.4]} color={theme.accent} intensity={1.4} distance={2.6} decay={2} />}
    <Block position={[-0.2, 1.3, -0.24]} size={[0.1, 0.28, 0.1]} color={materials.metal} />
    <Block position={[-0.2, 1.23, 0.24]} size={[0.76, 0.05, 0.27]} color={materials.metal} />
    {[0, 1, 2].map(key => <Block key={key} position={[-0.47 + key * 0.27, 1.262, 0.24]} size={[0.2, 0.012, 0.2]} color={active ? theme.accent : theme.wall} glow={active} />)}
    <Block position={[0.77, 1.22, 0.28]} size={[0.38, 0.045, 0.45]} color={theme.feature === 'swatches' ? theme.secondary : materials.paper} />
    <Disc position={[1.05, 1.34, -0.12]} radius={0.1} height={0.25} color={color} sides={12} />
    <Block position={[-1.14, 1.22, 0.32]} size={[0.14, 0.04, 0.24]} color={color} />
    <Block position={[0, 0.1, 1.35]} size={[0.48, 0.035, 0.06]} color={color} glow={active} />
  </group>;
}
function Plant({ x, z, theme }: { x: number; z: number; theme: OfficeTheme }) {
  return <group position={[x, 0, z]}>
    <Disc position={[0, 0.29, 0]} radius={0.29} height={0.58} color={theme.desk} sides={12} />
    <Block position={[0, 0.9, 0]} size={[0.05, 1, 0.05]} color={materials.leaf} />
    {[[0, 1.4, 0], [-0.21, 1.12, 0], [0.2, 1.06, 0.08]].map((p, i) => <mesh key={i} geometry={geometries.ico} material={material(materials.leaf, false, 0.65, true)} position={p as Vector} scale={[0.31, 0.6, 0.28]} castShadow />)}
  </group>;
}
function Board({ theme }: { theme: OfficeTheme }) {
  return <group position={[-7.36, 2, 0.15]}>
    <Block position={[0, 0, 0]} size={[0.12, 1.65, 3.1]} color={theme.desk} />
    <Block position={[0.075, 0, 0]} size={[0.035, 1.43, 2.86]} color={theme.wall} />
    {Array.from({ length: 6 }, (_, i) => <Block key={i} position={[0.105, 0.37 - Math.floor(i / 3) * 0.65, -0.9 + i % 3 * 0.85]} size={[0.025, 0.36, 0.48]} color={i % 2 ? theme.accent : theme.secondary} />)}
  </group>;
}
function FeatureWall({ theme }: { theme: OfficeTheme }) {
  if (theme.feature === 'servers') return <group>
    {[-6.3, 6.3].map(x => <group key={x} position={[x, 0, -4.45]}>
      <Block position={[0, 1.35, 0]} size={[1.15, 2.7, 0.65]} color={materials.metal} />
      {Array.from({ length: 7 }, (_, i) => <group key={i}><Block position={[0, 0.35 + i * 0.33, 0.345]} size={[0.93, 0.18, 0.03]} color={theme.wall} /><mesh geometry={geometries.box} material={led(i % 3 ? theme.accent : theme.secondary)} position={[0.33, 0.35 + i * 0.33, 0.37]} scale={[0.08, 0.06, 0.03]} /></group>)}
    </group>)}
    {[-3, 0, 3].map(x => <group key={x} position={[x, 2.35, -4.99]}><Block position={[0, 0, 0]} size={[2.45, 1.27, 0.05]} color={materials.visor} />{[0, 1, 2, 3].map(i => <Block key={i} position={[-0.5 + i * 0.15, 0.4 - i * 0.25, 0.04]} size={[1.1 + i % 2 * 0.5, 0.045, 0.025]} color={i % 2 ? theme.secondary : theme.accent} glow />)}</group>)}
  </group>;
  if (theme.feature === 'library' || theme.feature === 'editorial' || theme.feature === 'records') return <group>
    {[-5.5, -2.75, 0, 2.75, 5.5].map((x, i) => <group key={x} position={[x, 0, -4.7]}>
      <Block position={[0, 1.7, 0]} size={[2.4, 3.4, 0.4]} color={theme.edge} />
      {[0, 1, 2].map(row => <group key={row}>
        <Block position={[0, 0.55 + row * 0.99, 0.26]} size={[2.2, 0.81, 0.13]} color={theme.wall} />
        {Array.from({ length: theme.feature === 'records' ? 4 : 7 }, (_, j) => <group key={j}>
          <Block position={[-0.91 + j * (theme.feature === 'records' ? 0.59 : 0.29), 0.5 + row * 0.99, 0.36]} size={[theme.feature === 'records' ? 0.48 : 0.18, theme.feature === 'records' ? 0.62 : 0.4 + (i + j) % 3 * 0.13, 0.22]} color={(i + j + row) % 3 ? theme.desk : theme.accent} />
          {theme.feature === 'records' && <Block position={[-0.91 + j * 0.59, 0.55 + row * 0.99, 0.48]} size={[0.22, 0.1, 0.02]} color={theme.wall} />}
        </group>)}
      </group>)}
    </group>)}
  </group>;
  return <group>
    {[-4.5, 0, 4.5].map((x, i) => <group key={x} position={[x, 2.2, -4.96]}>
      <Block position={[0, 0, 0]} size={[3.5, 2.05, 0.1]} color={theme.desk} />
      <Block position={[0, 0, 0.07]} size={[3.22, 1.78, 0.04]} color={theme.rug} />
      {theme.feature === 'process' ? <>
        <Block position={[0, 0, 0.12]} size={[2.55, 0.045, 0.025]} color={theme.secondary} />
        {[-0.95, 0, 0.95].map((offset, n) => <Block key={n} position={[offset, n === 1 ? 0.32 : 0, 0.15]} size={[0.55, 0.43, 0.05]} color={n === 1 ? theme.secondary : theme.accent} />)}
      </> : <>
        <mesh geometry={cylinder(i === 1 ? 3 : 40)} material={material(i % 2 ? theme.secondary : theme.accent)} position={[-0.77, 0.1, 0.12]} rotation={[Math.PI / 2, 0, 0]} scale={[0.47, 0.04, 0.47]} />
        {[0, 1, 2].map(line => <Block key={line} position={[0.62, 0.44 - line * 0.34, 0.15]} size={[0.95 - line * 0.17, 0.1, 0.04]} color={line % 2 ? theme.secondary : theme.accent} />)}
      </>}
    </group>)}
  </group>;
}
function CollaborationTable({ theme }: { theme: OfficeTheme }) {
  return <group position={[0, 0, 0.65]}>
    {theme.feature === 'process' || theme.feature === 'records' ? <Block position={[0, 0.85, 0]} size={[2.8, 0.14, 1.65]} color={theme.desk} /> : <Disc position={[0, 0.85, 0]} radius={1.05} height={0.13} color={theme.desk} sides={theme.feature === 'swatches' ? 6 : 40} />}
    <Block position={[0, 0.42, 0]} size={[0.28, 0.85, 0.28]} color={materials.metal} />
    <Disc position={[0, 0.07, 0]} radius={0.55} height={0.08} color={materials.metal} />
    {[-1, 1].map((side, i) => <group key={side} position={[side * 0.4, 0.95, 0]}>
      <Block position={[0, 0, 0]} size={[0.42, 0.035, 0.52]} color={i ? theme.secondary : theme.accent} />
      <Block position={[0, 0.025, 0]} size={[0.32, 0.01, 0.39]} color={materials.paper} />
    </group>)}
    {theme.feature === 'swatches' && <mesh geometry={geometries.ico} material={material(theme.accent, false, 0.3, true)} position={[0, 1.22, 0]} scale={0.25} castShadow />}
    {theme.feature === 'lounge' && [-1, 1].map(side => <group key={side} position={[side * 1.65, 0, 0]}><Block position={[0, 0.45, 0]} size={[0.75, 0.35, 1.1]} color={theme.accent} /><Block position={[side * 0.25, 0.85, 0]} size={[0.2, 0.65, 1.1]} color={theme.edge} /></group>)}
  </group>;
}
export function OfficeRoom({ theme, motion }: { theme: OfficeTheme; motion: boolean }) {
  useLedPulse(motion);
  return <group>
    <Block position={[0, -0.22, 0.5]} size={[15.6, 0.44, 12.7]} color={theme.floor} />
    <gridHelper args={[15, 15, theme.edge, theme.floor]} position={[0, 0.008, 0.5]} />
    <Block position={[0, 1.85, -5.18]} size={[15.6, 3.7, 0.17]} color={theme.wall} />
    <Block position={[-7.68, 1.15, 0.5]} size={[0.16, 2.3, 11.3]} color={theme.wall} />
    <Block position={[0, 3.5, -5.04]} size={[14.9, 0.045, 0.07]} color={theme.accent} glow />
    <Block position={[0, 0.025, 4.8]} size={[12.8, 0.025, 0.07]} color={theme.edge} />
    {[-6.5, 6.5].map(x => <Block key={x} position={[x, 0.025, 1.8]} size={[0.07, 0.025, 6.1]} color={theme.edge} />)}
    {/* Windows with a soft glow on the back wall */}
    {!['library', 'editorial', 'records', 'servers'].includes(theme.feature) && [-5.6, 5.6].map(x => <group key={x} position={[x, 2.25, -5.08]}><Block position={[0, 0, 0]} size={[1.7, 1.5, 0.04]} color={theme.edge} /><Block position={[0, 0, 0.025]} size={[1.52, 1.32, 0.02]} color={theme.secondary} glow /></group>)}
    <FeatureWall theme={theme} /><Board theme={theme} />
    <CollaborationTable theme={theme} />
    <Plant x={-5.1} z={3.95} theme={theme} /><Plant x={6.6} z={-2.9} theme={theme} />
    <mesh position={[0, 0.035, 4.8]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.05, 1.1, 48]} /><meshBasicMaterial color={theme.accent} transparent opacity={0.55} /></mesh>
    {[-1, 1].map(side => <Block key={side} position={[side * 1.3, 0.035, 4.8]} size={[0.25, 0.025, 0.08]} color={theme.secondary} glow />)}
  </group>;
}
