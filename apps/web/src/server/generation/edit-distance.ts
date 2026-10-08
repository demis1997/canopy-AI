/** Exact Levenshtein distance: O(m*n) time, O(min(m,n)) memory, UTF-16 semantics preserved. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length < b.length) [a, b] = [b, a];
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] =
        a[i - 1] === b[j - 1]
          ? previous[j - 1]!
          : Math.min(previous[j - 1]!, previous[j]!, current[j - 1]!) + 1;
    }
    [previous, current] = [current, previous];
  }
  return previous[b.length]!;
}
