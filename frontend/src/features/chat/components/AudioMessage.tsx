import { Music2 } from "lucide-react";
import type { MessageAttachment } from "../types";
import { useAttachmentDownloadUrl } from "../hooks/useAttachmentDownloadUrl";

interface AudioMessageProps {
  attachment: MessageAttachment;
}

export const AudioMessage = ({ attachment }: AudioMessageProps) => {
  const { resolvedUrl, isLoading } = useAttachmentDownloadUrl(attachment);

  if (!resolvedUrl && isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm text-slate-500">
        <Music2 className="h-4 w-4 animate-pulse" />
        <span>Gerando áudio...</span>
      </div>
    );
  }

  if (!resolvedUrl) {
    return null;
  }

  return (
    <div className="space-y-1">
      <audio controls src={resolvedUrl} className="w-full rounded-lg">
        Seu navegador não suporta a reprodução de áudio.
      </audio>
      {attachment.name && <p className="text-xs opacity-80">{attachment.name}</p>}
    </div>
  );
};
