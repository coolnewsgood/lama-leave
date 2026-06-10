import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

function verifySignature(body: string, signature: string): boolean {
  if (!signature) return true
  const hash = crypto
    .createHmac('SHA256', process.env.LINE_CHANNEL_SECRET!)
    .update(body)
    .digest('base64')
  return hash === signature
}

async function replyMessage(replyToken: string, messages: object[]) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  })
}

// หา user จาก LINE userId ถ้าไม่มีให้สร้างใหม่
async function getOrCreateUser(lineUserId: string, displayName: string) {
  let user = await prisma.user.findUnique({ where: { lineUserId } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        lineUserId,
        name: displayName,
        leaveBalances: {
          create: [
            { leaveType: 'ANNUAL',     year: new Date().getFullYear(), total: 10, remaining: 10 },
            { leaveType: 'SICK',       year: new Date().getFullYear(), total: 30, remaining: 30 },
            { leaveType: 'PERSONAL',   year: new Date().getFullYear(), total: 3,  remaining: 3  },
            { leaveType: 'MATERNITY',  year: new Date().getFullYear(), total: 90, remaining: 90 },
            { leaveType: 'ORDINATION', year: new Date().getFullYear(), total: 15, remaining: 15 },
            { leaveType: 'BEREAVEMENT',year: new Date().getFullYear(), total: 3,  remaining: 3  },
          ]
        }
      }
    })
  }
  return user
}

// ดึงชื่อ LINE Profile
async function getLineProfile(userId: string) {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` }
  })
  return res.json()
}

function leaveTypeLabel(type: string) {
  const map: Record<string, string> = {
    ANNUAL: '🏖 ลาพักร้อน',
    SICK: '🤒 ลาป่วย',
    PERSONAL: '📌 ลากิจ',
    MATERNITY: '👶 ลาคลอด',
    ORDINATION: '🙏 ลาบวช',
    BEREAVEMENT: '⚰️ ลางานศพ',
  }
  return map[type] || type
}

function leaveBalanceRow(label: string, remaining: number, total: number) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, flex: 3, size: 'sm' },
      {
        type: 'text',
        text: `${remaining}/${total} วัน`,
        flex: 2,
        size: 'sm',
        align: 'end',
        color: remaining <= 2 ? '#EF4444' : '#22C55E',
        weight: 'bold',
      },
    ],
  }
}

async function handleEvent(event: any) {
  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim()
    const lineUserId = event.source.userId

    // ดึง profile และ user
    const profile = await getLineProfile(lineUserId)
    const user = await getOrCreateUser(lineUserId, profile.displayName || 'ไม่ระบุชื่อ')

    if (text === 'ลางาน' || text === 'เมนู') {
      await replyMessage(event.replyToken, [{
        type: 'template',
        altText: 'เมนูระบบลางาน',
        template: {
          type: 'buttons',
          title: '📋 ระบบลางาน',
          text: `สวัสดี ${user.name} 👋`,
          actions: [
            { type: 'message', label: '📝 ยื่นใบลา', text: 'ยื่นใบลา' },
            { type: 'message', label: '📊 ดูวันลาคงเหลือ', text: 'ดูวันลา' },
            { type: 'message', label: '📅 ประวัติการลา', text: 'ประวัติการลา' },
          ],
        },
      }])
      return
    }

    if (text === 'ยื่นใบลา') {
      await replyMessage(event.replyToken, [{
        type: 'template',
        altText: 'เลือกประเภทการลา',
        template: {
          type: 'buttons',
          title: '📝 ยื่นใบลา',
          text: 'เลือกประเภทการลา',
          actions: [
            { type: 'message', label: '🏖 ลาพักร้อน', text: 'ลาพักร้อน' },
            { type: 'message', label: '🤒 ลาป่วย', text: 'ลาป่วย' },
            { type: 'message', label: '📌 ลากิจ', text: 'ลากิจ' },
            { type: 'message', label: '➕ ประเภทอื่นๆ', text: 'ลาประเภทอื่น' },
          ],
        },
      }])
      return
    }

    // ดูวันลาจาก Database จริง
    if (text === 'ดูวันลา') {
      const balances = await prisma.leaveBalance.findMany({
        where: { userId: user.id, year: new Date().getFullYear() }
      })

      const rows = balances.map(b => leaveBalanceRow(leaveTypeLabel(b.leaveType), b.remaining, b.total))

      await replyMessage(event.replyToken, [{
        type: 'flex',
        altText: 'วันลาคงเหลือ',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#3B82F6',
            contents: [
              { type: 'text', text: '📊 วันลาคงเหลือ', color: '#FFFFFF', weight: 'bold', size: 'lg' },
              { type: 'text', text: user.name, color: '#DBEAFE', size: 'sm' },
            ],
          },
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: rows,
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: `ปี ${new Date().getFullYear()}`, color: '#9CA3AF', size: 'xs', align: 'center' },
            ],
          },
        },
      }])
      return
    }

    // ประวัติการลาจาก Database จริง
    if (text === 'ประวัติการลา') {
      const requests = await prisma.leaveRequest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      if (requests.length === 0) {
        await replyMessage(event.replyToken, [{ type: 'text', text: 'ยังไม่มีประวัติการลาครับ 📭' }])
        return
      }

      const statusLabel: Record<string, string> = {
        PENDING: '⏳ รออนุมัติ',
        APPROVED: '✅ อนุมัติแล้ว',
        REJECTED: '❌ ไม่อนุมัติ',
        CANCELLED: '🚫 ยกเลิก',
      }

      const list = requests.map((r, i) => {
        const start = r.startDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
        const end = r.endDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
        return `${i + 1}. ${leaveTypeLabel(r.leaveType)} ${start}-${end} → ${statusLabel[r.status]}`
      }).join('\n')

      await replyMessage(event.replyToken, [{
        type: 'text',
        text: `📅 ประวัติการลา (${requests.length} รายการล่าสุด)\n\n${list}`,
      }])
      return
    }

    if (text === 'ลาประเภทอื่น') {
      await replyMessage(event.replyToken, [{
        type: 'template',
        altText: 'เลือกประเภทการลา',
        template: {
          type: 'buttons',
          title: '➕ ประเภทการลาอื่นๆ',
          text: 'เลือกประเภทการลา',
          actions: [
            { type: 'message', label: '👶 ลาคลอด', text: 'ลาคลอด' },
            { type: 'message', label: '🙏 ลาบวช', text: 'ลาบวช' },
            { type: 'message', label: '⚰️ ลางานศพ', text: 'ลางานศพ' },
            { type: 'message', label: '🎖 ลาราชการทหาร', text: 'ลาราชการทหาร' },
          ],
        },
      }])
      return
    }

    await replyMessage(event.replyToken, [{
      type: 'text',
      text: 'พิมพ์ "เมนู" เพื่อดูตัวเลือกทั้งหมด 😊',
    }])
  }

  if (event.type === 'follow') {
    const profile = await getLineProfile(event.source.userId)
    await getOrCreateUser(event.source.userId, profile.displayName || 'ไม่ระบุชื่อ')
    await replyMessage(event.replyToken, [{
      type: 'text',
      text: `ยินดีต้อนรับ ${profile.displayName}! 🎉\n\nระบบได้สร้างบัญชีและวันลาให้คุณแล้ว\nพิมพ์ "เมนู" เพื่อเริ่มใช้งาน`,
    }])
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-line-signature') || ''

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const events = JSON.parse(body).events
  await Promise.all(events.map(handleEvent))

  return NextResponse.json({ status: 'ok' })
}

export async function GET() {
  return NextResponse.json({ status: 'Webhook is running ✅' })
}
