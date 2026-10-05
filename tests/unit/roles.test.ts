import { describe, expect, it } from "vitest";
import { homePathFor, postLoginPath, safeNextPath } from "@/lib/auth/roles";

describe("homePathFor", () => {
  it("sends staff and admins to the back office", () => {
    expect(homePathFor("admin")).toBe("/admin");
    expect(homePathFor("staff")).toBe("/admin");
  });

  it("sends customers to their own area", () => {
    expect(homePathFor("customer")).toBe("/account");
  });
});

describe("safeNextPath", () => {
  it("accepts same-site paths", () => {
    expect(safeNextPath("/account/bookings")).toBe("/account/bookings");
    expect(safeNextPath("/book?package=prenup-studio")).toBe("/book?package=prenup-studio");
  });

  it("rejects anything that could leave the site", () => {
    for (const hostile of [
      "https://evil.com",
      "http://evil.com",
      "//evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      "javascript:alert(1)",
      "/account\nSet-Cookie: x=1",
      " /account",
    ]) {
      expect(safeNextPath(hostile), hostile).toBeNull();
    }
  });

  it("treats empty input as no destination", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });
});

describe("postLoginPath", () => {
  it("honours a safe requested destination", () => {
    expect(postLoginPath("customer", "/account/bookings")).toBe("/account/bookings");
    expect(postLoginPath("admin", "/admin/bookings")).toBe("/admin/bookings");
  });

  it("falls back to the role home for an unsafe destination", () => {
    expect(postLoginPath("customer", "https://evil.com")).toBe("/account");
    expect(postLoginPath("admin", "//evil.com")).toBe("/admin");
  });

  it("does not drop a customer onto an admin page", () => {
    expect(postLoginPath("customer", "/admin/customers")).toBe("/account");
    expect(postLoginPath("staff", "/admin/customers")).toBe("/admin/customers");
  });
});
