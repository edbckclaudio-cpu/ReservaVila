"use client"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import * as Dialog from "@radix-ui/react-dialog"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"

type Reservation = {
  id: string
  date: string
  shift: "lunch" | "dinner"
  table_number: number
  client_name: string
  guest_count: number
  reservation_time: string
  phone: string | null
  notes: string | null
  arrived?: boolean
}

type Shift = "lunch" | "dinner"

export default function Page() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [open, setOpen] = useState(false)
  const [currentShift, setCurrentShift] = useState<Shift>("lunch")
  const [currentTable, setCurrentTable] = useState<number | null>(null)
  const [clientName, setClientName] = useState("")
  const [guestCount, setGuestCount] = useState<number>(2)
  const [reservationTime, setReservationTime] = useState("12:00")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [hasExisting, setHasExisting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [phone, setPhone] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [arrived, setArrived] = useState(false)

  const isoDate = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate])

  const fetchData = async () => {
    setErrorMsg(null)
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("date", isoDate)
    if (error) {
      setErrorMsg(error.message)
    }
    const normalized = (data || []).map((r) => {
      const v = String((r as any).shift || "").toLowerCase()
      const n = v === "almoco" || v === "almoço" || v === "lunch" ? "lunch" : v === "jantar" || v === "dinner" ? "dinner" : "lunch"
      let phoneValue = (r as any).phone ?? null
      if (!phoneValue && (r as any).notes) {
        const m = String((r as any).notes).match(/Telefone:\s*([+\d][\d\s\-]+)/i)
        if (m) phoneValue = m[1].replace(/\s+/g, "")
      }
      const arrivedFlag = !!String((r as any).notes || "").match(/\bchegou\b/i)
      return { ...(r as any), shift: n, phone: phoneValue, arrived: arrivedFlag }
    })
    setReservations(normalized)
  }

  useEffect(() => {
    fetchData()
  }, [isoDate])

  useEffect(() => {
    const channel = supabase
      .channel("reservations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `date=eq.${isoDate}` },
        (payload) => {
          const normalize = (row: any): Reservation => {
            if (!row) return row
            const v = String(row.shift || "").toLowerCase()
            const n = v === "almoco" || v === "almoço" || v === "lunch" ? "lunch" : v === "jantar" || v === "dinner" ? "dinner" : "lunch"
            let phoneValue = row.phone ?? null
            if (!phoneValue && row.notes) {
              const m = String(row.notes).match(/Telefone:\s*([+\d][\d\s\-]+)/i)
              if (m) phoneValue = m[1].replace(/\s+/g, "")
            }
            const arrivedFlag = !!String(row.notes || "").match(/\bchegou\b/i)
            return { ...(row as any), shift: n, phone: phoneValue, arrived: arrivedFlag }
          }
          const newRow = normalize(payload.new)
          const oldRow = normalize(payload.old)
          setReservations((prev) => {
            if (payload.eventType === "INSERT") return [...prev, newRow]
            if (payload.eventType === "UPDATE")
              return prev.map((r) => (r.id === newRow.id ? newRow : r))
            if (payload.eventType === "DELETE")
              return prev.filter((r) => r.id !== oldRow.id)
            return prev
          })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [isoDate])

  const reservedByKey = useMemo(() => {
    const map = new Map<string, Reservation>()
    for (const r of reservations) {
      map.set(`${r.shift}-${r.table_number}`, r)
    }
    return map
  }, [reservations])

  const openDialog = (shift: Shift, table: number) => {
    setCurrentShift(shift)
    setCurrentTable(table)
    const existing = reservedByKey.get(`${shift}-${table}`)
    setClientName(existing?.client_name || "")
    setGuestCount(existing?.guest_count || 2)
    setReservationTime(existing?.reservation_time || (shift === "lunch" ? "12:00" : "19:00"))
    setNotes(existing?.notes || "")
    setHasExisting(!!existing)
    setArrived(!!existing?.arrived)
    if (existing?.phone) {
      setPhone(existing.phone)
    } else if (existing?.notes) {
      const m = existing.notes.match(/Telefone:\s*([+\d][\d\s\-]+)/i)
      setPhone(m ? m[1].replace(/\s+/g, "") : "")
    } else {
      setPhone("")
    }
    setOpen(true)
  }

  const saveReservation = async () => {
    if (!currentTable) return
    setSaving(true)
    setErrorMsg(null)
    const dbShift = currentShift === "lunch" ? "almoco" : "jantar"
    const cleanNotes = (notes || "").replace(/Telefone:\s*\+?\d[\d\s\-]*/i, "").trim()
    const notesWithPhone =
      phone ? (cleanNotes ? `Telefone: ${phone} | ${cleanNotes}` : `Telefone: ${phone}`) : cleanNotes
    const payload = {
      date: isoDate,
      shift: dbShift,
      table_number: currentTable,
      client_name: clientName,
      guest_count: guestCount,
      reservation_time: reservationTime,
      phone: phone || null,
      notes: notesWithPhone || null
    }
    let lastShiftUsed = payload.shift
    let { error } = await supabase
      .from("reservations")
      .upsert(payload, {
        onConflict: "date,shift,table_number"
      })
    setSaving(false)
    if (error) {
      const alt1 = currentShift === "lunch" ? "almoco" : "jantar"
      const alt2 = currentShift === "lunch" ? "Almoço" : "Jantar"
      const alt3 = currentShift === "lunch" ? "lunch" : "dinner"
      const alt4 = currentShift === "lunch" ? "Lunch" : "Dinner"
      const alt5 = currentShift === "lunch" ? "ALMOCO" : "JANTAR"
      const alt6 = currentShift === "lunch" ? "LUNCH" : "DINNER"
      const tries = [alt1, alt2, alt3, alt4, alt5, alt6]
      for (const t of tries) {
        const { error: e2 } = await supabase
          .from("reservations")
          .upsert({ ...payload, shift: t }, { onConflict: "date,shift,table_number" })
        if (!e2) {
          error = null
          lastShiftUsed = t
          break
        } else {
          error = e2
        }
      }
      if (error) {
        const msg = String(error.message || "").toLowerCase()
        const isPhoneSchemaError =
          msg.includes("schema cache") ||
          msg.includes("'phone'") ||
          msg.includes("phone column")
        if (isPhoneSchemaError) {
          for (const t of tries) {
            const { error: e3 } = await supabase
              .from("reservations")
              .upsert(
                {
                  date: payload.date,
                  shift: t,
                  table_number: payload.table_number,
                  client_name: payload.client_name,
                  guest_count: payload.guest_count,
                  reservation_time: payload.reservation_time,
                  notes: payload.notes
                },
                { onConflict: "date,shift,table_number" }
              )
            if (!e3) {
              error = null
              lastShiftUsed = t
              break
            } else {
              error = e3
            }
          }
        }
        if (error) {
          setErrorMsg(error.message)
          return
        }
      }
    }
    // Persistência do telefone já embutida nas observações para máxima compatibilidade
    await fetchData()
    setOpen(false)
  }

  const sendWhatsApp = () => {
    if (!phone) return
    const dateText = format(selectedDate, "PPP", { locale: ptBR })
    const msg = `Olá, sou do Restaurante Vila das Meninas. Esta é uma mensagem que sua reserva do dia ${dateText} às ${reservationTime} para ${guestCount} pessoas, está confirmada`
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    window.open(url, "_blank")
  }

  const removeReservation = async () => {
    if (!currentTable) return
    setRemoving(true)
    setErrorMsg(null)
    const altVals = [
      currentShift,
      currentShift === "lunch" ? "almoco" : "jantar",
      currentShift === "lunch" ? "Almoço" : "Jantar",
      currentShift === "lunch" ? "Lunch" : "Dinner",
      currentShift === "lunch" ? "ALMOCO" : "JANTAR",
      currentShift === "lunch" ? "LUNCH" : "DINNER"
    ]
    let { error } = await supabase
      .from("reservations")
      .delete()
      .eq("date", isoDate)
      .in("shift", altVals)
      .eq("table_number", currentTable)
    setRemoving(false)
    if (error) {
      const alt1 = currentShift === "lunch" ? "almoco" : "jantar"
      const alt2 = currentShift === "lunch" ? "Lunch" : "Dinner"
      const alt3 = currentShift === "lunch" ? "Almoço" : "Jantar"
      const tries = [alt1, alt2, alt3]
      for (const t of tries) {
        const { error: e2 } = await supabase
          .from("reservations")
          .delete()
          .eq("date", isoDate)
          .eq("shift", t)
          .eq("table_number", currentTable)
        if (!e2) {
          error = null
          break
        } else {
          error = e2
        }
      }
      if (error) {
        setErrorMsg(error.message)
        return
      }
    }
    await fetchData()
    setOpen(false)
  }

  const markArrived = async () => {
    if (!currentTable || !hasExisting || arrived) return
    setErrorMsg(null)
    const altVals = [
      currentShift,
      currentShift === "lunch" ? "almoco" : "jantar",
      currentShift === "lunch" ? "Almoço" : "Jantar",
      currentShift === "lunch" ? "Lunch" : "Dinner",
      currentShift === "lunch" ? "ALMOCO" : "JANTAR",
      currentShift === "lunch" ? "LUNCH" : "DINNER"
    ]
    const cleanNotes = (notes || "")
      .replace(/Telefone:\s*\+?\d[\d\s\-]*/i, "")
      .replace(/\bStatus:\s*chegou\b/i, "")
      .replace(/\bchegou\b/i, "")
      .trim()
    const phonePart = phone ? `Telefone: ${phone}` : ""
    const statusPart = "Status: chegou"
    const combined =
      [statusPart, phonePart, cleanNotes].filter(Boolean).join(" | ")
    let { error } = await supabase
      .from("reservations")
      .update({ notes: combined || null, phone: phone || null })
      .eq("date", isoDate)
      .in("shift", altVals)
      .eq("table_number", currentTable)
    if (error) {
      const msg = String(error.message || "").toLowerCase()
      const isPhoneSchemaError =
        msg.includes("schema cache") ||
        msg.includes("'phone'") ||
        msg.includes("phone column")
      if (isPhoneSchemaError) {
        const { error: e2 } = await supabase
          .from("reservations")
          .update({ notes: combined || null })
          .eq("date", isoDate)
          .in("shift", altVals)
          .eq("table_number", currentTable)
        if (e2) {
          setErrorMsg(e2.message)
          return
        }
      } else {
        setErrorMsg(error.message)
        return
      }
    }
    setArrived(true)
    await fetchData()
  }

  const renderGrid = (shift: Shift) => {
    const items = []
    for (let i = 1; i <= 40; i++) {
      const r = reservedByKey.get(`${shift}-${i}`)
      items.push(
        <button
          key={`${shift}-${i}`}
          onClick={() => openDialog(shift, i)}
          className={
            r
              ? "rounded-md border border-green-600 text-black p-2 text-xs flex flex-col items-start justify-start min-h-[60px]"
              : "rounded-md border border-gray-300 p-2 text-xs flex items-center justify-center min-h-[60px]"
          }
          style={
            r
              ? r.arrived
                ? { backgroundColor: "#fde68a" }
                : { backgroundColor: "#86efac" }
              : shift === "dinner"
              ? { backgroundColor: "#fed7aa" }
              : { backgroundColor: "#f3f4f6" }
          }
        >
          {r ? (
            <div className="w-full">
              <div className="text-sm font-bold">Mesa {i}</div>
              <div className="mt-1 text-sm">
                <span className="font-medium">{r.reservation_time}</span>
                <span> • {r.client_name}</span>
              </div>
              <div className="mt-1 text-xs text-gray-700">{r.guest_count} pessoas</div>
            </div>
          ) : (
            <span className="text-gray-600">Mesa {i}</span>
          )}
        </button>
      )
    }
    return (
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {items}
      </div>
    )
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Vila das Meninas • Reservas</h1>
      <Card>
        <CardContent className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-1/3">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              locale={ptBR}
            />
          </div>
          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Almoço</span>
                    <span className="text-sm text-gray-600">{format(selectedDate, "PPP", { locale: ptBR })}</span>
                  </div>
                </CardHeader>
                <CardContent>{renderGrid("lunch")}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Jantar</span>
                    <span className="text-sm text-gray-600">{format(selectedDate, "PPP", { locale: ptBR })}</span>
                  </div>
                </CardHeader>
                <CardContent>{renderGrid("dinner")}</CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-md rounded-lg border border-black p-4 shadow-2xl z-[100]"
            style={{ backgroundColor: "#f59e0b", opacity: 1 }}
          >
            {hasExisting && (
              <div className="absolute right-3 top-3">
                <Button
                  onClick={markArrived}
                  disabled={arrived}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Chegou
                </Button>
              </div>
            )}
            <Dialog.Title className="text-lg font-semibold mb-2">
              {currentShift === "lunch" ? "Reserva • Almoço" : "Reserva • Jantar"} {currentTable ? `• Mesa ${currentTable}` : ""}
            </Dialog.Title>
            {errorMsg && (
              <div className="mb-3 rounded-md border border-red-600 bg-red-100 text-red-800 px-3 py-2 text-sm">
                {errorMsg}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-sm">Hora</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="HH:MM"
                  value={reservationTime}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d:]/g, "")
                    setReservationTime(v)
                  }}
                  onBlur={(e) => {
                    const m = e.target.value.match(/^(\d{1,2}):(\d{1,2})$/)
                    if (m) {
                      const h = Math.min(23, parseInt(m[1], 10))
                      const min = Math.min(59, parseInt(m[2], 10))
                      const hh = h.toString().padStart(2, "0")
                      const mm = min.toString().padStart(2, "0")
                      setReservationTime(`${hh}:${mm}`)
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-sm">Nome do Cliente</label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex.: Maria" />
              </div>
              <div>
                <label className="text-sm">Quantidade de Pessoas</label>
                <Input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-sm">Telefone (WhatsApp)</label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex.: 5599999999999" />
              </div>
              <div>
                <label className="text-sm">Observações</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Aniversário, preferências" />
              </div>
            </div>
            <div className="mt-4 flex justify-between gap-2 flex-wrap">
              {hasExisting && (
                <Button
                  onClick={removeReservation}
                  disabled={removing}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {removing ? "Removendo..." : "Remover reserva"}
                </Button>
              )}
              <Button
                onClick={sendWhatsApp}
                disabled={!phone}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Confirmação para o cliente
              </Button>
              <Dialog.Close asChild>
                <Button variant="outline">Cancelar</Button>
              </Dialog.Close>
              <Button onClick={saveReservation} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  )
}
