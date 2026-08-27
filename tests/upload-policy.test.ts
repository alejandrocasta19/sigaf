import { describe, expect, it } from "vitest";
import { assertSafeFilename, assertAllowedUpload, assertUploadIntent } from "@/shared/kernel/upload-policy";

describe("upload-policy", () => {
  it("rechaza doble extensión peligrosa archivo.pdf.exe", () => {
    expect(() => assertSafeFilename("archivo.pdf.exe")).toThrow(/peligrosa/i);
  });

  it("rechaza malware.exe.pdf", () => {
    expect(() => assertSafeFilename("malware.exe.pdf")).toThrow(/peligrosa/i);
  });

  it("acepta documento.pdf", () => {
    const r = assertSafeFilename("Mi Documento 2026.pdf");
    expect(r.ext).toBe(".pdf");
    expect(r.base.endsWith(".pdf")).toBe(true);
  });

  it("valida magic PDF", async () => {
    const buf = Buffer.from("%PDF-1.4\n% fake pdf content for test");
    const r = await assertAllowedUpload({ name: "a.pdf", type: "application/pdf" }, buf);
    expect(r.detectedMime).toBe("application/pdf");
  });

  it("rechaza exe disfrazado de pdf por magic", async () => {
    const buf = Buffer.from("MZ\x90\x00this is not a pdf");
    await expect(
      assertAllowedUpload({ name: "a.pdf", type: "application/pdf" }, buf)
    ).rejects.toThrow();
  });

  it("rechaza intent por tamaño antes de firmar", () => {
    expect(() =>
      assertUploadIntent({ name: "huge.pdf", type: "application/pdf", size: 999 * 1024 * 1024 })
    ).toThrow(/máximo/i);
  });
});
