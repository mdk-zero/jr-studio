import Link from "next/link";
import { getBusinessHours, getCurrentYear, getStudioSettings } from "@/lib/catalog";
import { minutesToTime, timeToMinutes } from "@/lib/datetime";
import { BrandLogo } from "@/components/brand-logo";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function to12Hour(time: string): string {
  const minutes = timeToMinutes(time);
  const hour = Math.floor(minutes / 60);
  const suffix = hour >= 12 ? "pm" : "am";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  const mins = minutes % 60;
  return mins ? `${display}:${minutesToTime(minutes).slice(3)}${suffix}` : `${display}${suffix}`;
}

export async function SiteFooter() {
  const [settings, hours, year] = await Promise.all([
    getStudioSettings(),
    getBusinessHours(),
    getCurrentYear(),
  ]);
  const socials = (settings.socials ?? {}) as Record<string, string>;

  const open = hours.filter((h) => h.is_open);
  const firstOpen = open[0];
  const uniformHours =
    firstOpen &&
    open.every((h) => h.opens_at === firstOpen.opens_at && h.closes_at === firstOpen.closes_at);
  const closedDays = hours.filter((h) => !h.is_open).map((h) => DAYS[h.weekday]);

  return (
    <footer id="visit" className="border-t border-line bg-canvas">
      <div className="mx-auto grid grid-cols-1 w-full max-w-6xl gap-10 px-5 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-4">
            <BrandLogo className="size-14" />
            <p className="caps text-muted">
              Photo &amp; video
              <br />
              Nasugbu, Batangas
            </p>
          </div>
          {settings.address ? (
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-muted">{settings.address}</p>
          ) : null}
          {settings.map_url ? (
            <a
              href={settings.map_url}
              target="_blank"
              rel="noreferrer noopener"
              className="caps mt-4 inline-block text-brand underline underline-offset-4 transition-colors hover:text-ink"
            >
              Find the studio
            </a>
          ) : null}
        </div>

        <div>
          <p className="caps text-brand">Studio hours</p>
          <div className="mt-3 space-y-1 text-sm text-muted">
            {uniformHours ? (
              <>
                <p className="nums text-ink">
                  {to12Hour(firstOpen.opens_at)} – {to12Hour(firstOpen.closes_at)}
                </p>
                {closedDays.length ? <p>Closed {closedDays.join(", ")}</p> : null}
              </>
            ) : (
              hours.map((h) => (
                <p key={h.weekday} className="nums flex justify-between gap-4">
                  <span>{DAYS[h.weekday]}</span>
                  <span className={h.is_open ? "text-ink" : undefined}>
                    {h.is_open ? `${to12Hour(h.opens_at)} – ${to12Hour(h.closes_at)}` : "Closed"}
                  </span>
                </p>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="caps text-brand">Get in touch</p>
          <div className="mt-3 space-y-1 text-sm text-muted">
            {settings.phone ? (
              <p>
                <a href={`tel:${settings.phone}`} className="nums transition-colors hover:text-ink">
                  {settings.phone}
                </a>
              </p>
            ) : null}
            {settings.email ? (
              <p>
                <a href={`mailto:${settings.email}`} className="transition-colors hover:text-ink">
                  {settings.email}
                </a>
              </p>
            ) : null}
          </div>
          {Object.keys(socials).length ? (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {Object.entries(socials).map(([name, href]) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="caps text-muted transition-colors hover:text-ink"
                >
                  {name}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-muted">
          <p>
            © {year} {settings.studio_name}. Nasugbu, Batangas.
          </p>
          <Link href="/login" className="transition-colors hover:text-ink">
            Studio sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
