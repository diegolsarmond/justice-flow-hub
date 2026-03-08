import { useEffect, useState } from "react";
import type { MessageAttachment } from "../types";
import { requestTemporaryAttachmentUrl } from "../utils/attachmentDownload";

export const useAttachmentDownloadUrl = (attachment: MessageAttachment) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(() =>
    attachment.downloadUrl ? undefined : attachment.url,
  );
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(attachment.downloadUrl));

  useEffect(() => {
    if (!attachment.downloadUrl) {
      setResolvedUrl(attachment.url);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    setIsLoading(true);
    requestTemporaryAttachmentUrl(attachment.downloadUrl, attachment.url, controller.signal)
      .then((url) => {
        if (!isMounted) {
          return;
        }
        setResolvedUrl(url ?? attachment.url ?? attachment.downloadUrl);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setResolvedUrl(attachment.url ?? attachment.downloadUrl);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [attachment.downloadUrl, attachment.url, attachment.id]);

  return { resolvedUrl, isLoading };
};
