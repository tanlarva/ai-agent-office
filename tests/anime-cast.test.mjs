import test from 'node:test';
import assert from 'node:assert/strict';
import { animeCast, castForRole, validateVrmContainer } from '../src/web/anime-cast.ts';
import { restingMotion, sampleHumanoidPose } from '../src/web/agent-pose.ts';
import { workflows } from '../dist/shared/workflows.js';

function container(data = { extensions: { VRM: {} } }) {
  const json = new TextEncoder().encode(JSON.stringify(data)), length = Math.ceil(json.length / 4) * 4;
  const buffer = new ArrayBuffer(20 + length), view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, length, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20).fill(32); new Uint8Array(buffer, 20, json.length).set(json);
  return buffer;
}

test('workflows use Yori for Orchestrator, distinct Amane variants for members, and Amane for solo', () => {
  assert.equal(animeCast.length, 5);
  assert.equal(new Set(animeCast.map(member => member.file)).size, 5);
  for (const workflow of workflows) {
    const members = workflow.steps.map((step, index) => castForRole(step.role, index));
    workflow.steps.forEach((step, index) => assert.ok(step.role === 'orchestrator' ? members[index].id === 'yori' : members[index].id.startsWith('amane-')));
    assert.equal(new Set(members.map(member => member.id)).size, workflow.steps.length);
  }
  assert.equal(castForRole('orchestrator', 4).id, 'yori');
  assert.equal(castForRole('unknown-future-role', -1).id, 'amane-1');
  assert.equal(castForRole('unknown-future-role', 5).id, 'amane-1');
});

test('anime poses preserve asking, celebration and thinking states introduced by v0.6', () => {
  const motion = { ...restingMotion(), disabled: false, time: 0.1 };
  const asking = sampleHumanoidPose({ ...motion, asking: true });
  const celebrating = sampleHumanoidPose({ ...motion, celebrating: true });
  assert.ok(asking.rightArmZ > 0); assert.ok(celebrating.leftArmZ < 0 && celebrating.rightArmZ > 0);
  const stopped = sampleHumanoidPose({ ...motion, disabled: true, asking: true, celebrating: true, sad: true });
  assert.equal(stopped.rightArmZ, -1.38); assert.equal(stopped.headX, 0);
  assert.notEqual(sampleHumanoidPose({ ...motion, working: true, thinking: true }).leftElbow, sampleHumanoidPose({ ...motion, working: true }).leftElbow);
});

test('VRM0 and VRM1 containers accept embedded resources without relying on a file extension', () => {
  assert.doesNotThrow(() => validateVrmContainer(container()));
  assert.doesNotThrow(() => validateVrmContainer(container({ extensions: { VRMC_vrm: {} }, buffers: [{ byteLength: 4 }], images: [{ bufferView: 0 }, { uri: 'data:image/png;base64,AA==' }] })));
});

test('invalid GLB headers, truncated JSON, malformed JSON and ordinary GLB models fail safely', () => {
  assert.throws(() => validateVrmContainer(new ArrayBuffer(19)), /Kích thước/);
  for (const [offset, value] of [[0, 0], [4, 1], [8, 30], [12, 0xffffffff], [16, 0]]) {
    const buffer = container(); new DataView(buffer).setUint32(offset, value, true);
    assert.throws(() => validateVrmContainer(buffer));
  }
  const malformed = container(); new Uint8Array(malformed)[20] = 0;
  assert.throws(() => validateVrmContainer(malformed));
  for (const data of [null, [], {}, { extensions: null }, { extensions: {} }]) assert.throws(() => validateVrmContainer(container(data)), /VRM/);
});

test('model references cannot fetch a remote host, a local file or a relative resource', () => {
  for (const field of ['buffers', 'images']) for (const uri of ['https://example.com/texture.png', 'http://127.0.0.1:4310/api/session', 'file:///C:/private.png', '../texture.png', 123]) {
    assert.throws(() => validateVrmContainer(container({ extensions: { VRM: {} }, [field]: [{ uri }] })), /tài nguyên ngoài/);
  }
});

test('reduced motion suppresses walking, typing, waiting and carrying animations', () => {
  const stopped = sampleHumanoidPose({ ...restingMotion(), time: 1, walking: true, working: true, waiting: true, carrying: true });
  assert.equal(stopped.leftLeg, 0); assert.equal(stopped.headY, 0); assert.ok(stopped.leftArmX === 0); assert.equal(stopped.blink, 0);
  assert.equal(stopped.rightArmX, 0); assert.equal(stopped.leftArmZ, 1.38);
});

test('humanoid walking alternates legs, working types without walking, and carrying bends the hand arm', () => {
  const walking = sampleHumanoidPose({ ...restingMotion(), disabled: false, time: 0.1, walking: true });
  assert.ok(Math.abs(walking.leftLeg) > 0.1); assert.equal(walking.leftLeg, -walking.rightLeg);
  assert.ok(walking.leftKnee >= 0 && walking.rightKnee >= 0);
  const working = sampleHumanoidPose({ ...restingMotion(), disabled: false, time: 0.1, working: true });
  assert.equal(working.leftLeg, 0); assert.notEqual(working.leftElbow, working.rightElbow); assert.equal(working.headX, 0.12);
  const carrying = sampleHumanoidPose({ ...restingMotion(), disabled: false, time: 0.1, walking: true, carrying: true });
  assert.equal(carrying.rightElbow, -1.1); assert.equal(carrying.rightArmX, -0.6);
  const waiting = sampleHumanoidPose({ ...restingMotion(), disabled: false, time: 1, waiting: true });
  assert.notEqual(waiting.headY, 0); assert.equal(waiting.leftLeg, 0);
  for (const pose of [walking, working, carrying, waiting]) assert.ok(Object.values(pose).every(Number.isFinite));
});
