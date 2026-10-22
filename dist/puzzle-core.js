/** Pure puzzle and camera-coordinate helpers. No DOM or camera side effects. */

export function createShuffledTiles(size = 3, rng = Math.random) {
  if (!Number.isInteger(size) || size < 2 || !Number.isSafeInteger(size * size)) {
    throw new RangeError('The puzzle side length must be an integer of at least 2.');
  }
  const tiles = Array.from({ length: size * size }, (_, index) => index);
  // Sattolo's algorithm creates one cycle: every tile starts out of place.
  // Every permutation is solvable because this puzzle swaps any two tiles.
  for (let index = tiles.length - 1; index > 0; index -= 1) {
    const sample = Number(rng());
    const bounded = Number.isFinite(sample) ? Math.max(0, Math.min(1 - Number.EPSILON, sample)) : 0;
    const other = Math.floor(bounded * index);
    [tiles[index], tiles[other]] = [tiles[other], tiles[index]];
  }
  return tiles;
}

export function swapTiles(tiles, a, b) {
  const result = [...tiles];
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= tiles.length || b >= tiles.length) return result;
  [result[a], result[b]] = [result[b], result[a]];
  return result;
}

export function countCorrect(tiles) {
  return tiles.reduce((count, tile, index) => count + Number(tile === index), 0);
}

export function isSolved(tiles) {
  return tiles.length > 0 && countCorrect(tiles) === tiles.length;
}

export function formatElapsed(milliseconds) {
  const seconds = Math.floor(Math.max(0, Number.isFinite(milliseconds) ? milliseconds : 0) / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function coverMapping(sourceWidth, sourceHeight, displayWidth, displayHeight) {
  if (![sourceWidth, sourceHeight, displayWidth, displayHeight].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Source and display dimensions must be positive finite numbers.');
  }
  const scale = Math.max(displayWidth / sourceWidth, displayHeight / sourceHeight);
  return {
    sourceWidth, sourceHeight, displayWidth, displayHeight, scale,
    offsetX: (displayWidth - sourceWidth * scale) / 2,
    offsetY: (displayHeight - sourceHeight * scale) / 2,
  };
}

export function mapLandmark(point, mapping, mirror = true) {
  return {
    x: (mirror ? 1 - point.x : point.x) * mapping.sourceWidth * mapping.scale + mapping.offsetX,
    y: point.y * mapping.sourceHeight * mapping.scale + mapping.offsetY,
  };
}

function validPoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function distance(a, b) {
  return validPoint(a) && validPoint(b) ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

export function pinchRatio(landmarks) {
  if (!Array.isArray(landmarks) || !validPoint(landmarks[4]) || !validPoint(landmarks[8])) return Infinity;
  const palmWidth = distance(landmarks[5], landmarks[17]);
  const palmSize = palmWidth > 1e-6 ? palmWidth : distance(landmarks[0], landmarks[9]);
  // Degenerate/occluded hands must never be interpreted as a closed pinch.
  return palmSize > 1e-6 ? distance(landmarks[4], landmarks[8]) / palmSize : Infinity;
}

export function frameFromHands(hands, mapping) {
  if (!Array.isArray(hands) || hands.length < 2) return null;
  const pair = hands.slice(0, 2);
  if (pair.some(hand => !Array.isArray(hand) || !validPoint(hand[4]) || !validPoint(hand[8]) || !Number.isFinite(pinchRatio(hand)) || pinchRatio(hand) < 0.65)) return null;

  const corners = pair.map(hand => [mapLandmark(hand[4], mapping), mapLandmark(hand[8], mapping)]);
  const centers = corners.map(points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }));
  const minimumSpan = Math.min(mapping.displayWidth, mapping.displayHeight);
  if (distance(centers[0], centers[1]) < minimumSpan * 0.2) return null;
  if (corners.some(points => distance(points[0], points[1]) < minimumSpan * 0.08)) return null;

  const points = corners.flat();
  const x = Math.max(0, Math.min(mapping.displayWidth, Math.min(...points.map(point => point.x))));
  const y = Math.max(0, Math.min(mapping.displayHeight, Math.min(...points.map(point => point.y))));
  const right = Math.max(0, Math.min(mapping.displayWidth, Math.max(...points.map(point => point.x))));
  const bottom = Math.max(0, Math.min(mapping.displayHeight, Math.max(...points.map(point => point.y))));
  const width = right - x;
  const height = bottom - y;
  if (width < minimumSpan * 0.22 || height < minimumSpan * 0.22) return null;
  return { x, y, width, height };
}
