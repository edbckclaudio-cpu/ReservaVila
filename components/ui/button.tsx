import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { ButtonHTMLAttributes } from "react"

const buttonVariants = cva("inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50", {
  variants: {
    variant: {
      default: "bg-black text-white hover:bg-black/80",
      outline: "border border-black bg-transparent hover:bg-black/10"
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-9 px-3",
      lg: "h-11 px-8"
    }
  },
  defaultVariants: {
    variant: "default",
    size: "default"
  }
})

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
}

export function Button({ className, variant, size, ...props }: Props) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
