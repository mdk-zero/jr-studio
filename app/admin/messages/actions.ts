"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/app/admin/catalog/actions";

const readSchema = z.object({ id: z.string().uuid(), is_read: z.boolean() });

/** The sidebar badge counts unread messages, so the whole admin refreshes. */
function refresh() {
  revalidatePath("/admin", "layout");
}

export async function markReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();

  const parsed = readSchema.safeParse({
    id: formData.get("id"),
    is_read: formData.get("is_read") === "true",
  });
  if (!parsed.success) return { message: "That message could not be found." };

  // Staff hold UPDATE on is_read only; the message itself is the visitor's.
  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({ is_read: parsed.data.is_read })
    .eq("id", parsed.data.id);
  if (error) return { message: error.message };

  refresh();
  return { ok: true };
}

export async function deleteMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "That message could not be found." };

  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").delete().eq("id", id.data);
  if (error) return { message: error.message };

  refresh();
  return { ok: true, message: "Message deleted." };
}
