import { afterEach, describe, expect, it } from "vitest";
import { adminClient, anonClient, hasCredentials } from "./helpers";

/**
 * Exercises signup, email confirmation and the walk-in claim against the real
 * Auth service.
 *
 * generateLink() creates the user and returns the OTP WITHOUT sending an email,
 * which matters twice over: Supabase's default email provider is rate limited to
 * a couple of messages an hour, and custom templates (the 6-digit code) are not
 * available until Resend SMTP is configured.
 */
describe.skipIf(!hasCredentials)("signup and email confirmation", () => {
  const createdUserIds: string[] = [];
  const createdEmails: string[] = [];

  afterEach(async () => {
    const db = adminClient();
    for (const id of createdUserIds.splice(0)) {
      await db.auth.admin.deleteUser(id).catch(() => {});
    }
    if (createdEmails.length) {
      await db.from("customers").delete().in("email", createdEmails.splice(0));
    }
  });

  function uniqueEmail(label: string) {
    const email = `test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    createdEmails.push(email);
    return email;
  }

  const password = "Str0ngPassw0rd";

  async function startSignup(email: string) {
    const { data, error } = await adminClient().auth.admin.generateLink({
      type: "signup",
      email,
      password,
    });
    if (error) throw error;
    createdUserIds.push(data.user.id);
    return { userId: data.user.id, otp: data.properties.email_otp };
  }

  it("creates a profile on signup, with the role forced to customer", async () => {
    const email = uniqueEmail("profile");
    const { userId } = await startSignup(email);

    const { data: profile } = await adminClient()
      .from("profiles").select("role, email, full_name").eq("id", userId).single();

    expect(profile).not.toBeNull();
    expect(profile!.role).toBe("customer");
    expect(profile!.email).toBe(email);
  });

  it("does NOT claim a walk-in until the email is confirmed", async () => {
    const email = uniqueEmail("claim");
    const db = adminClient();

    // An admin took this customer's details at the counter.
    const { data: walkIn, error: walkInError } = await db
      .from("customers")
      .insert({ full_name: "Walk-in Customer", email, phone: "09171110099" })
      .select("id")
      .single();
    expect(walkInError).toBeNull();

    const { userId, otp } = await startSignup(email);

    // Before confirmation the walk-in must stay unclaimed: otherwise signing up
    // with someone else's address would inherit their booking history.
    const { data: beforeConfirm } = await db
      .from("customers").select("profile_id").eq("id", walkIn!.id).single();
    expect(beforeConfirm!.profile_id).toBeNull();

    // Confirm with the 6-digit code.
    const { data: session, error: verifyError } = await anonClient().auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    expect(verifyError).toBeNull();
    expect(session.user!.id).toBe(userId);

    // Now it is claimed, and no duplicate was created.
    const { data: after } = await db
      .from("customers").select("id, profile_id").eq("email", email);
    expect(after).toHaveLength(1);
    expect(after![0].id).toBe(walkIn!.id);
    expect(after![0].profile_id).toBe(userId);
  });

  it("creates a fresh customer record when there is no walk-in to claim", async () => {
    const email = uniqueEmail("fresh");
    const { userId, otp } = await startSignup(email);

    const { error } = await anonClient().auth.verifyOtp({ email, token: otp, type: "email" });
    expect(error).toBeNull();

    const { data } = await adminClient()
      .from("customers").select("id, profile_id, full_name").eq("profile_id", userId);
    expect(data).toHaveLength(1);
  });

  it("rejects a wrong confirmation code", async () => {
    const email = uniqueEmail("badcode");
    await startSignup(email);

    const { error } = await anonClient().auth.verifyOtp({
      email,
      token: "000000",
      type: "email",
    });
    expect(error).not.toBeNull();
  });

  it("refuses sign-in until the email is confirmed, then allows it", async () => {
    const email = uniqueEmail("signin");
    const { otp } = await startSignup(email);

    const before = await anonClient().auth.signInWithPassword({ email, password });
    expect(before.error).not.toBeNull();
    expect(before.error!.message).toMatch(/not confirmed/i);

    await anonClient().auth.verifyOtp({ email, token: otp, type: "email" });

    const after = await anonClient().auth.signInWithPassword({ email, password });
    expect(after.error).toBeNull();
    expect(after.data.session).not.toBeNull();
  });

  it("rejects a wrong password", async () => {
    const email = uniqueEmail("wrongpw");
    const { otp } = await startSignup(email);
    await anonClient().auth.verifyOtp({ email, token: otp, type: "email" });

    const { error } = await anonClient().auth.signInWithPassword({
      email,
      password: "Wr0ngPassword",
    });
    expect(error).not.toBeNull();
  });

  it("enforces the password policy pushed to the project", async () => {
    // minimum_password_length = 8, password_requirements =
    // lower_upper_letters_digits. The legacy signup accepted any non-empty value.
    const { error } = await anonClient().auth.signUp({
      email: uniqueEmail("weakpw"),
      password: "short",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/password/i);
  });

  it("issues a 6-digit code, matching the verify form", async () => {
    const email = uniqueEmail("otplen");
    const { otp } = await startSignup(email);
    expect(otp).toMatch(/^\d{6}$/);
  });
});
