const intlTime = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

const intlDay = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

const intlFull = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const intlDateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Ano válido para exibição (evita anos como 57945 por timestamp em ms tratado como segundos). */
const MIN_YEAR = 1970;
const MAX_YEAR = 2100;

export function parseTimestamp(value: string | number | null | undefined): Date | null {
  if (value == null || value === "") return null;
  let date: Date;
  if (typeof value === "number") {
    const ms = value >= 1e12 ? value : value * 1000;
    date = new Date(ms);
  } else {
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum)) {
      const ms = asNum >= 1e12 ? asNum : asNum * 1000;
      date = new Date(ms);
    } else {
      date = new Date(trimmed);
    }
  }
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  return date;
}

export const formatTime = (value: string) => {
  const date = parseTimestamp(value);
  if (!date) return "--:--";
  return intlTime.format(date);
};

export const formatMessageTimestamp = (value: string) => {
  const date = parseTimestamp(value);
  if (!date) return "--/--/---- --:--";
  return intlDateTime.format(date);
};

export const formatConversationTimestamp = (value: string) => {
  const date = parseTimestamp(value);
  if (!date) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfGivenDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffInDays = Math.floor(
    (startOfToday.getTime() - startOfGivenDay.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (date >= startOfToday) {
    return formatTime(date.toISOString());
  }
  if (date >= startOfYesterday) {
    return "Ontem";
  }
  if (diffInDays < 7) {
    return date.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return intlDay.format(date);
  }
  return intlFull.format(date);
};

export const getMessagePreview = (content: string, type: string) => {
  if (type === "image") return "Imagem";
  if (type === "audio") return "Mensagem de áudio";
  if (type === "file" || type === "document") return "Documento";
  if (content.length <= 56) return content;
  return `${content.slice(0, 56).trim()}…`;
};

export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "");
