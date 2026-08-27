/** Formatos QR SIGAF para lector USB / escáner. */

export type QrKind = "box" | "document" | "expediente" | "unknown";

export type ParsedQr = {
  kind: QrKind;
  /** Código de negocio (CAJ-004, DOC-…, EXP-…) */
  code: string | null;
  /** Identificador interno SIGAF-BOX-… / QR documento si viene en el payload */
  qrCode: string | null;
  raw: string;
};

/** Payload corto para etiquetas de caja (fácil de escanear). */
export function buildBoxQrPayload(boxCode: string, qrCode?: string) {
  if (qrCode) return `SIGAF:BOX:${boxCode}|${qrCode}`;
  return `SIGAF:BOX:${boxCode}`;
}

export function buildExpedienteQrPayload(code: string) {
  return `SIGAF:EXP:${code}`;
}

export function buildDocumentQrPayload(code: string, qrCode?: string) {
  if (qrCode) return `SIGAF:DOC:${code}|${qrCode}`;
  return `SIGAF:DOC:${code}`;
}

/**
 * Interpreta lo que pega un lector USB (texto plano, JSON legado o prefijos SIGAF:).
 */
export function parseQrPayload(rawInput: string): ParsedQr {
  const raw = rawInput.trim();
  if (!raw) return { kind: "unknown", code: null, qrCode: null, raw };

  // JSON legado de etiquetas de caja
  if (raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw) as { t?: string; code?: string; qr?: string };
      if (obj.t === "box" || obj.code?.toUpperCase().startsWith("CAJ")) {
        return {
          kind: "box",
          code: obj.code ?? null,
          qrCode: obj.qr ?? null,
          raw,
        };
      }
    } catch {
      /* no es JSON válido */
    }
  }

  const upper = raw.toUpperCase();

  // SIGAF:BOX:CAJ-004|SIGAF-BOX-…
  const sigaf = raw.match(/^SIGAF:(BOX|DOC|EXP):([^|\s]+)(?:\|(\S+))?$/i);
  if (sigaf) {
    const kindMap = { BOX: "box", DOC: "document", EXP: "expediente" } as const;
    const kind = kindMap[sigaf[1].toUpperCase() as keyof typeof kindMap] ?? "unknown";
    return {
      kind,
      code: sigaf[2]?.trim() || null,
      qrCode: sigaf[3]?.trim() || null,
      raw,
    };
  }

  // CAJ:CAJ-004 o CAJ-004
  if (upper.startsWith("CAJ:") || /^CAJ[-_]?\d+/i.test(raw)) {
    const code = raw.replace(/^CAJ:/i, "").trim();
    return { kind: "box", code, qrCode: null, raw };
  }

  // EXP:…
  if (upper.startsWith("EXP:")) {
    return { kind: "expediente", code: raw.slice(4).trim(), qrCode: null, raw };
  }

  // Identificador interno de caja
  if (upper.startsWith("SIGAF-BOX-")) {
    return { kind: "box", code: null, qrCode: raw, raw };
  }

  return { kind: "unknown", code: raw, qrCode: raw, raw };
}
