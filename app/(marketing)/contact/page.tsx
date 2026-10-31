import type { Metadata } from "next";
import { getStudioSettings } from "@/lib/catalog";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Ask J&R Studio about photo and video packages, dates and custom shoots in Nasugbu, Batangas.",
};

export default async function ContactPage() {
  const settings = await getStudioSettings();
  const socials = (settings.socials ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
      <header className="border-b border-line pb-8">
        <p className="caps text-brand">Get in touch</p>
        <h1 className="mt-4 text-5xl font-semibold text-heading sm:text-6xl">Contact</h1>
      </header>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_20rem]">
        <section className="max-w-xl border border-line bg-surface p-6 sm:p-8">
          <p className="mb-6 text-sm leading-relaxed text-muted">
            Questions about a package, a date, or a shoot that isn&apos;t on the list? Write to us and the studio
            will get back to you, usually within a day.
          </p>
          <ContactForm />
        </section>

        <aside className="flex flex-col gap-8 text-sm">
          {settings.phone ? (
            <div className="border-t border-line pt-4">
              <p className="caps text-brand">Call or text</p>
              <a href={`tel:${settings.phone}`} className="nums mt-2 block font-display text-2xl text-ink transition-colors hover:text-brand">
                {settings.phone}
              </a>
            </div>
          ) : null}
          {settings.address ? (
            <div className="border-t border-line pt-4">
              <p className="caps text-brand">Visit the studio</p>
              <p className="mt-2 leading-relaxed text-muted">{settings.address}</p>
              {settings.map_url ? (
                <a
                  href={settings.map_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="caps mt-3 inline-block text-ink underline underline-offset-4 transition-colors hover:text-brand"
                >
                  Open in Maps
                </a>
              ) : null}
            </div>
          ) : null}
          {Object.keys(socials).length ? (
            <div className="border-t border-line pt-4">
              <p className="caps text-brand">Message us</p>
              <ul className="mt-2 space-y-1">
                {Object.entries(socials).map(([name, href]) => (
                  <li key={name}>
                    <a href={href} target="_blank" rel="noreferrer noopener" className="text-ink capitalize transition-colors hover:text-brand">
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
