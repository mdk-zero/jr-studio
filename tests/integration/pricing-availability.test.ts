import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, hasCredentials, packageIdBySlug } from "./helpers";

describe.skipIf(!hasCredentials)("quote_booking (the single pricing formula)", () => {
  let proPortraits: string; // in the active 15% promo
  let familySession: string; // only in an EXPIRED promo
  let hmuaId: string;
  let printsId: string;
  let secondPhotographerId: string;

  beforeAll(async () => {
    proPortraits = await packageIdBySlug("pro-portraits");
    familySession = await packageIdBySlug("family-session");
    const { data } = await adminClient().from("addons").select("id, name");
    hmuaId = data!.find((a) => a.name === "Hair and Makeup")!.id;
    printsId = data!.find((a) => a.name === "Extra Prints (10)")!.id;
    // Only offered with event packages, never with a studio session.
    secondPhotographerId = data!.find((a) => a.name === "Second Photographer")!.id;
  });

  it("applies an active promotion to the package price", async () => {
    const { data, error } = await anonClient().rpc("quote_booking", {
      p_package_id: proPortraits,
    });
    expect(error).toBeNull();
    const q = data![0];
    // Pro Portraits is 600.00 and is in the active 'Studio Season Treat' (15%).
    expect(Number(q.package_price)).toBe(600);
    expect(Number(q.addons_total)).toBe(0);
    expect(q.discount_percent).toBe(15);
    expect(Number(q.discount_amount)).toBe(90);
    expect(Number(q.total_amount)).toBe(510);
  });

  it("discounts the package plus its add-ons, not the package alone", async () => {
    const { data, error } = await anonClient().rpc("quote_booking", {
      p_package_id: proPortraits,
      p_addon_ids: [hmuaId, printsId],
    });
    expect(error).toBeNull();
    const q = data![0];
    // 600 + 1500 + 350 = 2450, less 15% = 2082.50
    expect(Number(q.addons_total)).toBe(1850);
    expect(Number(q.discount_amount)).toBe(367.5);
    expect(Number(q.total_amount)).toBe(2082.5);
  });

  it("ignores an add-on that is not offered with the package", async () => {
    // Second Photographer is an event-only add-on, so asking for it on a studio
    // session must not add it to the total. This is what stops a crafted
    // request from attaching an arbitrary add-on at a price of its choosing.
    const { data } = await anonClient().rpc("quote_booking", {
      p_package_id: familySession,
      p_addon_ids: [hmuaId, secondPhotographerId],
    });
    const q = data![0];
    expect(Number(q.addons_total)).toBe(1500); // HMUA only; 4000 rejected
  });

  it("ignores an expired promotion", async () => {
    const { data } = await anonClient().rpc("quote_booking", {
      p_package_id: familySession,
    });
    const q = data![0];
    // family-session is only in 'Anniversary Sale', which has ended.
    expect(q.promotion_id).toBeNull();
    expect(Number(q.discount_amount)).toBe(0);
    expect(Number(q.total_amount)).toBe(950);
  });

  it("rejects an unknown package instead of quoting zero", async () => {
    const { error } = await anonClient().rpc("quote_booking", {
      p_package_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not available/i);
  });
});

describe.skipIf(!hasCredentials)("available_slots", () => {
  let selfStudio: string;

  beforeAll(async () => {
    selfStudio = await packageIdBySlug("self-studio-solo");
  });

  /** A date N days out in Manila, as YYYY-MM-DD. */
  function manilaDatePlus(days: number): string {
    const now = new Date();
    const manila = new Date(now.getTime() + 8 * 3600_000 + days * 86400_000);
    return manila.toISOString().slice(0, 10);
  }

  it("offers hourly slots inside business hours", async () => {
    // Find an upcoming date the studio is open (Sunday is closed in the seed).
    for (let d = 2; d < 9; d++) {
      const date = manilaDatePlus(d);
      const { data, error } = await anonClient().rpc("available_slots", {
        p_package_id: selfStudio,
        p_date: date,
      });
      expect(error).toBeNull();
      if (!data || data.length === 0) continue;

      // Every slot must start at or after 08:00 and finish by 20:00 Manila.
      for (const slot of data) {
        const startHour = Number(
          new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Manila",
            hour: "2-digit",
            hour12: false,
          }).format(new Date(slot.starts_at)),
        ) % 24;
        expect(startHour).toBeGreaterThanOrEqual(8);
        expect(startHour).toBeLessThan(20);
      }
      return;
    }
    throw new Error("no open day found within a week");
  });

  it("returns nothing for a past date", async () => {
    const { data } = await anonClient().rpc("available_slots", {
      p_package_id: selfStudio,
      p_date: manilaDatePlus(-1),
    });
    expect(data).toEqual([]);
  });

  it("returns nothing beyond the max advance window", async () => {
    const { data } = await anonClient().rpc("available_slots", {
      p_package_id: selfStudio,
      p_date: manilaDatePlus(400),
    });
    expect(data).toEqual([]);
  });

  it("is closed on Sunday", async () => {
    // Walk forward to the next Sunday in Manila.
    for (let d = 1; d <= 7; d++) {
      const date = manilaDatePlus(d);
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      if (weekday !== 0) continue;
      const { data } = await anonClient().rpc("available_slots", {
        p_package_id: selfStudio,
        p_date: date,
      });
      expect(data).toEqual([]);
      return;
    }
  });

  it("excludes slots taken by an existing active booking", async () => {
    // The seed has an approved family-session 3 days out at 15:00 Manila.
    const { data: booking } = await adminClient()
      .from("bookings")
      .select("starts_at, ends_at, status")
      .eq("status", "approved")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(1)
      .single();

    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" })
      .format(new Date(booking!.starts_at));

    const { data: slots } = await anonClient().rpc("available_slots", {
      p_package_id: selfStudio,
      p_date: date,
    });

    const taken = { start: new Date(booking!.starts_at), end: new Date(booking!.ends_at) };
    for (const slot of slots ?? []) {
      const s = new Date(slot.starts_at);
      const e = new Date(slot.ends_at);
      // No returned slot may overlap the existing booking.
      expect(s < taken.end && taken.start < e).toBe(false);
    }
  });
});
