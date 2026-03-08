import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatProcessNumber(value: string | null | undefined): string {
  if (!value) return "";

  const digits = value.replace(/\D/g, "");

  if (digits.length !== 20) {
    return value;
  }

  return digits.replace(
    /^(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})$/,
    "$1-$2.$3.$4.$5.$6"
  );
}
