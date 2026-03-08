import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const blockedAvatarHosts = new Set<string>();

const sanitizeAvatarSrc = (value?: string) => {
  if (!value) {
    return value;
  }

  try {
    const url = new URL(value);
    if (blockedAvatarHosts.has(url.hostname)) {
      return undefined;
    }
    return value;
  } catch {
    if (blockedAvatarHosts.has(value)) {
      return undefined;
    }
    return value;
  }
};

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, referrerPolicy = "no-referrer", src, ...props }, ref) => {
  const safeSrc = sanitizeAvatarSrc(typeof src === "string" ? src : undefined) ?? "/placeholder.svg";

  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn("aspect-square h-full w-full", className)}
      referrerPolicy={referrerPolicy}
      src={safeSrc}
      {...props}
    />
  );
});
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
