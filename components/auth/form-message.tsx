export function FormMessage({ message, ok }: { message?: string; ok?: boolean }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={
        ok
          ? "rounded-lg bg-burgundy-50 px-3 py-2 text-sm text-burgundy-700"
          : "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
      }
    >
      {message}
    </p>
  );
}
