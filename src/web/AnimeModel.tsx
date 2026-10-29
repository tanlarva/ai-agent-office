import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, Group, LoadingManager, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { maxModelBytes, validateVrmContainer, type CastMember } from './anime-cast';
import { sampleHumanoidPose, type AgentMotion } from './agent-pose';
import { Block, materials } from './OfficeFurniture';

export type ModelStatus = 'loading' | 'ready' | 'missing' | 'error';
class MissingModel extends Error {}

async function loadModel(member: CastMember, signal: AbortSignal): Promise<VRM> {
  const response = await fetch(member.file, { signal });
  if (response.status === 404 || response.headers.get('content-type')?.includes('text/html')) throw new MissingModel('Chưa có tệp model trên máy.');
  if (!response.ok) throw new Error('Không đọc được model trên máy.');
  if (Number(response.headers.get('content-length')) > maxModelBytes) throw new Error('Model vượt giới hạn kích thước.');
  const buffer = await response.arrayBuffer();
  validateVrmContainer(buffer);
  signal.throwIfAborted();
  const manager = new LoadingManager();
  let textureFailed = false;
  manager.onError = () => { textureFailed = true; };
  manager.setURLModifier(url => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    throw new Error('Model không được tải tài nguyên ngoài.');
  });
  const loader = new GLTFLoader(manager);
  loader.register(parser => new VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(buffer, '');
  const vrm = gltf.userData.vrm as VRM | undefined;
  try {
    if (textureFailed) throw new Error('Không nạp được texture của model.');
    if (!vrm?.humanoid) throw new Error('Model không có bộ xương humanoid VRM.');
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.combineSkeletons(vrm.scene);
    VRMUtils.combineMorphs(vrm);
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(vrm.scene), size = bounds.getSize(new Vector3());
    if (!Number.isFinite(size.y) || size.y < 0.1 || size.y > 10) throw new Error('Tỉ lệ model không hợp lệ.');
    const scale = member.height / size.y;
    vrm.scene.scale.multiplyScalar(scale);
    vrm.scene.position.y -= bounds.min.y * scale;
    vrm.scene.traverse(node => { if (node instanceof Mesh) { node.frustumCulled = false; node.castShadow = false; } });
    return vrm;
  } catch (failure) {
    VRMUtils.deepDispose(gltf.scene);
    throw failure;
  }
}

export function AnimeModel({ member, motion, color, onStatus }: {
  member: CastMember; motion: RefObject<AgentMotion>; color: string;
  onStatus: (id: string, status: ModelStatus) => void;
}) {
  const host = useRef<Group>(null), parcel = useRef<Group>(null), model = useRef<VRM | null>(null);
  const handPosition = useRef(new Vector3());
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(new Error('Hết thời gian tải model.')), 30_000);
    let disposed = false, loaded: VRM | null = null;
    onStatus(member.id, 'loading');
    void loadModel(member, controller.signal).then(vrm => {
      loaded = vrm;
      if (disposed || controller.signal.aborted) {
        VRMUtils.deepDispose(vrm.scene); loaded = null;
        if (!disposed) controller.signal.throwIfAborted();
        return;
      }
      host.current?.add(vrm.scene); model.current = vrm;
      onStatus(member.id, 'ready'); invalidate();
    }).catch(failure => {
      if (disposed) return;
      onStatus(member.id, failure instanceof MissingModel ? 'missing' : 'error'); invalidate();
    }).finally(() => clearTimeout(timeout));
    return () => {
      disposed = true; clearTimeout(timeout); controller.abort(); model.current = null;
      if (loaded) { loaded.scene.removeFromParent(); VRMUtils.deepDispose(loaded.scene); loaded = null; }
    };
  }, [member, onStatus, invalidate]);

  useFrame((_, delta) => {
    const vrm = model.current;
    if (!vrm) return;
    const pose = sampleHumanoidPose(motion.current), rig = vrm.humanoid;
    rig.getNormalizedBoneNode('leftUpperLeg')?.rotation.set(pose.leftLeg, 0, 0);
    rig.getNormalizedBoneNode('rightUpperLeg')?.rotation.set(pose.rightLeg, 0, 0);
    rig.getNormalizedBoneNode('leftLowerLeg')?.rotation.set(pose.leftKnee, 0, 0);
    rig.getNormalizedBoneNode('rightLowerLeg')?.rotation.set(pose.rightKnee, 0, 0);
    rig.getNormalizedBoneNode('leftUpperArm')?.rotation.set(pose.leftArmX, 0, pose.leftArmZ);
    rig.getNormalizedBoneNode('rightUpperArm')?.rotation.set(pose.rightArmX, 0, pose.rightArmZ);
    rig.getNormalizedBoneNode('leftLowerArm')?.rotation.set(pose.leftElbow, 0, 0);
    rig.getNormalizedBoneNode('rightLowerArm')?.rotation.set(pose.rightElbow, 0, 0);
    rig.getNormalizedBoneNode('head')?.rotation.set(pose.headX, pose.headY, 0);
    vrm.expressionManager?.setValue('blink', pose.blink);
    vrm.update(motion.current.disabled ? 0 : Math.min(delta, 0.05));
    if (parcel.current && host.current) {
      const hand = rig.getRawBoneNode('rightHand');
      parcel.current.visible = !!hand && motion.current.carrying && !motion.current.disabled;
      if (hand && parcel.current.visible) {
        hand.getWorldPosition(handPosition.current);
        parcel.current.position.copy(host.current.worldToLocal(handPosition.current));
      }
    }
  });
  return <group ref={host}>
    <group ref={parcel} visible={false}><Block position={[0, 0, 0.07]} size={[0.35, 0.26, 0.07]} color={color} /><Block position={[0, 0.04, 0.11]} size={[0.25, 0.03, 0.01]} color={materials.paper} /></group>
  </group>;
}
