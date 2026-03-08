export const resolvePixImageSrc = (pixQrCodeRaw: string | null | undefined): string | null => {
  if (!pixQrCodeRaw) {
    return null;
  }

  const trimmed = pixQrCodeRaw.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith("data:image") ? trimmed : `data:image/png;base64,${trimmed}`;
};

export const resolveBoletoLink = (
  charge?: { boletoUrl?: string | null | undefined; invoiceUrl?: string | null | undefined } | null,
): string | null => {
  if (!charge) {
    return null;
  }

  const candidates = [charge.boletoUrl, charge.invoiceUrl];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return null;
};
