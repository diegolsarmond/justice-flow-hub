import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useConversationAvatar } from "../hooks/useConversationAvatar";
import { cn } from "@/lib/utils";

interface ConversationAvatarProps {
  conversationId: string;
  avatar: string | undefined | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-12 w-12",
  xl: "h-24 w-24",
};

export function ConversationAvatar({
  conversationId,
  avatar,
  name,
  className,
  fallbackClassName,
  size = "lg",
}: ConversationAvatarProps) {
  const resolvedUrl = useConversationAvatar(conversationId, avatar);
  const initials = (name ?? "")
    .replace(/@.*$/, "")
    .trim()
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <Avatar className={cn(sizeClasses[size], "ring-2 ring-white dark:ring-slate-900 shadow-sm", className)}>
      {resolvedUrl && (
        <AvatarImage src={resolvedUrl} alt={name ?? ""} className="object-cover" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback className={cn("bg-gradient-to-br from-primary to-primary/80 text-sm font-bold text-primary-foreground", fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
