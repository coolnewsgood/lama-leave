import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function verifySignature(body: string, signature: string): boolean {
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

function leaveBalanceRow(label: string, remaining: string, total: string) {
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
        color: parseInt(remaining) <= 2 ? '#EF4444' : '#22C55E',
        weight: 'bold',
      },
    ],
  }
}

async function handleEvent(event: any) {
  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim()

    if (text === 'ลางาน' || text === 'เมนู') {
      await replyMessage(event.replyToken, [
        {
          type: 'template',
          altText: 'เมนูระบบลางาน',
          template: {
            type: 'buttons',
            title: '📋 ระบบลางาน',
            text: 'เลือกสิ่งที่ต้องการ',
            actions: [
              { type: 'message', label: '📝 ยื่นใบลา', text: 'ยื่นใบลา' },
              { type: 'message', label: '📊 ดูวันลาคงเหลือ', text: 'ดูวันลา' },
              { type: 'message', label: '📅 ประวัติการลา', text: 'ประวัติการลา' },
            ],
          },
        },
      ])
      return
    }

    if (text === 'ยื่นใบลา') {
      await replyMessage(event.replyToken, [
        {
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
        },
      ])
      return
    }

    if (text === 'ดูวันลา') {
      await replyMessage(event.replyToken, [
        {
          type: 'flex',
          altText: 'วันลาคงเหลือ',
          contents: {
            type: 'bubble',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#3B82F6',
              contents: [
                {
                  type: 'text',
                  text: '📊 วันลาคงเหลือ',
                  color: '#FFFFFF',
                  weight: 'bold',
                  size: 'lg',
                },
              ],
            },
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'md',
              contents: [
                leaveBalanceRow('🏖 ลาพักร้อน', '6', '10'),
                leaveBalanceRow('🤒 ลาป่วย', '28', '30'),
                leaveBalanceRow('📌 ลากิจ', '3', '3'),
              ],
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: 'อัปเดตล่าสุด: วันนี้',
                  color: '#9CA3AF',
                  size: 'xs',
                  align: 'center',
                },
              ],
            },
          },
        },
      ])
      return
    }

    if (text === 'ประวัติการลา') {
      await replyMessage(event.replyToken, [
        {
          type: 'text',
          text: '📅 ประวัติการลา (3 รายการล่าสุด)\n\n1. ลาพักร้อน 12-13 มิ.ย. → ✅ อนุมัติแล้ว\n2. ลาป่วย 5 มิ.ย. → ✅ อนุมัติแล้ว\n3. ลากิจ 1 มิ.ย. → ✅ อนุมัติแล้ว',
        },
      ])
      return
    }

    if (text === 'ลาประเภทอื่น') {
      await replyMessage(event.replyToken, [
        {
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
        },
      ])
      return
    }

    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: 'พิมพ์ "เมนู" เพื่อดูตัวเลือกทั้งหมด 😊',
      },
    ])
  }

  if (event.type === 'follow') {
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: 'ยินดีต้อนรับสู่ระบบลางาน! 🎉\n\nพิมพ์ "เมนู" เพื่อเริ่มใช้งาน',
      },
    ])
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
  console.log('SECRET exists:', !!process.env.LINE_CHANNEL_SECRET)
  console.log('TOKEN exists:', !!process.env.LINE_CHANNEL_ACCESS_TOKEN)
  return NextResponse.json({ status: 'Webhook is running ✅' })
}
