import { forwardRef, useEffect, useState, type SyntheticEvent } from "react";
import { AlertCircle, Check, CheckCheck, Clock, Download, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import type { Message, MessageStatus } from "../types";
import { formatMessageTimestamp } from "../utils/format";
import styles from "./MessageBubble.module.css";

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  isFirstOfGroup: boolean;
  avatarUrl?: string;
}

export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(
  ({ message, isOwnMessage, isFirstOfGroup, avatarUrl }, ref) => {
    const [audioDurations, setAudioDurations] = useState<Record<string, string>>({});

    const statusMeta: Record<
      MessageStatus,
      { Icon: LucideIcon; label: string; className: string }
    > = {
      pending: { Icon: Clock, label: "Pendente", className: styles.statusPending },
      sent: { Icon: Check, label: "Enviada", className: styles.statusSent },
      delivered: { Icon: CheckCheck, label: "Entregue", className: styles.statusDelivered },
      read: { Icon: CheckCheck, label: "Lida", className: styles.statusRead },
      failed: { Icon: AlertCircle, label: "Falha ao enviar", className: styles.statusFailed },
    };

    const renderStatusIcon = (status: MessageStatus = "pending") => {
      const meta = statusMeta[status] ?? statusMeta.pending;
      const Icon = meta.Icon;
      return (
        <span
          className={clsx(styles.statusIcon, meta.className)}
          aria-label={`Status: ${meta.label}`}
          title={`Status: ${meta.label}`}
        >
          <Icon size={16} aria-hidden="true" />
        </span>
      );
    };

    const formatDuration = (seconds: number) => {
      if (!Number.isFinite(seconds) || seconds <= 0) {
        return null;
      }

      const totalSeconds = Math.round(seconds);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const remainingSeconds = totalSeconds % 60;

      if (hours > 0) {
        const minutesString = minutes.toString().padStart(2, "0");
        const secondsString = remainingSeconds.toString().padStart(2, "0");
        return `${hours}:${minutesString}:${secondsString}`;
      }

      const secondsString = remainingSeconds.toString().padStart(2, "0");
      return `${minutes}:${secondsString}`;
    };

    useEffect(() => {
      setAudioDurations({});
    }, [message.id]);

    const handleAudioMetadata = (attachmentId: string) => (
      event: SyntheticEvent<HTMLAudioElement>,
    ) => {
      const formatted = formatDuration(event.currentTarget.duration);
      if (formatted) {
        setAudioDurations((prev) => {
          if (prev[attachmentId] === formatted) {
            return prev;
          }

          return { ...prev, [attachmentId]: formatted };
        });
      }
    };

    const audioDurationValues = Object.values(audioDurations);
    const containerClass = clsx(styles.row, isOwnMessage ? styles.outgoing : styles.incoming, {
      [styles.grouped]: !isFirstOfGroup,
    });

    return (
      <div ref={ref} className={containerClass} aria-live="polite">
        {isOwnMessage ? (
          <div className={styles.avatarPlaceholder} aria-hidden="true" />
        ) : isFirstOfGroup && avatarUrl ? (
          <img src={avatarUrl} alt="" className={styles.avatar} aria-hidden="true" />
        ) : (
          <div className={styles.avatarPlaceholder} aria-hidden="true" />
        )}
        <div className={styles.bubble}>
          {message.attachments?.map((attachment) => {
            if (attachment.type === "audio") {
              const resolvedUrl = attachment.downloadUrl ?? attachment.url;
              return (
                <div key={attachment.id} className={styles.audioWrapper}>
                  <audio
                    controls
                    src={attachment.url}
                    className={styles.audioPlayer}
                    aria-label={`Mensagem de áudio ${attachment.name}`}
                    onLoadedMetadata={handleAudioMetadata(attachment.id)}
                  >
                    Seu navegador não suporta a reprodução de áudio.
                  </audio>
                  {resolvedUrl && (
                    <a
                      href={resolvedUrl}
                      download={attachment.name || ''}
                      className={styles.audioDownload}
                    >
                      Baixar áudio
                    </a>
                  )}
                  {attachment.name && (
                    <span className={styles.attachmentCaption}>{attachment.name}</span>
                  )}
                </div>
              );
            }

            if (attachment.type === "image") {
              return (
                <img
                  key={attachment.id}
                  src={attachment.url}
                  alt={attachment.name}
                  className={styles.attachment}
                />
              );
            }

            const downloadHref = attachment.downloadUrl ?? attachment.url;
            const attachmentName = attachment.name || "Documento";
            return (
              <a
                key={attachment.id}
                href={downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.fileAttachment}
                download={attachmentName}
                aria-label={`Baixar ${attachmentName}`}
              >
                <span className={styles.fileIcon} aria-hidden="true">
                  <FileText size={22} />
                </span>
                <span className={styles.fileContent}>
                  <span className={styles.fileName}>{attachmentName}</span>
                  <span className={styles.fileMeta}>
                    <Download size={16} aria-hidden="true" />
                    <span>Baixar arquivo</span>
                  </span>
                </span>
              </a>
            );
          })}
          {message.type === "image" && !message.attachments?.length && (
            <img
              src={message.content}
              alt="Imagem enviada"
              className={styles.attachment}
            />
          )}
          {message.type === "audio" && !message.attachments?.length && (
            <div className={styles.audioPlaceholder} aria-label="Mensagem de áudio" role="note">
              🎧 Mensagem de áudio
            </div>
          )}
          {(message.type === "file" || message.type === "document" || message.type === "media") &&
            !message.attachments?.length && (
            <div className={styles.filePlaceholder} role="note" aria-label="Arquivo recebido">
              <span className={styles.fileIcon} aria-hidden="true">
                <FileText size={22} />
              </span>
              <span className={styles.fileContent}>
                <span className={styles.fileName}>{message.content || "Documento"}</span>
                <span className={styles.fileMeta}>Documento recebido</span>
              </span>
            </div>
          )}
          {message.payload?.location && (
            <div className={styles.payloadCard} role="group" aria-label="Localização compartilhada">
              <div className={styles.payloadTitle}>Localização</div>
              {message.payload.location.name && (
                <p className={styles.payloadDetails}>{message.payload.location.name}</p>
              )}
              {message.payload.location.address && (
                <p className={styles.payloadDetails}>{message.payload.location.address}</p>
              )}
              {typeof message.payload.location.latitude === "number" &&
                typeof message.payload.location.longitude === "number" && (
                  <p className={styles.payloadDetails}>
                    {message.payload.location.latitude.toFixed(5)}, {" "}
                    {message.payload.location.longitude.toFixed(5)}
                  </p>
                )}
            </div>
          )}
          {message.payload?.contact && (
            <div className={styles.payloadCard} role="group" aria-label="Contato compartilhado">
              <div className={styles.payloadTitle}>{message.payload.contact.name}</div>
              {message.payload.contact.organization && (
                <p className={styles.payloadDetails}>{message.payload.contact.organization}</p>
              )}
              {message.payload.contact.phones?.length ? (
                <ul className={styles.payloadList}>
                  {message.payload.contact.phones.map((phone) => (
                    <li key={`${phone.phone}-${phone.label ?? phone.type ?? "phone"}`}>
                      <strong>{phone.phone}</strong>
                      {phone.label && <span> • {phone.label}</span>}
                      {!phone.label && phone.type && <span> • {phone.type}</span>}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
          {message.payload?.interactive && (
            <div className={styles.payloadCard} role="group" aria-label="Menu interativo">
              {message.payload.interactive.header && (
                <div className={styles.payloadTitle}>{message.payload.interactive.header}</div>
              )}
              <p className={styles.payloadDetails}>{message.payload.interactive.body}</p>
              {message.payload.interactiveOptions?.length ? (
                <ul className={styles.payloadList}>
                  {message.payload.interactiveOptions.map((option) => (
                    <li key={option.id}>
                      <strong>{option.title}</strong>
                      {option.description && <span> — {option.description}</span>}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
          {message.content && (
            <p className={styles.text}>{message.content}</p>
          )}
          <div className={styles.meta}>
            {audioDurationValues.length > 0 && (
              <span className={styles.duration} aria-label="Duração do áudio">
                {audioDurationValues.join(" / ")}
              </span>
            )}
            <time dateTime={message.timestamp}>{formatMessageTimestamp(message.timestamp)}</time>
            {isOwnMessage && (
              renderStatusIcon(message.status)
            )}
          </div>
        </div>
      </div>
    );
  },
);

MessageBubble.displayName = "MessageBubble";
