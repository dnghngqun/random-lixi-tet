import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import nodemailer from 'nodemailer'

dotenv.config()

const app = express()
const port = Number(process.env.MAIL_SERVER_PORT ?? 8787)
const mailUser = process.env.MAIL_USER
const mailPassword = process.env.MAIL_APP_PASSWORD
const mailTo = process.env.MAIL_TO || mailUser
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: mailUser,
      pass: mailPassword,
    },
  })
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Origin is not allowed by CORS'))
    },
  }),
)

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mailConfigured: Boolean(mailUser && mailPassword && mailTo),
  })
})

app.post('/api/send-result', async (req, res) => {
  if (!mailUser || !mailPassword || !mailTo) {
    res.status(503).json({
      ok: false,
      message: 'Server mail chua duoc cau hinh day du bien moi truong.',
    })
    return
  }

  const { participantName, spins, total, finishedAt } = req.body ?? {}

  if (typeof participantName !== 'string' || !participantName.trim()) {
    res.status(400).json({
      ok: false,
      message: 'participantName khong hop le.',
    })
    return
  }

  if (!Array.isArray(spins) || spins.length !== 3) {
    res.status(400).json({
      ok: false,
      message: 'Du lieu spins phai co dung 3 luot.',
    })
    return
  }

  const sanitizedSpins = spins
    .map((spin, index) => ({
      index: index + 1,
      amount: Number(spin?.amount),
      time: typeof spin?.time === 'string' ? spin.time : '',
    }))
    .filter((spin) => Number.isFinite(spin.amount))

  if (sanitizedSpins.length !== 3) {
    res.status(400).json({
      ok: false,
      message: 'Co menh gia quay khong hop le.',
    })
    return
  }

  const totalFromSpins = sanitizedSpins.reduce((sum, spin) => sum + spin.amount, 0)
  const normalizedTotal = Number.isFinite(Number(total)) ? Number(total) : totalFromSpins
  const endedAt = typeof finishedAt === 'string' ? finishedAt : new Date().toISOString()
  const endedAtDisplay = new Date(endedAt).toLocaleString('vi-VN')
  const safeParticipantName = escapeHtml(participantName.trim())

  const spinsRowsHtml = sanitizedSpins
    .map(
      (spin) => `
        <tr>
          <td style="padding:8px;border:1px solid #f1d58f;">Lan ${spin.index}</td>
          <td style="padding:8px;border:1px solid #f1d58f;">${escapeHtml(`${spin.amount}k`)}</td>
          <td style="padding:8px;border:1px solid #f1d58f;">${escapeHtml(spin.time)}</td>
        </tr>
      `,
    )
    .join('')

  const subject = `[Tet 2026] ${participantName.trim()} da hoan tat 3 luot - ${normalizedTotal}k`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#4a1020;">
      <h2 style="margin:0 0 8px;">Ket qua vong quay li xi Tet 2026</h2>
      <p style="margin:0 0 6px;"><strong>Nguoi choi:</strong> ${safeParticipantName}</p>
      <p style="margin:0 0 6px;"><strong>Thoi diem hoan tat:</strong> ${escapeHtml(endedAtDisplay)}</p>
      <p style="margin:0 0 12px;"><strong>Tong thuong:</strong> ${escapeHtml(`${normalizedTotal}k`)}</p>
      <table style="border-collapse:collapse;width:100%;max-width:540px;background:#fff9ea;">
        <thead>
          <tr>
            <th style="padding:8px;border:1px solid #f1d58f;text-align:left;">Luot</th>
            <th style="padding:8px;border:1px solid #f1d58f;text-align:left;">Menh gia</th>
            <th style="padding:8px;border:1px solid #f1d58f;text-align:left;">Thoi gian</th>
          </tr>
        </thead>
        <tbody>
          ${spinsRowsHtml}
        </tbody>
      </table>
    </div>
  `

  const text = [
    'Ket qua vong quay li xi Tet 2026',
    `Nguoi choi: ${participantName.trim()}`,
    `Thoi diem hoan tat: ${endedAtDisplay}`,
    `Tong thuong: ${normalizedTotal}k`,
    ...sanitizedSpins.map(
      (spin) => `Lan ${spin.index}: ${spin.amount}k (${spin.time || 'khong ro thoi gian'})`,
    ),
  ].join('\n')

  try {
    const transporter = buildTransporter()
    const info = await transporter.sendMail({
      from: `"Vong quay Li Xi Tet 2026" <${mailUser}>`,
      to: mailTo,
      subject,
      text,
      html,
    })

    res.json({
      ok: true,
      message: 'Email ket qua da duoc gui.',
      messageId: info.messageId,
    })
  } catch (error) {
    console.error('[mail] send failed:', error)
    res.status(500).json({
      ok: false,
      message: 'Gui email that bai. Hay kiem tra lai thong tin mail va app password.',
    })
  }
})

app.listen(port, () => {
  console.log(`[mail-server] running at http://localhost:${port}`)

  if (!mailUser || !mailPassword || !mailTo) {
    console.warn(
      '[mail-server] Missing MAIL_USER / MAIL_APP_PASSWORD / MAIL_TO in .env',
    )
  }
})
