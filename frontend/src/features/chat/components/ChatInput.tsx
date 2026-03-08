import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";
import { Laugh, Mic, Paperclip, Send } from "lucide-react";
import type { MessageType, SendMessageInput } from "../types";
import { cn } from "@/lib/utils";
import styles from "./ChatInput.module.css";

interface ChatInputProps {
  onSend: (payload: SendMessageInput) => Promise<void> | void;
  onAttach?: (file: File, type?: MessageType) => Promise<void> | void;
  createAudioRecorder?: () => Promise<MediaRecorder>;
  disabled?: boolean;
  onTypingActivity?: (isTyping: boolean) => void;
  typingIndicator?: string | null;
  isUpdatingConversation?: boolean;
}

const EMOJI_SUGGESTIONS = [
  "😀",
  "😁",
  "😂",
  "😊",
  "😉",
  "😍",
  "😘",
  "🤝",
  "👍",
  "🙏",
  "🚀",
  "💼",
  "📌",
  "🗂️",
  "📎",
  "⚖️",
  "📆",
  "📝",
  "✅",
  "❗",
  "💬",
  "📞",
  "📄",
  "🛡️",
];

const RECORDING_LIMIT_MS = 60_000;
const RECORDING_TICK_MS = 1_000;

export const ChatInput = ({
  onSend,
  onAttach,
  createAudioRecorder,
  disabled = false,
  onTypingActivity,
  typingIndicator,
  isUpdatingConversation = false,
}: ChatInputProps) => {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pendingAudio, setPendingAudio] = useState<File | null>(null);
  const pendingAudioUrl = useMemo(
    () => (pendingAudio ? URL.createObjectURL(pendingAudio) : null),
    [pendingAudio],
  );

  useEffect(() => {
    return () => {
      if (pendingAudioUrl) {
        URL.revokeObjectURL(pendingAudioUrl);
      }
    };
  }, [pendingAudioUrl]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    if (disabled) {
      onTypingActivity?.(false);
    }
  }, [disabled, onTypingActivity]);

  useEffect(() => {
    let interval: number | undefined;
    if (isRecording) {
      setRecordingSeconds(0);
      interval = window.setInterval(() => {
        setRecordingSeconds((previous) => previous + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [isRecording]);

  const canSend = value.trim().length > 0 && !disabled && !isRecording;

  const sendTextMessage = async () => {
    const message = value.trim();
    if (!message || disabled || isRecording) return;
    setValue("");
    setShowEmojiPicker(false);
    onTypingActivity?.(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
    setIsSending(true);
    try {
      await onSend({ content: message, type: "text" });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendTextMessage();
    }
  };

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    onTypingActivity?.(nextValue.trim().length > 0);
  };

  const handleBlur: React.FocusEventHandler<HTMLTextAreaElement> = () => {
    onTypingActivity?.(false);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (!onAttach) return;
    const files = Array.from(event.clipboardData?.files ?? []);
    const imageFile = files.find((file) => file.type.startsWith("image/"));
    if (imageFile) {
      event.preventDefault();
      void handleAttachment(imageFile, "image");
    }
  };

  const handleAttachment = async (file: File, type?: MessageType) => {
    if (!onAttach) {
      setRecordingError("Envio de anexos não disponível no momento.");
      return;
    }
    setIsSending(true);
    setRecordingError(null);
    try {
      await onAttach(file, type);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileInputChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleAttachment(file);
      event.target.value = "";
    }
  };

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopRecording = () => {
    clearRecordingTimer();
    setRecordingDuration(0);
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    try {
      recorder.stop();
    } catch (error) {
      console.error(error);
      setRecordingError("Não foi possível finalizar a gravação.");
      setIsRecording(false);
    }
  };

  const startRecording = async () => {
    if (!createAudioRecorder) {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      return;
    }
    if (!onAttach) {
      setRecordingError("Não é possível enviar áudios agora.");
      return;
    }
    setRecordingError(null);
    try {
      const recorder = await createAudioRecorder();
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = (event) => {
        console.error(event.error);
        setRecordingError("Houve um erro na captura de áudio.");
      };
      recorder.onstop = async () => {
        clearRecordingTimer();
        setRecordingDuration(0);
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        recordedChunksRef.current = [];
        const tracks = recorder.stream.getTracks();
        tracks.forEach((track) => track.stop());
        if (blob.size === 0) {
          setIsRecording(false);
          return;
        }
        const audioFile = new File([blob], `gravacao-${Date.now()}.webm`, {
          type: blob.type || "audio/webm",
        });
        setPendingAudio(audioFile);
        setIsRecording(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((previous) => {
          const next = Math.min(previous + RECORDING_TICK_MS, RECORDING_LIMIT_MS);
          if (next >= RECORDING_LIMIT_MS) {
            clearRecordingTimer();
            stopRecording();
          }
          return next;
        });
      }, RECORDING_TICK_MS);
    } catch (error) {
      console.error(error);
      setRecordingError(
        error instanceof Error ? error.message : "Não foi possível iniciar a gravação.",
      );
      setIsRecording(false);
      clearRecordingTimer();
      setRecordingDuration(0);
    }
  };

  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    void startRecording();
  };

  const recordButtonLabel = isRecording
    ? `Parar gravação (${Math.ceil(recordingDuration / 1000)}s)`
    : "Gravar áudio";

  const toggleEmojiPicker = () => {
    setShowEmojiPicker((previous) => !previous);
  };

  const handleSendPendingAudio = async () => {
    if (!pendingAudio || !onAttach) {
      return;
    }
    setIsSending(true);
    try {
      await onAttach(pendingAudio, "audio");
      setPendingAudio(null);
    } finally {
      setIsSending(false);
    }
  };

  const handleDiscardPendingAudio = () => {
    setPendingAudio(null);
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const nextValue = `${value.slice(0, selectionStart)}${emoji}${value.slice(selectionEnd)}`;
    setValue(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = selectionStart + emoji.length;
      textarea.setSelectionRange(caret, caret);
    });
  };



  const formattedRecordingTime = useMemo(() => {
    const minutes = Math.floor(recordingSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (recordingSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [recordingSeconds]);

  return (
    <div className="relative px-3 py-2">
      <div className="mx-auto max-w-4xl">
        {isRecording && (
          <div className="mb-4 flex items-center justify-between rounded-2xl bg-primary/5 px-5 py-4 text-primary animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className="h-4 w-1 animate-pulse rounded-full bg-primary"
                    style={{ animationDelay: `${i * 0.1}s`, height: `${Math.random() * 16 + 8}px` }}
                  />
                ))}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Gravando</span>
                <span className="text-xl font-bold tabular-nums leading-none">{formattedRecordingTime}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={stopRecording}
                className="rounded-xl border-primary/20 bg-transparent px-5 font-bold text-primary hover:bg-primary/10"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={stopRecording}
                className="rounded-xl px-5 font-bold shadow-lg shadow-primary/20"
              >
                Finalizar
              </Button>
            </div>
          </div>
        )}

        <div className="relative flex items-end gap-2 rounded-[28px] bg-white ring-1 ring-slate-200/60 p-1.5 dark:bg-slate-800 dark:ring-slate-700 shadow-sm">
          <div className="flex flex-shrink-0 items-center gap-0.5 pl-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full transition-all text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-slate-700"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isSending}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full transition-all text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-slate-700"
              onClick={toggleEmojiPicker}
              disabled={disabled}
            >
              <Laugh className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onBlur={handleBlur}
              placeholder="Digite uma mensagem"
              disabled={disabled}
              className="min-h-[44px] max-h-[150px] resize-none border-none bg-transparent py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-shrink-0 items-center gap-1 pr-1">
            <Button
              type="button"
              variant={isRecording ? "destructive" : "ghost"}
              size="icon"
              className={cn(
                "h-10 w-10 rounded-full transition-all",
                isRecording 
                  ? "bg-red-500 text-white hover:bg-red-600 shadow-md" 
                  : "text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-slate-700"
              )}
              onClick={handleRecordClick}
              disabled={disabled || isSending}
            >
              <Mic className={cn("h-5 w-5", isRecording && "text-white")} />
            </Button>
            <Button
              type="button"
              onClick={() => void sendTextMessage()}
              disabled={!canSend}
              className="h-10 w-10 rounded-full bg-primary shadow-md hover:bg-primary/90 hover:shadow-lg transition-all disabled:opacity-40 disabled:shadow-none"
            >
              <Send className="h-[18px] w-[18px]" />
            </Button>
          </div>

          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-3 z-50 grid grid-cols-6 gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200 dark:bg-slate-800 dark:border-slate-700">
              {EMOJI_SUGGESTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-xl transition-all hover:bg-slate-100 hover:scale-110 dark:hover:bg-slate-700"
                  onClick={() => handleEmojiSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {(typingIndicator || recordingError) && (
          <div className="mt-2 flex items-center gap-3 px-2 text-[10px] font-bold uppercase tracking-wider">
            {typingIndicator && (
              <div className="flex items-center gap-2 text-primary">
                <span className="flex h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                <span>{typingIndicator}</span>
              </div>
            )}
            {recordingError && <span className="text-red-500">{recordingError}</span>}
          </div>
        )}

        {pendingAudio && pendingAudioUrl && (
          <div className="mt-4 flex items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-elegant animate-in zoom-in-95 duration-300 dark:bg-slate-900 dark:border-slate-800">
            <audio controls src={pendingAudioUrl} className="h-10 flex-1" />
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={handleDiscardPendingAudio} className="font-bold text-muted-foreground">
                Descartar
              </Button>
              <Button
                type="button"
                onClick={() => void handleSendPendingAudio()}
                disabled={isSending}
                className="bg-primary font-bold shadow-lg shadow-primary/20"
              >
                Enviar Áudio
              </Button>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,audio/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );
};
