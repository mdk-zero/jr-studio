"use server";

import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { staffInviteEmail } from "@/lib/email/templates";
import type { ActionState } from "@/app/admin/catalog/actions";
import {
  staffAccessSchema,
  staffPhotoSchema,
  staffSchema,
  staffStatusSchema,
} from "@/lib/validators/people";

export type StaffState = ActionState & {
  /** Only outside live email mode, so the admin can pass the link on by hand. */
  inviteLink?: string;
};

function invalid(error: z.ZodError): ActionState {
  return { errors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

function describe(error: { code?: string; message: string }): string {
  // The role guard's messages ("The studio needs at least one admin", "You
  // cannot change your own role") are already written for people.
  if (error.code === "23505") return "That login already belongs to another team member.";
  return error.message;
}

/** The About page lists active staff, so team edits refresh it too. */
function refresh() {
  revalidatePath("/admin/staff");
  updateTag("staff");
}

export async function saveStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = staffSchema.safeParse({
    id: formData.get("id") || undefined,
    full_name: formData.get("full_name"),
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    address: formData.get("address") ?? undefined,
    position: formData.get("position"),
    birthday: formData.get("birthday") ?? undefined,
    hire_date: formData.get("hire_date") ?? undefined,
    show_on_about: formData.get("show_on_about") === "on",
    bio: formData.get("bio") ?? undefined,
    sort_order: formData.get("sort_order") || 0,
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { id, ...values } = parsed.data;

  const { error } = id
    ? await supabase.from("staff_members").update(values).eq("id", id)
    : await supabase.from("staff_members").insert(values);
  if (error) return { message: describe(error) };

  refresh();
  return { ok: true, message: id ? "Saved." : `${values.full_name} added to the team.` };
}

/**
 * Deactivating someone also takes away their back-office access at once:
 * authorization reads the live role, so there is no session to wait out.
 */
export async function setStaffStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();

  const parsed = staffStatusSchema.safeParse({
    staff_id: formData.get("staff_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("staff_members")
    .select("profile_id, profiles(role)")
    .eq("id", parsed.data.staff_id)
    .maybeSingle();
  if (!member) return { message: "That team member no longer exists." };

  if (parsed.data.status === "inactive" && member.profile_id) {
    if (member.profile_id === user.id) return { message: "You cannot deactivate yourself." };
    if (member.profiles && member.profiles.role !== "customer") {
      const { error } = await supabase
        .from("profiles")
        .update({ role: "customer" })
        .eq("id", member.profile_id);
      if (error) return { message: describe(error) };
    }
  }

  const { error } = await supabase
    .from("staff_members")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.staff_id);
  if (error) return { message: describe(error) };

  refresh();
  return {
    ok: true,
    message:
      parsed.data.status === "inactive"
        ? "Deactivated. Any back-office access they had is removed."
        : "Active again. Give them access again if they need to sign in.",
  };
}

/**
 * Gives, changes or removes back-office access.
 *
 * Someone with no account is invited: the account is created unconfirmed with
 * the role already set, and the studio sends the link from its own domain
 * (Supabase's built-in mailer only reaches the project's own team). Someone
 * who already has a customer account is simply promoted; they keep their
 * password. "none" demotes to customer rather than deleting the account.
 */
export async function setStaffAccessAction(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const user = await requireAdmin();

  const parsed = staffAccessSchema.safeParse({
    staff_id: formData.get("staff_id"),
    role: formData.get("role"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const { staff_id, role } = parsed.data;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("staff_members")
    .select("id, full_name, email, status, profile_id")
    .eq("id", staff_id)
    .maybeSingle();
  if (!member) return { message: "That team member no longer exists." };

  // Already linked: change the role on the existing account.
  if (member.profile_id) {
    if (member.profile_id === user.id) return { message: "You cannot change your own access." };
    if (role !== "none" && member.status !== "active") {
      return { message: "Reactivate them first." };
    }
    const { error } = await supabase
      .from("profiles")
      .update({ role: role === "none" ? "customer" : role })
      .eq("id", member.profile_id);
    if (error) return { message: describe(error) };

    refresh();
    return {
      ok: true,
      message: role === "none" ? "Access removed." : `Access changed to ${role}.`,
    };
  }

  if (role === "none") return { ok: true, message: "They have no login." };
  if (member.status !== "active") return { message: "Reactivate them first." };
  if (!member.email) return { message: "Add an email address first; the invite is sent there." };

  // An existing account with this email (they booked as a customer before).
  // Auth stores addresses lowercased, and so does the staff form; ilike would
  // treat an underscore in the address as a wildcard.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", member.email.toLowerCase())
    .maybeSingle();

  if (existing) {
    const { error: roleError } = await supabase.from("profiles").update({ role }).eq("id", existing.id);
    if (roleError) return { message: describe(roleError) };
    const { error } = await supabase
      .from("staff_members")
      .update({ profile_id: existing.id })
      .eq("id", member.id);
    if (error) return { message: describe(error) };

    refresh();
    return {
      ok: true,
      message: `${member.full_name} already had an account, so it now has ${role} access. They sign in with their usual password.`,
    };
  }

  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: member.email,
    options: { data: { full_name: member.full_name } },
  });
  if (linkError || !link.user) return { message: linkError?.message ?? "The invite could not be created." };

  // Set before the invitee confirms, so accepting does not create a customer
  // record for them (link_customer skips non-customer roles).
  const { error: roleError } = await admin.from("profiles").update({ role }).eq("id", link.user.id);
  if (roleError) {
    await admin.auth.admin.deleteUser(link.user.id);
    return { message: describe(roleError) };
  }

  const { error } = await supabase
    .from("staff_members")
    .update({ profile_id: link.user.id, invited_at: new Date().toISOString() })
    .eq("id", member.id);
  if (error) return { message: describe(error) };

  const result = await deliverInvite(member, role, link.properties.hashed_token, "invite", user.id);
  refresh();
  return result;
}

/** A new link for someone who has not accepted yet (links last an hour). */
export async function resendInviteAction(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const user = await requireAdmin();

  const id = z.string().uuid().safeParse(formData.get("staff_id"));
  if (!id.success) return { message: "That team member could not be found." };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("staff_members")
    .select("id, full_name, email, profile_id, profiles(role, email)")
    .eq("id", id.data)
    .maybeSingle();
  if (!member?.profile_id || !member.profiles) return { message: "Invite them first." };
  if (member.profiles.role === "customer") return { message: "Their access was removed. Give access again instead." };

  const admin = createAdminClient();
  const { data: account } = await admin.auth.admin.getUserById(member.profile_id);
  if (account.user?.email_confirmed_at) {
    return { message: "They have already accepted and can sign in. Use “Forgot password” if they are locked out." };
  }

  // The invite type only works for a new address; an existing unconfirmed
  // account gets a magic link, which confirms it in the same way.
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: member.profiles.email,
  });
  if (error) return { message: error.message };

  await supabase.from("staff_members").update({ invited_at: new Date().toISOString() }).eq("id", member.id);

  const result = await deliverInvite(
    { full_name: member.full_name, email: member.profiles.email },
    member.profiles.role,
    link.properties.hashed_token,
    "magiclink",
    user.id,
  );
  refresh();
  return result;
}

async function deliverInvite(
  member: { full_name: string; email: string | null },
  role: "staff" | "admin",
  tokenHash: string,
  type: "invite" | "magiclink",
  invitedBy: string,
): Promise<StaffState> {
  const next = encodeURIComponent("/reset-password?welcome=1");
  const link = `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?token_hash=${tokenHash}&type=${type}&next=${next}`;

  const sent = await sendEmail(
    member.email!,
    staffInviteEmail({ name: member.full_name.split(" ")[0] || member.full_name, role, link }),
    { template: "staff_invite", createdBy: invitedBy },
  );

  const testMode = process.env.EMAIL_MODE !== "live";
  if (!sent.ok) {
    return {
      message: `The account is ready, but the email failed (${sent.error}). Send the link below by hand, or try again.`,
      inviteLink: link,
    };
  }
  return {
    ok: true,
    message: testMode
      ? `Invite created. Email is in test mode, so it went to Resend's test inbox instead of ${member.email}. Share this link by hand:`
      : `Invite sent to ${member.email}. The link works for one hour.`,
    inviteLink: testMode ? link : undefined,
  };
}

/** The browser uploads to the staff bucket; this records it and drops the old file. */
export async function setStaffPhotoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = staffPhotoSchema.safeParse({
    staff_id: formData.get("staff_id"),
    path: formData.get("path"),
  });
  if (!parsed.success) return { message: "Upload the photo first." };
  if (!parsed.data.path.startsWith(`${parsed.data.staff_id}/`)) {
    return { message: "That photo belongs to someone else." };
  }

  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("staff_members")
    .select("photo_path")
    .eq("id", parsed.data.staff_id)
    .single();

  const { error } = await supabase
    .from("staff_members")
    .update({ photo_path: parsed.data.path })
    .eq("id", parsed.data.staff_id);
  if (error) return { message: describe(error) };

  if (previous?.photo_path && previous.photo_path !== parsed.data.path) {
    await supabase.storage.from("staff").remove([previous.photo_path]);
  }

  refresh();
  return { ok: true, message: "Photo updated." };
}
