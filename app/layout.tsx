import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import { THEME_KEY } from "@/lib/theme";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

// Camera-readout type for labels, timecodes and frame numbers.
const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "J&R Studio — Photo & Video Studio in Nasugbu, Batangas",
    template: "%s · J&R Studio",
  },
  description:
    "Photo and video sessions, studio shoots and event coverage in Nasugbu, Batangas. Browse packages and book your session online.",
};

// Phone browser chrome follows the system scheme (it cannot see the switcher).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a0a" },
  ],
};

/**
 * Applies the visitor's saved theme before the first paint, so a dark-mode
 * choice never flashes light. The server cannot know it (it lives in
 * localStorage), hence suppressHydrationWarning on <html>.
 */
const applyStoredTheme = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-PH"
      suppressHydrationWarning
      className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: applyStoredTheme }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
