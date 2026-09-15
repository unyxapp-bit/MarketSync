import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export type MuralSector = {
  name: string
  rows: Array<{ name: string; cells: string[] }>
}

export type MuralInput = {
  storeName: string
  periodLabel: string
  revision: number | null
  dayLabels: string[]
  sectors: MuralSector[]
  fileName: string
}

async function checksumOf(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

// PDF por setor (spec section 20): loja, setor, período, versão and a checksum/conference code in
// the footer, headers repeated on every page, folga/turno legend, one page break-safe table per
// sector so a person's name row is never separated from their schedule row.
export async function buildSchedulePdf(input: MuralInput) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const checksum = await checksumOf(input)
  const pageWidth = doc.internal.pageSize.getWidth()

  const drawHeader = () => {
    doc.setFontSize(13)
    doc.setTextColor(16, 42, 67)
    doc.text('MarketSync · Escala semanal', 40, 34)
    doc.setFontSize(9)
    doc.setTextColor(90, 100, 115)
    doc.text(
      `${input.storeName} · ${input.periodLabel}${input.revision !== null ? ` · revisão ${input.revision}` : ''}`,
      40,
      48,
    )
  }

  input.sectors.forEach((sector, index) => {
    if (index > 0) doc.addPage()
    autoTable(doc, {
      startY: 76,
      margin: { top: 60 },
      head: [[`Setor: ${sector.name}`, ...input.dayLabels]],
      body: sector.rows.map((row) => [row.name, ...row.cells]),
      styles: { fontSize: 8, cellPadding: 5, valign: 'middle' },
      headStyles: { fillColor: [16, 42, 67], textColor: 255, fontSize: 8 },
      alternateRowStyles: { fillColor: [247, 250, 251] },
      didDrawPage: drawHeader,
    })
  })

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFontSize(7)
    doc.setTextColor(140, 148, 160)
    doc.text('Legenda: célula em branco = folga · horários = turno programado', 40, pageHeight - 22)
    doc.text(`Página ${page} de ${pageCount} · checksum ${checksum}`, pageWidth - 40, pageHeight - 22, {
      align: 'right',
    })
  }

  doc.save(input.fileName)
}

export type IndividualScheduleDay = { label: string; shift: string }

export type IndividualScheduleInput = {
  storeName: string
  employeeName: string
  periodLabel: string
  days: IndividualScheduleDay[]
  fileName: string
}

// PDF individual (spec section 20): somente os horários do colaborador, para entrega ou arquivo.
export async function buildIndividualSchedulePdf(input: IndividualScheduleInput) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const checksum = await checksumOf(input)
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFontSize(15)
  doc.setTextColor(16, 42, 67)
  doc.text('MarketSync · Escala individual', 40, 40)
  doc.setFontSize(10)
  doc.setTextColor(90, 100, 115)
  doc.text(`${input.employeeName} · ${input.storeName}`, 40, 58)
  doc.text(input.periodLabel, 40, 72)

  autoTable(doc, {
    startY: 92,
    head: [['Dia', 'Horário']],
    body: input.days.map((day) => [day.label, day.shift]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [16, 42, 67], textColor: 255 },
  })

  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(7)
  doc.setTextColor(140, 148, 160)
  doc.text(`checksum ${checksum}`, pageWidth - 40, pageHeight - 22, { align: 'right' })

  doc.save(input.fileName)
}
