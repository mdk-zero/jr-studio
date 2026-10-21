import { Suspense } from "react";
import type { Metadata } from "next";
import { UnsubscribeForm } from "@/components/marketing/unsubscribe-form";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default function UnsubscribePage(props: PageProps<"/unsubscribe">) {
  return (
    <div className="mx-auto w-full max-w-xl px-5 py-14">
      <p className="caps text-burgundy-500">Email preferences</p>
      <h1 className="font-display mt-4 text-4xl font-semibold text-burgundy-700">Unsubscribe</h1>
      <div className="mt-8 border border-sand-300 bg-white p-6 sm:p-8">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <Body searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) {
    return <p className="text-sm text-muted">This link is missing its code. Use the link from the email itself.</p>;
  }
  return <UnsubscribeForm token={token} />;
}
