import { z } from "zod";
import { describe, expect, it } from "vitest";
import { Currency, DocumentKind, DocumentSource } from "@/lib/enums";
import documents from "./__fixtures__/invoices/documents.json";
import writeOffs from "./__fixtures__/invoices/write-offs.json";
import {
  envelope,
  invoiceDocumentSchema,
  paginated,
  writeOffSchema,
} from "./schemas";

// Real responses from the Accounts API (mgcfreight/accounting
// feature/25-billing-notices) over the local demo data, captured over HTTP
// as an Admin: a POD uploaded to a demo invoice, and the demo write-off.

describe("invoice document and write-off schemas on real responses", () => {
  it("reads an invoice's documents", () => {
    const { data } = envelope(z.array(invoiceDocumentSchema)).parse(documents);
    expect(data[0].kind).toBe(DocumentKind.Pod);
    expect(data[0].source).toBe(DocumentSource.Upload);
    expect(data[0].sizeBytes).toBeGreaterThan(0);
  });

  it("reads write-offs with their tax relief", () => {
    const { data } = envelope(paginated(writeOffSchema)).parse(writeOffs);
    const [first] = data.items;
    expect(first.currency).toBe(Currency.CAD);
    expect(first.taxes.length).toBeGreaterThan(0);
    expect(first.reversedAt).toBeNull();
  });

  it("refuses a write-off amount sent as a number", () => {
    const [first] = writeOffs.data.items;
    const bad = {
      ...writeOffs,
      data: { ...writeOffs.data, items: [{ ...first, amount: 150 }] },
    };
    expect(() => envelope(paginated(writeOffSchema)).parse(bad)).toThrow();
  });
});
