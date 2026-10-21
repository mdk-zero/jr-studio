"use server";

import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";
import { feedbackTokenSchema, reviewSchema } from "@/lib/validators/content";

export type ReviewState = {
  errors?: Record<string, string[]>;
  message?: string;
  ok?: boolean;
};

/**
 * A review from an emailed link. No account is needed: the token is the
 * credential, and submit_feedback checks it, its age, and that the session
 * has not been reviewed already.
 */
export async function submitReviewAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const token = feedbackTokenSchema.safeParse(formData.get("token"));
  if (!token.success) return { message: "This review link is not valid." };

  const parsed = reviewSchema.safeParse({
    rating: formData.get("rating"),
    message: formData.get("message"),
    author_name: formData.get("author_name"),
  });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const { error } = await createPublicClient().rpc("submit_feedback", {
    p_token: token.data,
    p_rating: parsed.data.rating,
    p_message: parsed.data.message,
    p_author_name: parsed.data.author_name,
  });

  if (error) {
    // "Already in" is good news, not a failure.
    if (error.code === "23505") return { ok: true, message: "Your review is already in. Thank you!" };
    return { message: error.message };
  }

  return { ok: true, message: "Thank you! Your review will appear on our website once the studio has read it." };
}
