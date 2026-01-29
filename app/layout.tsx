import "./globals.css"
import { ReactNode } from "react"

export const metadata = {
  title: "Vila das Meninas",
  description: "Reservas em tempo real"
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-white text-black">{children}</body>
    </html>
  )
}
