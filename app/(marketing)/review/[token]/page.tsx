import { Suspense } from "react";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { feedbackTokenSchema } from "@/lib/validators/content";
import { formatManilaDate } from "@/lib/datetime";
import { ReviewForm } from "@/components/marketing/review-form";
import { submitReviewAction } from "./actions";

export const metadata: Metadata = {
  title: "Leave a review",
  // A personal link; nothing here belongs in a search index.
  robots: { index: false, follow: false },
};

/**
 * The page behind an emailed review link. The token is looked up per request,
 * so that part streams in under Suspense while the page frame prerenders.
 */
export default function ReviewPage(props: PageProps<"/review/[token]">) {
  return (
    <div className="mx-auto w-full max-w-xl px-5 py-14">
      <p className="caps text-burgundy-500">Your session</p>
      <h1 className="font-display mt-4 text-4xl font-semibold text-burgundy-700">How did we do?</h1>
      <div className="mt-8 border border-sand-300 bg-white p-6 sm:p-8">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <ReviewBody params={props.params} />
        </Suspense>
      </div>
    </div>
  );
}

async function ReviewBody({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = feedbackTokenSchema.safeParse(token);

  const { data } = valid.success
    ? await createPublicClient().rpc("get_feedback_request", { p_token: token })
    : { data: null };
  const request = data?.[0];

  if (!request) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        This review link isn&apos;t valid. If you copied it from an email, check that the whole link came across.
      </p>
    );
  }
  if (request.state === "done") {
    return <p className="text-sm leading-relaxed text-ink">Your review is already in. Thank you!</p>;
  }
  if (request.state === "expired") {
    return (
      <p className="text-sm leading-relaxed text-muted">
        This link has expired. Reply to the email it came in, and the studio will send a new one.
      </p>
    );
  }

  return (
    <>
      <p className="mb-6 text-sm leading-relaxed text-muted">
        Hi {request.first_name}! Tell us about your {request.package_name ?? "session"} on{" "}
        {formatManilaDate(request.session_at)}. Your review appears on our website after the studio reads it.
      </p>
      <ReviewForm action={submitReviewAction} hidden={{ token }} defaultName={request.first_name} />
    </>
  );
}
