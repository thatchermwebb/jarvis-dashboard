// Builds a visually scannable .docx from one or more client bundles.
// Consumes the plain-English engine in ./clientNarrative.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, PageBreak, ShadingType,
} from 'docx'
import {
  ClientBundle, snapshot, journey, detailGroups, clientTitle,
  money, fmtDate, humanize, clean, logTypeLabel, sentimentLabel, paymentStatusLabel, taskStatusLabel,
} from './clientNarrative'

const FONT = 'Arial'
const INK = '1A1A1A'
const MUTED = '6B7280'
const ACCENT = '1D4ED8'
const RULE = 'D1D5DB'
const LABEL_BG = 'F3F4F6'
const CONTENT_W = 9360 // US Letter, 1" margins

const s = (v: unknown) => (v == null ? '' : String(v)).trim()

// Split "plain **bold** text" into runs.
function inlineRuns(text: string, opts: { color?: string; size?: number } = {}): TextRun[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return parts.map(p => {
    const bold = p.startsWith('**') && p.endsWith('**')
    return new TextRun({ text: bold ? p.slice(2, -2) : p, bold, color: opts.color ?? INK, size: opts.size ?? 21, font: FONT })
  })
}

const body = (text: string, opts: { color?: string; size?: number; spaceAfter?: number } = {}) =>
  new Paragraph({ children: inlineRuns(text, opts), spacing: { after: opts.spaceAfter ?? 120, line: 276 } })

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 260, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: ACCENT, size: 20, font: FONT })],
  })
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 160, after: 60 },
    children: [new TextRun({ text, bold: true, color: INK, size: 21, font: FONT })],
  })
}

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

function cellText(text: string, o: { bold?: boolean; color?: string; align?: typeof AlignmentType[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    alignment: o.align,
    spacing: { after: 20, before: 20 },
    children: [new TextRun({ text, bold: o.bold, color: o.color ?? INK, size: 20, font: FONT })],
  })
}

// Two-column label/value table for a detail group.
function kvTable(fields: { label: string; value: string }[]): Table {
  const L = 2900, V = CONTENT_W - L
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [L, V],
    borders: noBorders,
    rows: fields.map(f => new TableRow({
      children: [
        new TableCell({
          width: { size: L, type: WidthType.DXA },
          shading: { fill: LABEL_BG, type: ShadingType.CLEAR, color: 'auto' },
          margins: { top: 40, bottom: 40, left: 120, right: 120 },
          children: [cellText(f.label, { bold: true, color: MUTED })],
        }),
        new TableCell({
          width: { size: V, type: WidthType.DXA },
          margins: { top: 40, bottom: 40, left: 120, right: 120 },
          children: [cellText(f.value)],
        }),
      ],
    })),
  })
}

// Payments ledger table.
function paymentsTable(payments: Record<string, unknown>[]): Table {
  const cols = [1700, 2100, 1300, 1500, CONTENT_W - 1700 - 2100 - 1300 - 1500]
  const header = ['Date', 'Type', 'Amount', 'Status', 'Notes']
  const headerRow = new TableRow({
    tableHeader: true,
    children: header.map((h, i) => new TableCell({
      width: { size: cols[i], type: WidthType.DXA },
      shading: { fill: ACCENT, type: ShadingType.CLEAR, color: 'auto' },
      margins: { top: 40, bottom: 40, left: 100, right: 100 },
      children: [cellText(h, { bold: true, color: 'FFFFFF' })],
    })),
  })
  const sorted = [...payments].sort((a, b) => s(a.paid_date || a.due_date).localeCompare(s(b.paid_date || b.due_date)))
  const rows = sorted.map(p => {
    const vals = [
      fmtDate(p.paid_date || p.due_date) || '—',
      humanize(p.payment_type) || 'Payment',
      money(p.amount),
      paymentStatusLabel(p.status),
      clean(p.description) || clean(p.notes) || '',
    ]
    return new TableRow({
      children: vals.map((v, i) => new TableCell({
        width: { size: cols[i], type: WidthType.DXA },
        margins: { top: 40, bottom: 40, left: 100, right: 100 },
        children: [cellText(v, { align: i === 2 ? AlignmentType.RIGHT : undefined })],
      })),
    })
  })
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: cols, borders: noBorders, rows: [headerRow, ...rows] })
}

// One client → an array of docx blocks.
function clientBlocks(b: ClientBundle, index: number): (Paragraph | Table)[] {
  const c = b.client
  const blocks: (Paragraph | Table)[] = []

  if (index > 0) blocks.push(new Paragraph({ children: [new PageBreak()] }))

  // Title
  blocks.push(new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: clientTitle(c), bold: true, color: INK, size: 34, font: FONT })],
    heading: HeadingLevel.HEADING_1,
  }))
  const sub = [s(c.name) !== clientTitle(c) ? s(c.name) : '', s(c.market_location)].filter(Boolean).join(' · ')
  if (sub) blocks.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: sub, color: MUTED, size: 20, font: FONT })] }))

  // Snapshot
  blocks.push(sectionHeading('Snapshot'))
  blocks.push(body(snapshot(b)))

  // Journey
  const entries = journey(b)
  blocks.push(sectionHeading('Customer Journey'))
  if (entries.length === 0) {
    blocks.push(body('No dated activity on record.', { color: MUTED }))
  } else {
    for (const e of entries) {
      blocks.push(new Paragraph({
        spacing: { after: 80, line: 270 },
        indent: { left: 240, hanging: 240 },
        children: [
          new TextRun({ text: `${e.date}  `, bold: true, color: ACCENT, size: 20, font: FONT }),
          ...inlineRuns(e.text, { size: 21 }),
        ],
      }))
    }
  }

  // Details
  const groups = detailGroups(b)
  if (groups.length) {
    blocks.push(sectionHeading('Client Details'))
    for (const grp of groups) {
      blocks.push(subHeading(grp.title))
      blocks.push(kvTable(grp.fields))
    }
  }

  // Communication log — full detail (emphasised by the user)
  if (b.logs.length) {
    blocks.push(sectionHeading(`Communication Log (${b.logs.length})`))
    const logs = [...b.logs].sort((x, y) => s(y.created_at).localeCompare(s(x.created_at)))
    for (const l of logs) {
      const head = [
        fmtDate(l.created_at),
        logTypeLabel(l.log_type),
        s(l.created_by) ? `by ${s(l.created_by)}` : '',
        l.sentiment ? `client ${sentimentLabel(l.sentiment)}` : '',
        l.outcome ? humanize(l.outcome) : '',
      ].filter(Boolean).join('  ·  ')
      blocks.push(new Paragraph({ spacing: { before: 100, after: 20 }, children: [new TextRun({ text: head, bold: true, color: INK, size: 20, font: FONT })] }))
      const summary = clean(l.summary) || clean(l.trial_notes)
      if (summary) blocks.push(body(summary, { spaceAfter: 20 }))
      const extra: string[] = []
      if (clean(l.promises_made)) extra.push(`Promises: ${clean(l.promises_made)}`)
      if (clean(l.objections)) extra.push(`Objections: ${clean(l.objections)}`)
      if (clean(l.next_step)) extra.push(`Next step: ${clean(l.next_step)}${l.followup_date ? ` (by ${fmtDate(l.followup_date)})` : ''}`)
      for (const x of extra) blocks.push(body(x, { color: MUTED, size: 20, spaceAfter: 20 }))
    }
  }

  // Payments ledger
  if (b.payments.length) {
    blocks.push(sectionHeading(`Payments (${b.payments.length})`))
    blocks.push(paymentsTable(b.payments))
  }

  // Ad / account reports + production
  const mediaLines: string[] = []
  for (const a of b.accountLogs) {
    const m = [
      a.period_start ? `${fmtDate(a.period_start)}${a.period_end ? `–${fmtDate(a.period_end)}` : ''}` : '',
      a.leads != null ? `${a.leads} leads` : '', a.cpl != null ? `${money(a.cpl)} CPL` : '',
      a.booked != null ? `${a.booked} booked` : '', a.spend != null ? `${money(a.spend)} spend` : '',
      a.verdict ? `verdict ${humanize(a.verdict)}` : '',
    ].filter(Boolean).join(' · ')
    if (m) mediaLines.push(m)
  }
  for (const w of b.workOrders) {
    mediaLines.push(`Work order: ${humanize(w.service_type) || 'ad'}${w.status ? ` — ${humanize(w.status)}` : ''}${clean(w.angle) ? ` (${clean(w.angle)})` : ''}${w.created_at ? `, ${fmtDate(w.created_at)}` : ''}`)
  }
  for (const p of b.adProductions) {
    mediaLines.push(`Ad production: ${s(p.ad_name) || 'untitled'}${p.status ? ` — ${humanize(p.status)}` : ''}${p.due_date ? `, due ${fmtDate(p.due_date)}` : ''}`)
  }
  if (mediaLines.length) {
    blocks.push(sectionHeading(`Advertising & Production (${mediaLines.length})`))
    for (const line of mediaLines) {
      blocks.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text: line, size: 20, font: FONT, color: INK })] }))
    }
  }

  // Tasks
  if (b.tasks.length) {
    blocks.push(sectionHeading(`Tasks (${b.tasks.length})`))
    const tasks = [...b.tasks].sort((x, y) => s(x.due_date).localeCompare(s(y.due_date)))
    for (const t of tasks) {
      const line = `[${taskStatusLabel(t.status)}] ${clean(t.title) || humanize(t.task_type) || 'Task'}${t.due_date ? ` — due ${fmtDate(t.due_date)}` : ''}${s(t.assigned_to) ? `, assigned to ${s(t.assigned_to)}` : ''}${clean(t.notes) ? `. ${clean(t.notes)}` : ''}`
      blocks.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text: line, size: 20, font: FONT, color: INK })] }))
    }
  }

  return blocks
}

export async function buildClientsDocx(bundles: ClientBundle[], exportedBy?: string): Promise<Buffer> {
  const today = fmtDate(new Date().toISOString())

  const cover: Paragraph[] = [
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'CZA Command Center', bold: true, color: ACCENT, size: 26, font: FONT })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Client Records Export', bold: true, color: INK, size: 44, font: FONT })] }),
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${bundles.length} client${bundles.length === 1 ? '' : 's'} · Generated ${today}${exportedBy ? ` by ${exportedBy}` : ''}`, color: MUTED, size: 22, font: FONT })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Each record below tells the full customer journey in plain English, followed by every detail, communication log, payment and activity on file.', color: MUTED, italics: true, size: 20, font: FONT })] }),
  ]
  if (bundles.length > 1) {
    cover.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'Included in this export', bold: true, color: INK, size: 22, font: FONT })] }))
    for (const b of bundles) {
      cover.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 20 }, children: [new TextRun({ text: clientTitle(b.client), size: 20, font: FONT, color: INK })] }))
    }
  }

  const children: (Paragraph | Table)[] = [...cover]
  bundles.forEach((b, i) => { for (const blk of clientBlocks(b, i)) children.push(blk) })

  const doc = new Document({
    creator: 'CZA Command Center',
    title: 'Client Records Export',
    styles: { default: { document: { run: { font: FONT, size: 21, color: INK } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  })

  return Packer.toBuffer(doc)
}
