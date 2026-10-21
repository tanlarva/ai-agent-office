import test from 'node:test';
import assert from 'node:assert/strict';
import { officeThemes, officeThemeForRun, dockFor, handoffPath, pathLength, samplePath, shouldHandoff, isLivePose } from '../dist/shared/office-scene.js';
import { workflows } from '../dist/shared/workflows.js';

test('each workflow has its own room and sufficient workstations; legacy and empty scenes are explicit', () => {
  assert.equal(new Set(Object.values(officeThemes).map(theme => theme.name)).size, workflows.length);
  assert.equal(new Set(Object.values(officeThemes).map(theme => theme.background)).size, workflows.length);
  for (const workflow of workflows) {
    const theme = officeThemeForRun({ workflow });
    assert.equal(theme.id, workflow.id);
    assert.ok(theme.stations.length >= workflow.steps.length);
    assert.equal(new Set(theme.stations.map(point => point.join(','))).size, theme.stations.length);
  }
  assert.equal(officeThemeForRun(null).id, 'software');
  assert.equal(officeThemeForRun({}).id, 'quick');
});

test('handoff paths stay on the floor and outside desk/table/plant footprints with character clearance', () => {
  for (const theme of Object.values(officeThemes)) for (const [index, station] of theme.stations.entries()) {
    const path = handoffPath(station, index), length = pathLength(path);
    assert.deepEqual(path[0], dockFor(station));
    assert.ok(length > 0 && length < 25);
    assert.deepEqual(path.at(-1), [path.at(-1)[0], 4.8]);
    for (let d = 0; d <= length; d += 0.025) {
      const { position: [x, z] } = samplePath(path, d);
      assert.ok(Math.abs(x) <= 7.2 && z >= -4.4 && z <= 6.2, theme.id);
      for (const [deskX, deskZ] of theme.stations) {
        assert.ok(!(Math.abs(x - deskX) < 1.325 + 0.35 && Math.abs(z - deskZ) < 0.61 + 0.35), `${theme.id} desk collision ${index}: ${x},${z}`);
      }
      assert.ok(!(Math.abs(x) < 1.4 + 0.35 && Math.abs(z - 0.65) < 1.05 + 0.35), `${theme.id} table collision`);
      for (const [px, pz] of [[-5.1, 3.95], [6.6, -2.9]]) assert.ok(Math.hypot(x - px, z - pz) > 0.8, `${theme.id} plant collision ${x},${z}`);
    }
  }
});

test('path sampling clamps endpoints, crosses segments and returns all the way to the same dock', () => {
  const path = [[0, 0], [0, 0], [0, 2], [3, 2]];
  assert.equal(pathLength(path), 5);
  assert.deepEqual(samplePath(path, -1).position, [0, 0]);
  assert.deepEqual(samplePath(path, 3).position, [1, 2]);
  assert.equal(samplePath(path, 3).heading, Math.PI / 2);
  assert.equal(samplePath(path, 99).finished, true);
  assert.deepEqual(samplePath(path, 99).position, [3, 2]);
  assert.deepEqual(samplePath([...path].reverse(), 5).position, [0, 0]);
  assert.deepEqual(samplePath([], 10).position, [0, 0]);
});

test('only witnessed completion triggers delivery; historical, queued, failed and canceled states never do', () => {
  for (const previous of ['running', 'waiting_approval', 'waiting_capacity']) assert.equal(shouldHandoff(previous, 'succeeded'), true);
  for (const previous of [undefined, 'queued', 'succeeded', 'failed', 'canceled', 'interrupted']) assert.equal(shouldHandoff(previous, 'succeeded'), false);
  for (const next of ['running', 'queued', 'waiting_capacity', 'failed', 'canceled', 'interrupted']) assert.equal(shouldHandoff('running', next), false);
  assert.equal(isLivePose('waiting_capacity'), true);
  assert.equal(isLivePose('succeeded'), false);
});
