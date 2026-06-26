export function formatTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return "Never";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(value: Date | string | null | undefined) {
  if (!value) {
    return "Never";
  }

  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1_000);
  const absoluteSeconds = Math.abs(seconds);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];

  for (const [unit, unitSeconds] of units) {
    if (absoluteSeconds >= unitSeconds) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        Math.round(seconds / unitSeconds),
        unit,
      );
    }
  }

  return "Just now";
}

export function formatLatency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "No result";
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)} s`;
  }

  return `${value} ms`;
}

export function formatHttpStatus(value: number | null | undefined) {
  return value === null || value === undefined ? "No response" : String(value);
}
