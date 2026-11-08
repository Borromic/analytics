import { describe, expect, it } from "vitest";
import { cleanPath } from "../src/clean-path.js";

describe("cleanPath", () => {
  it("keeps a plain path as it is", () => {
    expect(cleanPath("/blog/how-to-read-a-long-article-title")).toBe("/blog/how-to-read-a-long-article-title");
  });

  it("reads an empty path as the home page", () => {
    expect(cleanPath("")).toBe("/");
  });

  it("replaces a segment holding an email", () => {
    expect(cleanPath("/reset/someone%40example.com")).toBe("/reset/[email]");
  });

  it("replaces a uuid", () => {
    expect(cleanPath("/orders/123e4567-e89b-12d3-a456-426614174000")).toBe("/orders/[token]");
  });

  it("replaces a long run with digits in it", () => {
    expect(cleanPath("/invite/a1b2c3d4e5f6g7h8i9j0k")).toBe("/invite/[token]");
  });

  it("replaces a long run in mixed case", () => {
    expect(cleanPath("/share/AbCdEfGhIjKlMnOpQrStUv")).toBe("/share/[token]");
  });

  it("keeps a long word in one case", () => {
    expect(cleanPath("/glossary/internationalizationsystems")).toBe("/glossary/internationalizationsystems");
  });

  it("keeps campaign tags and drops the rest of the query", () => {
    expect(cleanPath("/pricing", "?token=abc&utm_source=news&utm_medium=email&page=2")).toBe(
      "/pricing?utm_source=news&utm_medium=email",
    );
  });

  it("drops a campaign tag whose value is an email", () => {
    expect(cleanPath("/", "?utm_content=someone%40example.com")).toBe("/");
  });

  it("drops a campaign tag whose value is a token", () => {
    expect(cleanPath("/", "?utm_term=9f86d081884c7d659a2feaa0c55ad015")).toBe("/");
  });

  it("drops an empty campaign tag", () => {
    expect(cleanPath("/", "?utm_source=")).toBe("/");
  });

  it("reads a segment that isn't valid percent-encoding as it is", () => {
    expect(cleanPath("/100%off")).toBe("/100%off");
  });

  it("cuts a path at 512 characters", () => {
    expect(cleanPath(`/${"a-".repeat(400)}`)).toHaveLength(512);
  });
});
