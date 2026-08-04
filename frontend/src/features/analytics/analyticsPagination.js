export function normalizeAnalyticsPaginationBoundaries(positions, canvasHeight) {
  const boundaries = Array.from(new Set([
    0,
    ...positions,
    canvasHeight,
  ].map((position) => Math.round(position))))
    .filter((position) => position >= 0 && position <= canvasHeight)
    .sort((first, second) => first - second);

  if (
    boundaries[0] !== 0
    || boundaries.at(-1) !== canvasHeight
    || boundaries.some((position, index) => index > 0 && position <= boundaries[index - 1])
  ) {
    throw new Error("Analytics PDF pagination boundaries must be strictly increasing.");
  }

  return boundaries;
}

export function buildAnalyticsPaginationBoundaries({
  atomicRanges = [],
  breakpoints = [],
  canvasHeight,
  keepTogetherStarts = [],
  sourcePageHeight,
}) {
  const fittingAtomicRanges = atomicRanges.filter((range) => range.end - range.start <= sourcePageHeight);
  const isInsideAtomicRange = (position) => fittingAtomicRanges.some((range) => (
    position > range.start && position < range.end
  ));

  return normalizeAnalyticsPaginationBoundaries([
    ...breakpoints.filter((position) => !isInsideAtomicRange(position)),
    ...keepTogetherStarts.filter((position) => !isInsideAtomicRange(position)),
    ...fittingAtomicRanges.flatMap((range) => [range.start, range.end]),
  ], canvasHeight);
}
