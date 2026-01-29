import { InputHTMLAttributes } from "react"
import { cn } from "../../lib/utils"

type Props = InputHTMLAttributes<HTMLInputElement>
export function Input({ className, ...props }: Props) {
  return <input className={cn("flex h-10 w-full rounded-md border border-black bg-white px-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-black", className)} {...props} />
}
