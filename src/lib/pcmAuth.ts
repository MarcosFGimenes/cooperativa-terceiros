export function isPCMUser(userEmail: string): boolean {
  if (!userEmail) return false;

  const allowlist = process.env.PCM_EMAILS;
  if (!allowlist) return false;

  const normalizedEmail = userEmail.trim().toLowerCase();
  if (!normalizedEmail) return false;

  return allowlist
    .split(";")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}
