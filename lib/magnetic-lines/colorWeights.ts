function distribute(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const shares = weights.map(() => weightTotal > 0 ? 0 : total / weights.length);
  if (weightTotal > 0) {
    weights.forEach((weight, index) => {
      shares[index] = (weight / weightTotal) * total;
    });
  }
  const result = shares.map(Math.floor);
  const remainder = total - result.reduce((sum, share) => sum + share, 0);
  const order = shares
    .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (const { index } of order.slice(0, remainder)) {
    result[index] += 1;
  }
  return result;
}

export function normalizeColorWeights(weights: readonly number[] | undefined, colorCount: number): number[] {
  if (colorCount <= 0) return [];
  const fallbackWeight = 100 / colorCount;
  const normalizedInputs = Array.from({ length: colorCount }, (_, index) => {
    const weight = weights?.[index];
    return typeof weight === "number" && Number.isFinite(weight)
      ? Math.min(100, Math.max(0, weight))
      : fallbackWeight;
  });
  return distribute(100, normalizedInputs);
}

export function setColorWeight(weights: readonly number[], index: number, requestedWeight: number): number[] {
  const normalized = normalizeColorWeights(weights, weights.length);
  if (index < 0 || index >= normalized.length) return normalized;
  if (normalized.length === 1) return [100];

  const requested = Number.isFinite(requestedWeight)
    ? Math.min(100, Math.max(0, Math.round(requestedWeight)))
    : normalized[index];
  const otherWeights = normalized.map((weight, weightIndex) => weightIndex === index ? 0 : weight);
  const redistributed = distribute(100 - requested, otherWeights);
  return normalized.map((_, weightIndex) => weightIndex === index ? requested : redistributed[weightIndex]);
}
