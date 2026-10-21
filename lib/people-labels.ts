import type { CUSTOMER_TIERS, STAFF_POSITIONS } from "@/lib/validators/people";

/** Display names, shared by server pages and client forms. */
export const TIER_LABEL: Record<(typeof CUSTOMER_TIERS)[number], string> = {
  regular: "Regular",
  vip: "VIP",
  corporate: "Corporate",
};

export const POSITION_LABEL: Record<(typeof STAFF_POSITIONS)[number], string> = {
  photographer: "Photographer",
  videographer: "Videographer",
  makeup_artist: "Hair & makeup",
  assistant: "Assistant",
  editor: "Editor",
  other: "Other",
};
