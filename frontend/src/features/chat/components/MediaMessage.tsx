import { Image as ImageIcon, PlayCircle } from "lucide-react";
import type { MessageAttachment } from "../types";
import { useAttachmentDownloadUrl } from "../hooks/useAttachmentDownloadUrl";

interface MediaMessageProps {
  attachment: MessageAttachment;
}

export const MediaMessage = ({ attachment }: MediaMessageProps) => {
  const { resolvedUrl, isLoading } = useAttachmentDownloadUrl(attachment);
  const isImage = attachment.type === "image";

  if (!resolvedUrl && isLoading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-white/20 bg-black/5 text-slate-500">
        {isImage ? <ImageIcon className="h-6 w-6 animate-pulse" /> : <PlayCircle className="h-8 w-8 animate-pulse" />}
      </div>
    );
  }

  if (!resolvedUrl) {
    return null;
  }

  if (isImage) {
    return (
      <img
        src={resolvedUrl}
        alt={attachment.name}
        className="max-h-72 w-full rounded-2xl object-cover"
      />
    );
  }

  return (
    <div className="space-y-2">
      <video controls src={resolvedUrl} className="max-h-72 w-full rounded-2xl" />
      {attachment.name && <p className="text-xs opacity-80">{attachment.name}</p>}
    </div>
  );
};
