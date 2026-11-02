import { Attachment } from "../interfaces";

// Sample supporting documents shown on every invoice until the
// Accounts API can upload and list them. Not files from any real invoice.
export const demoCarrierDocuments: Attachment[] = [
  { id: "doc_demo_pod", kind: "POD", fileName: "POD-signed.pdf" },
  { id: "doc_demo_other", kind: "OTHER", fileName: "lumper-receipt.jpg" },
];

// The same for every shipper invoice: what a shipper is sent with its bill.
export const demoShipperDocuments: Attachment[] = [
  { id: "doc_demo_bol", kind: "BOL", fileName: "BOL-signed.pdf" },
  { id: "doc_demo_pod", kind: "POD", fileName: "POD-signed.pdf" },
];
