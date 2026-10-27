import { afterEach, describe, expect, it, vi } from "vitest";
import { TmsDocumentKind } from "./enums";

// The storage URL is read when the module loads, so each case loads it anew.
const load = async (mediaUrl: string) => {
  vi.stubEnv("VITE_MGC_MEDIA_URL", mediaUrl);
  vi.resetModules();
  return import("./documents");
};

afterEach(() => vi.unstubAllEnvs());

describe("documentLinks", () => {
  const documents = {
    [TmsDocumentKind.Bol]: "shipments/shi_ab-1/bol.pdf",
    [TmsDocumentKind.CarrierInvoicePdf]: "hBiZKa0ZlCxdm-ws89mpF.pdf",
  };

  it("links each document under the storage URL, in the order asked", async () => {
    const { documentLinks } = await load("https://files.example.com/");
    const links = documentLinks(documents, [
      TmsDocumentKind.CarrierInvoicePdf,
      TmsDocumentKind.ShippingLabels,
      TmsDocumentKind.Bol,
    ]);

    expect(links.map((link) => link.kind)).toEqual([
      TmsDocumentKind.CarrierInvoicePdf,
      TmsDocumentKind.Bol,
    ]);
    expect(links[1].href).toBe(
      "https://files.example.com/shipments/shi_ab-1/bol.pdf"
    );
    expect(links[1].fileName).toBe("bol.pdf");
  });

  it("names documents without links when no storage URL is set", async () => {
    const { documentLinks } = await load("");
    expect(documentLinks(documents).every((link) => link.href === null)).toBe(true);
  });

  it("ignores a storage URL that isn't http(s)", async () => {
    const { documentLinks } = await load("javascript:alert(1)//");
    expect(documentLinks(documents)[0].href).toBeNull();
  });
});
