import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf/70",
  {
    variants: {
      variant: {
        default: "bg-leaf text-bone hover:bg-forest",
        secondary: "bg-bark text-bone hover:bg-pine",
        ghost: "hover:bg-white/5",
        outline: "border border-white/10 text-bone hover:bg-white/5",
        danger: "bg-clay text-bone hover:bg-clay/90",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2.5 text-xs",
        lg: "h-11 px-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
