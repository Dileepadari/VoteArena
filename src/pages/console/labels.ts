/**
 * Turns a pasted block into a list of option labels.
 *
 * Hosts paste from all sorts of places - a spreadsheet column, a Slack message,
 * a comma-separated list someone typed - so newlines, commas, semicolons and
 * tabs are all treated as separators. Quoted values keep their commas.
 */
export function parseLabels(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    for (const part of splitLine(line)) {
      const label = part.trim().replace(/^["']|["']$/g, "").trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(label);
    }
  }

  return out;
}

function splitLine(line: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (const char of line) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "," || char === ";" || char === "\t") {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  parts.push(current);
  return parts;
}
