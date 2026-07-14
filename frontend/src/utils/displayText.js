export function toTitleCaseWords(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\b([a-z0-9])/g, (match) => match.toUpperCase());
}

export function formatPersonName(firstName = "", lastName = "", fallback = "") {
  const fullName = `${firstName || ""} ${lastName || ""}`.trim();
  return toTitleCaseWords(fullName || fallback);
}
