import { expect, it } from "vitest";
import { editDistance } from "./edit-distance";
function reference(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      rows[i]![j] =
        a[i - 1] === b[j - 1]
          ? rows[i - 1]![j - 1]!
          : Math.min(rows[i - 1]![j - 1]!, rows[i - 1]![j]!, rows[i]![j - 1]!) + 1;
  return rows[a.length]![b.length]!;
}
it("preserves exact UTF-16 edit distances while using two rows", () => {
  const examples = ["", "a", "hello", "hallo", "kitten", "sitting", "é", "🙂", "synthetic reply"];
  for (const a of examples)
    for (const b of examples) expect(editDistance(a, b)).toBe(reference(a, b));
});
