import { performance } from "node:perf_hooks";
import { editDistance } from "../src/server/generation/edit-distance";

function matrixDistance(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      rows[i]![j] =
        a[i - 1] === b[j - 1]
          ? rows[i - 1]![j - 1]!
          : Math.min(rows[i - 1]![j - 1]!, rows[i - 1]![j]!, rows[i]![j - 1]!) + 1;
    }
  return rows[a.length]![b.length]!;
}

if (!global.gc) throw new Error("Run with --expose-gc to measure heap allocation");
for (const length of [400, 2000]) {
  const a = "synthetic reply ".repeat(Math.ceil(length / 16)).slice(0, length);
  const b = "synthetic edit! ".repeat(Math.ceil(length / 16)).slice(0, length);
  for (const [name, fn] of [
    ["matrix", matrixDistance],
    ["two rows", editDistance],
  ] as const) {
    const samples = [];
    for (let run = 0; run < 5; run++) {
      global.gc();
      const heap = process.memoryUsage().heapUsed;
      const start = performance.now();
      const distance = fn(a, b);
      samples.push({
        ms: performance.now() - start,
        heapBytes: process.memoryUsage().heapUsed - heap,
        distance,
      });
    }
    const median = (values: number[]) => values.sort((x, y) => x - y)[2]!;
    console.log(
      JSON.stringify({
        length,
        implementation: name,
        medianMs: Number(median(samples.map((s) => s.ms)).toFixed(2)),
        medianHeapBytes: median(samples.map((s) => s.heapBytes)),
        distance: samples[0]!.distance,
      }),
    );
  }
}
