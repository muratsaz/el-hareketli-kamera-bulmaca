import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShuffledTiles, swapTiles, countCorrect, isSolved, formatElapsed,
  coverMapping, mapLandmark, pinchRatio, frameFromHands,
} from '../dist/puzzle-core.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

function handAt(x, y, spread = 0.12) {
  const points = Array.from({ length: 21 }, () => ({ x, y }));
  points[0] = { x, y: y + 0.08 };
  points[9] = { x, y };
  points[5] = { x: x - 0.05, y };
  points[17] = { x: x + 0.05, y };
  points[4] = { x: x - spread / 2, y: y + spread / 2 };
  points[8] = { x: x + spread / 2, y: y - spread / 2 };
  return points;
}

test('shuffles are valid derangements and can be solved through legal swaps', () => {
  for (const size of [2, 3, 4, 5]) {
    for (const sample of [0, 0.25, 0.5, 0.999999, 1, NaN]) {
      let tiles = createShuffledTiles(size, () => sample);
      assert.deepEqual([...tiles].sort((a, b) => a - b), Array.from({ length: size * size }, (_, i) => i));
      assert.equal(countCorrect(tiles), 0);
      assert.equal(isSolved(tiles), false);
      for (let destination = 0; destination < tiles.length; destination += 1) {
        const previous = countCorrect(tiles);
        tiles = swapTiles(tiles, destination, tiles.indexOf(destination));
        assert.ok(countCorrect(tiles) >= previous);
      }
      assert.equal(isSolved(tiles), true);
    }
  }
});

test('swaps preserve their input and ignore invalid indices', () => {
  const input = Object.freeze([1, 0, 2, 3]);
  assert.deepEqual(swapTiles(input, 0, 1), [0, 1, 2, 3]);
  assert.deepEqual(input, [1, 0, 2, 3]);
  for (const [a, b] of [[-1, 0], [0, 4], [NaN, 1], [1.5, 2]]) assert.deepEqual(swapTiles(input, a, b), input);
  assert.equal(isSolved([]), false);
  assert.throws(() => createShuffledTiles(1), RangeError);
});

test('cover coordinates match the mirrored, horizontally cropped camera', () => {
  const mapping = coverMapping(1920, 1080, 800, 600);
  close(mapping.scale, 600 / 1080);
  close(mapping.offsetX, -133.33333333333337);
  assert.deepEqual(mapLandmark({ x: 0.5, y: 0.5 }, mapping), { x: 400, y: 300 });
  const original = mapLandmark({ x: 0.25, y: 0.25 }, mapping, false);
  const mirrored = mapLandmark({ x: 0.25, y: 0.25 }, mapping, true);
  close(original.x, 133.33333333333331);
  close(mirrored.x, 800 - original.x);
  close(mirrored.y, 150);
  assert.ok(mapLandmark({ x: 0, y: 0.5 }, mapping).x > 800, 'cropped points remain outside the viewport');
});

test('portrait source is vertically cropped for a landscape display', () => {
  const mapping = coverMapping(600, 800, 800, 600);
  close(mapping.offsetX, 0);
  assert.ok(mapping.offsetY < 0);
  assert.deepEqual(mapLandmark({ x: 0.5, y: 0.5 }, mapping), { x: 400, y: 300 });
  assert.throws(() => coverMapping(0, 100, 400, 400), RangeError);
});

test('pinch normalization is invariant under uniform scale and translation', () => {
  const points = handAt(0.5, 0.5, 0.018);
  const ratio = pinchRatio(points);
  assert.ok(ratio < 0.30);
  const transformed = points.map(point => ({ x: point.x * 0.2 + 0.1, y: point.y * 0.2 + 0.4 }));
  close(pinchRatio(transformed), ratio);
  assert.ok(pinchRatio(handAt(0.5, 0.5, 0.08)) > 0.48);
  const fallback = points.map(point => ({ ...point }));
  fallback[17] = { ...fallback[5] };
  assert.ok(Number.isFinite(pinchRatio(fallback)));
  assert.equal(pinchRatio(Array.from({ length: 21 }, () => ({ x: 0, y: 0 }))), Infinity);
  assert.equal(pinchRatio([]), Infinity);
});

test('two spread hands define a clipped frame while pinches and tiny frames are rejected', () => {
  const mapping = coverMapping(1000, 1000, 500, 500);
  const hands = [handAt(0.25, 0.30, 0.14), handAt(0.75, 0.70, 0.14)];
  const frame = frameFromHands(hands, mapping);
  close(frame.x, 90);
  close(frame.y, 115);
  close(frame.width, 320);
  close(frame.height, 270);
  assert.equal(frameFromHands([hands[0]], mapping), null);
  assert.equal(frameFromHands([handAt(0.25, 0.3, 0.01), hands[1]], mapping), null);
  assert.equal(frameFromHands([handAt(0.5, 0.5), handAt(0.51, 0.51)], mapping), null);
  const clipped = frameFromHands([handAt(-0.02, 0.1, 0.2), handAt(1.02, 0.9, 0.2)], mapping);
  assert.deepEqual(clipped, { x: 0, y: 0, width: 500, height: 500 });
});

test('elapsed time handles boundaries without rounding up', () => {
  assert.equal(formatElapsed(-10), '00:00');
  assert.equal(formatElapsed(59999), '00:59');
  assert.equal(formatElapsed(60000), '01:00');
  assert.equal(formatElapsed(3661000), '61:01');
  assert.equal(formatElapsed(NaN), '00:00');
});
