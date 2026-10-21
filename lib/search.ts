/**
 * Keeps a search term to characters that cannot change the meaning of a
 * PostgREST or=() filter. Values are also double-quoted where they are used,
 * because dots (as in an email address) are reserved in that syntax.
 */
export function searchTerm(q: string): string {
  return q.replace(/[^\p{L}\p{N}\s@.+-]/gu, "").trim();
}

/** name/email/phone contains the term, as an or=() filter body. */
export function contactMatch(term: string): string {
  return `full_name.ilike."%${term}%",email.ilike."%${term}%",phone.ilike."%${term}%"`;
}
