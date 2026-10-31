import type { Viewport } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

// Phone browser chrome matches the darkroom instead of flashing white.
export const viewport: Viewport = { themeColor: "#0c0a0a" };

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="darkroom grain flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
