interface TextMessageProps {
  content?: string | null;
}

export const TextMessage = ({ content }: TextMessageProps) => {
  if (!content) {
    return null;
  }

  return <p className="whitespace-pre-wrap leading-relaxed">{content}</p>;
};
