import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function cents(amount: number): number {
  return Math.round(amount * 100);
}
