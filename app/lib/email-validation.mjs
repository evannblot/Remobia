/** The same address rules are used before preparing a request and before sending email. */
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

/** @param {string} value */
export function isValidEmail(value) {
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) return false;
  const [local, domain] = value.split("@");
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") &&
    !local.includes("..") && domain.split(".").every((label) => label.length <= 63);
}
