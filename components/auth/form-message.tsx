export function FormMessage({ message, ok }: { message?: string; ok?: boolean }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={
        ok
          ? "rounded-sm bg-tint px-3 py-2 text-sm text-on-tint"
          : "rounded-sm bg-danger-tint px-3 py-2 text-sm text-danger"
      }
    >
      {message}
    </p>
  );
}
