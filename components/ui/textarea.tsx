import { TextareaHTMLAttributes } from "react"
import { cn } from "../../lib/utils"

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>
export function Textarea({ className, ...props }: Props) {
  return <textarea className={cn("flex min-h-[80px] w-full rounded-md border border-black bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-black", className)} {...props} />
}
