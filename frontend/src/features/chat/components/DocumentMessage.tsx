import { Download, FileText, Paperclip } from "lucide-react";
import type { MessageAttachment } from "../types";
import { useAttachmentDownloadUrl } from "../hooks/useAttachmentDownloadUrl";

interface DocumentMessageProps {
  attachment: MessageAttachment;
}

export const DocumentMessage = ({ attachment }: DocumentMessageProps) => {
  const { resolvedUrl } = useAttachmentDownloadUrl(attachment);
  const IconComponent = attachment.type === "document" ? FileText : Paperclip;

  return (
    <div className="rounded-2xl border border-dashed border-white/40 bg-white/20 px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <IconComponent className="h-5 w-5" />
        <div className="flex flex-col">
          <span className="font-medium">{attachment.name || "Documento"}</span>
          {attachment.mimeType && <span className="text-xs opacity-80">{attachment.mimeType}</span>}
        </div>
      </div>
      {resolvedUrl ? (
        <a
          href={resolvedUrl}
          download={attachment.name}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/30 px-3 py-1 text-xs"
        >
          <Download className="h-3.5 w-3.5" /> Baixar arquivo
        </a>
      ) : (
        <span className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
          <Download className="h-3.5 w-3.5 animate-pulse" /> Gerando link...
        </span>
      )}
    </div>
  );
};
