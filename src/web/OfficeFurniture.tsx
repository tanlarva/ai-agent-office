import type { OfficeTheme } from '../shared/office-scene';

type Vector = [number, number, number];
export const materials = { metal: '#26343d', bot: '#e7e6de', visor: '#15282f', paper: '#ece5d2', leaf: '#71977d' };
export function Block({ position, size, color, glow = false }: { position: Vector; size: Vector; color: string; glow?: boolean }) {
  return <mesh position={position} castShadow={!glow} receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.65} emissive={glow ? color : undefined} emissiveIntensity={glow ? 0.45 : 0} /></mesh>;
}
function Disc({ position, radius, height, color, sides = 40 }: { position: Vector; radius: number; height: number; color: string; sides?: number }) {
  return <mesh position={position} castShadow receiveShadow><cylinderGeometry args={[radius, radius, height, sides]} /><meshStandardMaterial color={color} roughness={0.75} /></mesh>;
}
export function Workstation({ x, z, color, theme, index, active }: { x: number; z: number; color: string; theme: OfficeTheme; index: number; active: boolean }) {
  return <group position={[x, 0, z]}>
    <Block position={[0, 0.02, 0.4]} size={[3.25, 0.035, 2.9]} color={theme.rug} />
    <Block position={[0, 1.12, 0]} size={[2.65, 0.14, 1.22]} color={theme.desk} />
    {[-1, 1].map(side => <Block key={side} position={[side, 0.54, 0]} size={[0.1, 1.05, 0.85]} color={materials.metal} />)}
    <Block position={[-0.2, 1.66, -0.24]} size={[1.15, 0.71, 0.1]} color={materials.metal} />
    <Block position={[-0.2, 1.67, -0.18]} size={[1.03, 0.58, 0.025]} color={active ? theme.accent : theme.edge} glow={active} />
    {[0, 1, 2].map(line => <Block key={line} position={[-0.44 + line * 0.08, 1.81 - line * 0.15, -0.162]} size={[0.43 + (index + line) % 3 * 0.12, 0.035, 0.012]} color={active ? materials.paper : theme.wall} />)}
    <Block position={[-0.2, 1.3, -0.24]} size={[0.1, 0.28, 0.1]} color={materials.metal} />
    <Block position={[-0.2, 1.23, 0.24]} size={[0.76, 0.05, 0.27]} color={materials.metal} />
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
    {[[0, 1.4, 0], [-0.21, 1.12, 0], [0.2, 1.06, 0.08]].map((p, i) => <mesh key={i} position={p as Vector} scale={[0.31, 0.6, 0.28]} castShadow><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={materials.leaf} flatShading /></mesh>)}
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
      {Array.from({ length: 7 }, (_, i) => <group key={i}><Block position={[0, 0.35 + i * 0.33, 0.345]} size={[0.93, 0.18, 0.03]} color={theme.wall} /><Block position={[0.33, 0.35 + i * 0.33, 0.37]} size={[0.08, 0.06, 0.03]} color={theme.accent} glow /></group>)}
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
        <mesh position={[-0.77, 0.1, 0.12]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.47, 0.47, 0.04, i === 1 ? 3 : 40]} /><meshStandardMaterial color={i % 2 ? theme.secondary : theme.accent} /></mesh>
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
    {theme.feature === 'swatches' && <mesh position={[0, 1.22, 0]} castShadow><icosahedronGeometry args={[0.25, 0]} /><meshStandardMaterial color={theme.accent} flatShading metalness={0.25} roughness={0.3} /></mesh>}
    {theme.feature === 'lounge' && [-1, 1].map(side => <group key={side} position={[side * 1.65, 0, 0]}><Block position={[0, 0.45, 0]} size={[0.75, 0.35, 1.1]} color={theme.accent} /><Block position={[side * 0.25, 0.85, 0]} size={[0.2, 0.65, 1.1]} color={theme.edge} /></group>)}
  </group>;
}
export function OfficeRoom({ theme }: { theme: OfficeTheme }) {
  return <group>
    <Block position={[0, -0.22, 0.5]} size={[15.6, 0.44, 12.7]} color={theme.floor} />
    <gridHelper args={[15, 15, theme.edge, theme.floor]} position={[0, 0.008, 0.5]} />
    <Block position={[0, 1.85, -5.18]} size={[15.6, 3.7, 0.17]} color={theme.wall} />
    <Block position={[-7.68, 1.15, 0.5]} size={[0.16, 2.3, 11.3]} color={theme.wall} />
    <Block position={[0, 3.5, -5.04]} size={[14.9, 0.045, 0.07]} color={theme.accent} glow />
    <Block position={[0, 0.025, 4.8]} size={[12.8, 0.025, 0.07]} color={theme.edge} />
    {[-6.5, 6.5].map(x => <Block key={x} position={[x, 0.025, 1.8]} size={[0.07, 0.025, 6.1]} color={theme.edge} />)}
    <FeatureWall theme={theme} /><Board theme={theme} />
    <CollaborationTable theme={theme} />
    <Plant x={-5.1} z={3.95} theme={theme} /><Plant x={6.6} z={-2.9} theme={theme} />
    <mesh position={[0, 0.035, 4.8]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.05, 1.1, 48]} /><meshBasicMaterial color={theme.accent} transparent opacity={0.55} /></mesh>
    {[-1, 1].map(side => <Block key={side} position={[side * 1.3, 0.035, 4.8]} size={[0.25, 0.025, 0.08]} color={theme.secondary} glow />)}
  </group>;
}
