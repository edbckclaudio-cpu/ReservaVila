import { ReactNode } from "react"
import { cn } from "../../lib/utils"

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-black bg-white", className)}>{children}</div>
}
export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-4 border-b border-black", className)}>{children}</div>
}
export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-4", className)}>{children}</div>
}
