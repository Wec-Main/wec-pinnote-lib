export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;
export const MAX_EMAIL_LENGTH = 254;

export function emailError(value: string): string | null {
  const email = value.trim();
  if (!email) {
    return "Email is required.";
  }
  if (/\s/.test(email)) {
    return "Email can't contain spaces.";
  }
  if (email.length > MAX_EMAIL_LENGTH) {
    return `Email must be ${MAX_EMAIL_LENGTH} characters or fewer.`;
  }
  const atCount = email.split("@").length - 1;
  if (atCount === 0) {
    return 'Include an "@" in the email, e.g. name@company.com.';
  }
  if (atCount > 1) {
    return 'Email can contain only one "@".';
  }
  const [local, domain] = email.split("@") as [string, string];
  return localPartError(local) ?? domainError(domain);
}

function localPartError(local: string): string | null {
  if (!local) {
    return 'Add the name before "@", e.g. name@company.com.';
  }
  const invalid = local.match(/[^A-Za-z0-9_'+\-.]/);
  if (invalid) {
    return `"${invalid[0]}" isn't allowed before "@". Use letters, numbers, and . _ ' + -`;
  }
  if (local.startsWith(".") || local.endsWith(".")) {
    return 'The name before "@" can\'t start or end with a dot.';
  }
  if (local.includes("..")) {
    return 'The name before "@" can\'t contain consecutive dots.';
  }
  return null;
}

function domainError(domain: string): string | null {
  if (!domain) {
    return 'Add a domain after "@", e.g. company.com.';
  }
  const labels = domain.split(".");
  const ending = labels[labels.length - 1] ?? "";
  if (labels.length < 2 || !ending) {
    return `"${domain}" is missing a domain ending, e.g. .com or .in.`;
  }
  if (labels.some((label) => label.length === 0)) {
    return "The domain can't start with a dot or contain consecutive dots.";
  }
  const invalid = domain.match(/[^A-Za-z0-9.-]/);
  if (invalid) {
    return `"${invalid[0]}" isn't allowed in the domain. Use letters, numbers, dots and hyphens.`;
  }
  if (labels.some((label) => label.startsWith("-"))) {
    return "Domain parts can't start with a hyphen.";
  }
  if (!/^[A-Za-z]{2,}$/.test(ending)) {
    return `".${ending}" isn't a valid domain ending. Use at least 2 letters and no numbers, e.g. .com or .ai.`;
  }
  return null;
}

export function passwordError(value: string): string | null {
  if (value.length === 0) {
    return null;
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    const missing = MIN_PASSWORD_LENGTH - value.length;
    return `Add ${missing} more character${missing === 1 ? "" : "s"}. Passwords need at least ${MIN_PASSWORD_LENGTH}, or leave it blank to generate one.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Passwords must be ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  }
  if (value.trim().length === 0) {
    return "A password can't be only spaces.";
  }
  return null;
}
