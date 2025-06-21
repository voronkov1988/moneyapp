import { createClient } from "@/lib/supabase"
import { type NextRequest, NextResponse } from "next/server"

// Функция для отправки SMS (заглушка - здесь нужно интегрировать реальный SMS провайдер)
async function sendSMS(phone: string, message: string) {
  // Здесь должна быть интеграция с SMS провайдером
  // Например: Twilio, SMS.ru, или другой сервис

  console.log(`SMS to ${phone}: ${message}`)

  // Имитация отправки SMS
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Имитируем успешную отправку в 90% случаев
      if (Math.random() > 0.1) {
        resolve({ success: true, messageId: `msg_${Date.now()}` })
      } else {
        reject(new Error("SMS delivery failed"))
      }
    }, 1000)
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Получаем все pending SMS уведомления
    const { data: pendingNotifications, error } = await supabase
      .from("notification_logs")
      .select("*")
      .eq("notification_type", "sms")
      .eq("status", "pending")
      .limit(10) // Обрабатываем по 10 за раз

    if (error) {
      console.error("Error fetching pending notifications:", error)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return NextResponse.json({ message: "No pending SMS notifications" })
    }

    const results = []

    for (const notification of pendingNotifications) {
      try {
        // Отправляем SMS
        const result = await sendSMS(notification.recipient_phone, notification.message_content)

        // Обновляем статус на "sent"
        await supabase
          .from("notification_logs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", notification.id)

        results.push({
          id: notification.id,
          phone: notification.recipient_phone,
          status: "sent",
          result,
        })
      } catch (error) {
        // Обновляем статус на "failed"
        await supabase
          .from("notification_logs")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", notification.id)

        results.push({
          id: notification.id,
          phone: notification.recipient_phone,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      message: "SMS processing completed",
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error("SMS processing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET endpoint для проверки статуса SMS
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: stats, error } = await supabase
      .from("notification_logs")
      .select("status, notification_type")
      .eq("notification_type", "sms")

    if (error) {
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    const statusCounts =
      stats?.reduce(
        (acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      ) || {}

    return NextResponse.json({
      total: stats?.length || 0,
      statusCounts,
    })
  } catch (error) {
    console.error("Error getting SMS stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
