import { DocumentLink } from "@/lib/documents";

// TMS documents as links that open in a new tab. Without a configured
// storage URL a document is named but not linked.
export default function DocumentList({
  documents,
  emptyContent = "No documents from the TMS",
}: {
  documents: DocumentLink[];
  emptyContent?: string;
}) {
  if (documents.length === 0) {
    return <p className="text-sm text-content-5">{emptyContent}</p>;
  }
  return (
    <ul className="text-sm text-[#343A40] space-y-2">
      {documents.map((document) => (
        <li key={document.kind} className="flex flex-wrap justify-between gap-2">
          <span>{document.label}</span>
          {document.href ? (
            <a
              href={document.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base-primary-300 hover:underline break-all"
            >
              Open {document.fileName}
            </a>
          ) : (
            <span className="text-content-5 break-all">
              {document.fileName} (link not set up)
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
