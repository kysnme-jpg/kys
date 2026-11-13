/**
 * Splitting and joining people's names. Layaway and borrowed agreements store a
 * first and last name separately, plus the full name for display and emails.
 */

/** "Mary Ann Smith" → { firstName: "Mary Ann", lastName: "Smith" }. A single word is a first name. */
export function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

/** Join first + last into a single display name, tidying stray spaces. */
export function joinName(firstName?: string | null, lastName?: string | null): string {
  return [firstName, lastName].map((v) => String(v || "").trim().replace(/\s+/g, " ")).filter(Boolean).join(" ");
}

/**
 * Work out first / last / full from whatever a form sent: separate fields when
 * present, otherwise a single full-name field (older callers).
 */
export function resolveName(input: { firstName?: string | null; lastName?: string | null; full?: string | null }): { firstName: string; lastName: string; full: string } {
  const first = String(input.firstName || "").trim();
  const last = String(input.lastName || "").trim();
  if (first || last) return { firstName: first, lastName: last, full: joinName(first, last) };
  const split = splitName(input.full);
  return { ...split, full: joinName(split.firstName, split.lastName) };
}
