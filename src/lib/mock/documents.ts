import { Attachment } from "../interfaces";

// Sample supporting documents shown on every carrier invoice until the
// Accounts API can upload and list them. Not files from any real invoice.
export const demoCarrierDocuments: Attachment[] = [
  { id: "doc_demo_pod", kind: "POD", fileName: "POD-signed.pdf" },
  { id: "doc_demo_other", kind: "OTHER", fileName: "lumper-receipt.jpg" },
];
