import { expect, it } from "vitest";
import { doubleOneTrailingEmoji, hasDoubledEmoji } from "../src/replies.js";
it("duplicates a complete red-heart emoji including its variation selector", () => {
  expect(doubleOneTrailingEmoji("hello ❤️")).toBe("hello ❤️❤️");
  expect(hasDoubledEmoji("hello ❤️❤️")).toBe(true);
  expect(doubleOneTrailingEmoji("hello ❤️❤️")).toBe("hello ❤️❤️");
  expect(doubleOneTrailingEmoji("hello 😏")).toBe("hello 😏😏");
});
