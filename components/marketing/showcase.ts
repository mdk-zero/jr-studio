import type { StaticImageData } from "next/image";

import athena from "@/assets/work/athena.jpg";
import enchanted from "@/assets/work/enchanted.jpg";
import family from "@/assets/work/family.jpg";
import gleaming from "@/assets/work/gleaming.jpg";
import louise from "@/assets/work/louise.jpg";
import lovewins from "@/assets/work/lovewins.jpg";
import portrait from "@/assets/work/portrait.jpg";
import revamp from "@/assets/work/revamp.jpg";
import sense from "@/assets/work/sense.jpg";
import y2k from "@/assets/work/y2k.jpg";

import camera from "@/assets/film/camera.jpg";
import lounge from "@/assets/film/lounge.jpg";
import makeup from "@/assets/film/makeup.jpg";
import photographer from "@/assets/film/photographer.jpg";
import reception from "@/assets/film/reception.jpg";
import set from "@/assets/film/set.jpg";
import wall from "@/assets/film/wall.jpg";

/**
 * The studio's own work and footage, bundled with the site rather than
 * uploaded through the back office: these are fixed parts of the design (the
 * hero reel, the cover wall, the studio film), not catalogue content. Album
 * photos and package covers still come from Storage via the admin.
 *
 * Sources: the legacy site's `Landing/assets` (cover shoots, the family
 * session, the portrait) and the studio's own film, `About.mp4`. Stills from
 * the film were taken at the timestamps noted, at its native 1280×720.
 */

export type Work = {
  image: StaticImageData;
  /** The title printed on the cover, when it has a legible one. */
  title?: string;
  /** The issue date printed on the cover. */
  issue?: string;
  kind: string;
  alt: string;
};

/** Magazine-concept covers, newest first. Titles and dates are as printed on each. */
export const COVERS: Work[] = [
  {
    image: y2k,
    issue: "Sep 2025",
    kind: "Concept shoot",
    alt: "Magazine-style cover: a woman in silver metallic clothes crouching against a pale green backdrop",
  },
  {
    image: athena,
    title: "Athena",
    issue: "May 2025",
    kind: "Magazine concept",
    alt: "Athena cover: a woman draped in white, eyes closed, rising from a bank of cloud",
  },
  {
    image: louise,
    title: "Louise",
    issue: "Feb 2025",
    kind: "Magazine concept",
    alt: "Louise cover: a close portrait looking back over a bare shoulder, warm brown tones",
  },
  {
    image: revamp,
    title: "Revamp",
    issue: "Jan 2025",
    kind: "Magazine concept",
    alt: "Revamp cover: a woman in a black gown mid-turn, lit in blue and violet",
  },
  {
    image: enchanted,
    title: "Enchanted",
    issue: "Jan 2025",
    kind: "Magazine concept",
    alt: "Enchanted cover: a woman in a tiara seen in an ornate gold hand mirror among dried flowers",
  },
  {
    image: gleaming,
    title: "Gleaming",
    issue: "Jul 2024",
    kind: "Magazine concept",
    alt: "Gleaming cover: a red-haired woman in fingerless leather gloves against grey",
  },
  {
    image: sense,
    title: "Sense",
    issue: "Jun 2024",
    kind: "Magazine concept",
    alt: "Sense cover: a woman in a brown blazer against a dark grey backdrop",
  },
  {
    image: lovewins,
    title: "Love Wins",
    issue: "Dec 2023",
    kind: "Couple shoot",
    alt: "Love Wins cover: two men laughing together, seated on wooden boxes",
  },
];

/** Sessions shown as plain photographs, without cover type. */
export const SESSIONS: Work[] = [
  {
    image: portrait,
    kind: "Portrait session",
    alt: "A smiling woman in a brown blazer seated on a stool against a dark grey backdrop",
  },
  {
    image: family,
    kind: "Family session",
    alt: "A laughing family of four with a baby, sitting by a white Christmas tree set",
  },
];

/** The studio film. Played on request only; it is 18 MB. */
export const FILM = {
  src: "/media/studio-film.mp4",
  duration: "3:22",
  title: "Inside J&R Studio",
  poster: photographer, // 0:32
} as const;

/**
 * The hero loop: the film's opening 6.45 s (a pan along the cover wall that
 * lands on the studio sign), cut to its own 0.8 MB file so the hero never
 * streams the full film. `poster` is its first frame.
 */
export const REEL = { src: "/media/studio-reel.mp4", poster: wall } as const;

/** Stills of the space, from the film. */
export const SPACE: Array<{ image: StaticImageData; label: string; alt: string }> = [
  { image: reception, label: "Reception & cover wall", alt: "The reception desk under the lit J&R Studio sign, beside a wall of framed magazine covers" }, // 0:14
  { image: set, label: "Shooting bay", alt: "A shooting bay with a yellow paper backdrop, a large softbox and a tethering monitor" }, // 2:00
  { image: makeup, label: "Hair & makeup", alt: "A lit vanity counter laid out with makeup and brushes" }, // 1:45
  { image: lounge, label: "Lounge", alt: "A mustard velvet wingback chair and ottomans on a rug in the client lounge" }, // 2:58
  { image: camera, label: "On set", alt: "A photographer in glasses framing a shot with a tethered camera" }, // 3:06
];
