import { redirect } from "next/navigation";

/** Back office: reads the session and live data, so it renders per request. */
export const instant = false;

export default function CatalogIndex() {
  redirect("/admin/catalog/packages");
}
