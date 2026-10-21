import type { Metadata } from "next";
import { getStudioSettings } from "@/lib/catalog";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Ask J&R Studio about packages, dates and custom shoots in Nasugbu, Batangas.",
};

export default async function ContactPage() {
  const settings = await getStudioSettings();
  const socials = (settings.socials ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14">
      <header className="border-b border-burgundy-600/20 pb-6">
        <p className="caps text-burgundy-500">Get in touch</p>
        <h1 className="font-display mt-4 text-4xl font-semibold text-burgundy-700 sm:text-5xl">Contact</h1>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_20rem]">
        <section className="max-w-xl border border-sand-300 bg-white p-6 sm:p-8">
          <p className="mb-6 text-sm leading-relaxed text-muted">
            Questions about a package, a date, or a shoot that isn&apos;t on the list? Write to us and the studio
            will get back to you, usually within a day.
          </p>
          <ContactForm />
        </section>

        <aside className="flex flex-col gap-8 text-sm">
          {settings.phone ? (
            <div>
              <p className="caps text-burgundy-500">Call or text</p>
              <a href={`tel:${settings.phone}`} className="nums mt-2 block text-lg text-ink hover:text-burgundy-700">
                {settings.phone}
              </a>
            </div>
          ) : null}
          {settings.address ? (
            <div>
              <p className="caps text-burgundy-500">Visit</p>
              <p className="mt-2 leading-relaxed text-muted">{settings.address}</p>
              {settings.map_url ? (
                <a
                  href={settings.map_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="caps mt-2 inline-block text-burgundy-600 underline underline-offset-4"
                >
                  Open in Maps
                </a>
              ) : null}
            </div>
          ) : null}
          {Object.keys(socials).length ? (
            <div>
              <p className="caps text-burgundy-500">Message us</p>
              <ul className="mt-2 space-y-1">
                {Object.entries(socials).map(([name, href]) => (
                  <li key={name}>
                    <a href={href} target="_blank" rel="noreferrer noopener" className="text-ink capitalize hover:text-burgundy-700">
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
