import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { OfficeEvent, Run, Task } from '../shared/contracts';
import { officeThemeForRun, stationFor } from '../shared/office-scene';
import { buildFeed } from './debugFeed';
import { rolesForRun, stateLabels } from './labels';
import { OfficeRoom, Workstation } from './OfficeFurniture';
import { OfficeAgent } from './OfficeAgent';

const target = [0, 0.5, 0.5] as const;
function fitZoom(width: number, height: number) { return Math.min(width / 20.5, height / 15.5); }

/** Orbit around the office with damping; demand rendering is kept by invalidating on change. */
function CameraRig({ interactive }: { interactive: boolean }) {
  const { camera, size, gl, invalidate } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const orthographic = camera as OrthographicCamera;
    const fit = fitZoom(size.width, size.height);
    orthographic.zoom = fit; orthographic.lookAt(...target); orthographic.updateProjectionMatrix();
    if (controls.current) { controls.current.minZoom = fit * 0.75; controls.current.maxZoom = fit * 2.6; controls.current.update(); }
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  useEffect(() => {
    if (!interactive) return;
    const fit = fitZoom(size.width, size.height);
    const value = new OrbitControls(camera, gl.domElement);
    Object.assign(value, { enableDamping: true, dampingFactor: 0.12, enablePan: false, minPolarAngle: 0.45, maxPolarAngle: 1.2, minAzimuthAngle: -0.35, maxAzimuthAngle: 1.75, minZoom: fit * 0.75, maxZoom: fit * 2.6, zoomSpeed: 0.8, rotateSpeed: 0.6 });
    value.target.set(...target); value.update();
    const change = () => invalidate();
    const reset = () => { value.reset(); (camera as OrthographicCamera).zoom = fitZoom(gl.domElement.clientWidth, gl.domElement.clientHeight); camera.updateProjectionMatrix(); invalidate(); };
    value.saveState();
    value.addEventListener('change', change);
    gl.domElement.addEventListener('dblclick', reset);
    controls.current = value;
    return () => { value.removeEventListener('change', change); gl.domElement.removeEventListener('dblclick', reset); value.dispose(); controls.current = null; };
    // Recreate only when interactivity or the renderer changes; size updates are handled above.
  }, [camera, gl, interactive, invalidate]);
  useFrame(() => { if (controls.current?.update()) invalidate(); });
  return null;
}

/** Low-rate heartbeat for idle life (blinks, LEDs, swaying) without running a full 60 fps loop. */
function AmbientTicker({ enabled }: { enabled: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') invalidate(); }, 1000 / 20);
    return () => clearInterval(timer);
  }, [enabled, invalidate]);
  return null;
}

/** Drops resolution on slow GPUs: measures real frame time and lowers DPR once, never raises above the cap. */
function AdaptiveResolution() {
  const { setDpr, viewport } = useThree();
  const samples = useRef<number[]>([]);
  const lowered = useRef(false);
  useFrame((_, delta) => {
    if (lowered.current || delta > 0.5) return;
    samples.current.push(delta);
    if (samples.current.length < 90) return;
    const average = samples.current.reduce((a, b) => a + b, 0) / samples.current.length;
    samples.current = [];
    if (average > 1 / 38 && viewport.dpr > 1) { lowered.current = true; setDpr(1); }
  });
  return null;
}

function screenLines(events: readonly OfficeEvent[], task: Task | undefined): string[] {
  if (!task) return [];
  return buildFeed(events, task.id, 12).flatMap(entry => entry.kind === 'command'
    ? [`${entry.running ? '›' : entry.exitCode === 0 ? '✓' : entry.exitCode == null ? '·' : '✗'} ${entry.command || entry.tool}`]
    : entry.kind === 'status' ? [(entry.tone === 'user' ? '? ' : '· ') + entry.text] : []).slice(-7);
}

export default function OfficeScene({ run, events = [], reducedMotion, focusTaskId = null, onSelectTask }: {
  run: Run | null; events?: readonly OfficeEvent[]; reducedMotion: boolean; focusTaskId?: string | null; onSelectTask?: (taskId: string) => void;
}) {
  const roles = rolesForRun(run), theme = officeThemeForRun(run);
  const steps = run?.workflow?.steps;
  const lines = useMemo(() => run?.tasks.map(task => screenLines(events, task)) ?? [], [events, run?.tasks]);
  return <Canvas shadows dpr={[1, 1.75]} frameloop="demand" orthographic gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ position: [12, 14, 16], zoom: 35, near: 0.1, far: 100 }} fallback={<div className="scene-fallback">Trình duyệt không hỗ trợ 3D. Theo dõi agent trong bảng phía dưới.</div>}>
    <CameraRig interactive={!!onSelectTask} />
    <AmbientTicker enabled={!reducedMotion} />
    <AdaptiveResolution />
    <color attach="background" args={[theme.background]} />
    <fog attach="fog" args={[theme.background, 26, 48]} />
    <ambientLight intensity={0.85} /><hemisphereLight args={['#e0e7ec', theme.floor, 1.45]} />
    <directionalLight position={[3, 11, 6]} intensity={2.6} color="#ffe6cc" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={0.04} />
    <directionalLight position={[-8, 6, 10]} intensity={0.55} color={theme.accent} />
    <group key={(run?.id ?? 'empty') + ':' + theme.id}>
      <OfficeRoom theme={theme} motion={!reducedMotion} />
      {roles.map((role, index) => {
        const station = stationFor(theme, index), task = run?.tasks[index];
        const status = !task ? 'Chờ nhiệm vụ' : task.state === 'running' ? task.activity ?? stateLabels.running : stateLabels[task.state];
        return <group key={role.id + index}>
          <Workstation x={station[0]} z={station[1]} color={role.color} theme={theme} active={task?.state === 'running'} screenLines={lines[index] ?? []} motion={!reducedMotion} />
          <OfficeAgent station={station} index={index} color={role.color} state={task?.state} kind={steps?.[index]?.kind} provider={task?.provider ?? run?.provider ?? 'codex'}
            name={role.name} status={status} thinking={task?.activity === 'Đang soạn phản hồi…'} selected={!!task && task.id === focusTaskId}
            motionDisabled={reducedMotion} theme={theme} onSelect={task && onSelectTask ? () => onSelectTask(task.id) : undefined} />
        </group>;
      })}
    </group>
  </Canvas>;
}
