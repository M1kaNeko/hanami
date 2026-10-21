import { it, expect } from "vitest";
import { isTrustedUrl } from "../src/main/security";
it("允许正式自定义协议，拒绝远程或伪装来源", () => {
  expect(isTrustedUrl("hanami://app/index.html", false)).toBe(true);
  expect(isTrustedUrl("hanami://evil/index.html", false)).toBe(false);
  expect(isTrustedUrl("https://app/index.html", false)).toBe(false);
  expect(isTrustedUrl("http://127.0.0.1:5173/", false)).toBe(false);
  expect(isTrustedUrl("http://127.0.0.1:5173/", true)).toBe(true);
  expect(isTrustedUrl("http://127.0.0.1:51730/", true)).toBe(false);
});
