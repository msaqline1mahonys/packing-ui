import { getDomainDataForUser } from "@/lib/contact-users-store";
import { resolveLogoSrc } from "@/lib/in-ticket-print";

/** Resolve typed name + optional image signature from a contact user row. */
export function signatureFieldsForUser(user) {
  if (!user) {
    return { signatureText: "", signatureImageUrl: "" };
  }
  const domain = getDomainDataForUser(user.id);
  const file =
    user.signatureFile ??
    user.signature_file ??
    user.signatureFilePath ??
    domain?.signatureFile ??
    domain?.signatureFilePath ??
    "";
  const signatureText = String(user.signature ?? "").trim();
  const signatureImageUrl = file ? resolveLogoSrc(file) : "";
  return { signatureText, signatureImageUrl };
}

export function findContactUserByName(users, name) {
  const target = String(name ?? "").trim();
  if (!target) return null;
  return (users || []).find((u) => String(u.name ?? "").trim() === target) ?? null;
}

/** Look up signature text/image for a user matched by display name. */
export function resolveSignatureForName(name, users) {
  return signatureFieldsForUser(findContactUserByName(users, name));
}

/** Merge stored signature text with profile image/text from contact users. */
export function resolveSignoffFields(name, storedSignature, users) {
  const fromUser = resolveSignatureForName(name, users);
  const stored = String(storedSignature ?? "").trim();
  const signatureText = stored || fromUser.signatureText;
  const signatureImageUrl =
    stored.startsWith("data:") || stored.startsWith("http") || stored.startsWith("/")
      ? resolveLogoSrc(stored)
      : fromUser.signatureImageUrl;
  return { signatureText, signatureImageUrl };
}
