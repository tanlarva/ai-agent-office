import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';
import type { Run } from '../shared/contracts';
import { officeThemeForRun, stationFor } from '../shared/office-scene';
import { rolesForRun } from './labels';
import { OfficeRoom, Workstation } from './OfficeFurniture';
import { OfficeAgent } from './OfficeAgent';

function FitCamera() {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const orthographic = camera as OrthographicCamera;
    orthographic.zoom = Math.min(size.width / 23, size.height / 17.5);
    orthographic.lookAt(0, 0.5, 0.5); orthographic.updateProjectionMatrix(); invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return null;
}
export default function OfficeScene({ run, reducedMotion }: { run: Run | null; reducedMotion: boolean }) {
  const roles = rolesForRun(run), theme = officeThemeForRun(run);
  return <Canvas shadows dpr={[1, 1.5]} frameloop="demand" orthographic camera={{ position: [12, 14, 16], zoom: 35, near: 0.1, far: 100 }} fallback={<div className="scene-fallback">Trình duyệt không hỗ trợ 3D. Theo dõi agent trong bảng phía dưới.</div>}>
    <FitCamera />
    <color attach="background" args={[theme.background]} />
    <ambientLight intensity={1.1} /><hemisphereLight args={['#e0e7ec', theme.floor, 1.6]} />
    <directionalLight position={[3, 11, 6]} intensity={2.7} color="#ffe6cc" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={0.04} />
    <group key={(run?.id ?? 'empty') + ':' + theme.id}>
      <OfficeRoom theme={theme} />
      {roles.map((role, index) => {
        const station = stationFor(theme, index), task = run?.tasks.find(item => item.role === role.id);
        return <group key={role.id}>
          <Workstation x={station[0]} z={station[1]} color={role.color} theme={theme} index={index} active={task?.state === 'running'} />
          <OfficeAgent station={station} index={index} color={role.color} state={task?.state} motionDisabled={reducedMotion} theme={theme} />
        </group>;
      })}
    </group>
  </Canvas>;
}
