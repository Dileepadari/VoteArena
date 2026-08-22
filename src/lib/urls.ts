/** Absolute link a voter can open, used for QR codes and the share sheet. */
export function joinUrl(code: string): string {
  return `${window.location.origin}/v/${code}`;
}

export function wallUrl(code: string): string {
  return `${window.location.origin}/w/${code}`;
}

export function consoleUrl(code: string): string {
  return `${window.location.origin}/c/${code}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context; fall back to the legacy path so
    // copying still works when the host runs this over plain HTTP on a LAN.
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export async function shareOrCopy(title: string, url: string): Promise<"shared" | "copied" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (err) {
      // The user dismissing the share sheet is not a failure worth reporting.
      if ((err as Error)?.name === "AbortError") return "shared";
    }
  }
  return (await copyText(url)) ? "copied" : "failed";
}
