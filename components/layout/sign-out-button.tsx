import { signOutAction } from "@/app/(auth)/actions";

export function SignOutButton() {
  // A form, not a link: signing out is a mutation and must not be reachable by
  // a GET (a prefetch or an <img> tag could otherwise trigger it).
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="text-sm font-medium text-burgundy-600 underline underline-offset-4"
      >
        Sign out
      </button>
    </form>
  );
}
