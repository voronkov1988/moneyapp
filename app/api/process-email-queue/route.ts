import { createClient } from "@/lib/supabase"
import { type NextRequest, NextResponse } from "next/server"

// Функция для отправки email через Supabase Auth
async function sendEmailViaSupabase(supabase: any, to: string, subject: string, htmlContent: string) {
  try {
    // Используем Supabase Auth для отправки email
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "invite",
      email: to,
      options: {
        data: {
          subject: subject,
          html: htmlContent,
        },
      },
    })

    if (error) {
      throw error
    }

    return { success: true, data }
  } catch (error) {
    console.error("Supabase email error:", error)
    throw error
  }
}

// Альтернативная функция для отправки через внешний провайдер
async function sendEmailViaProvider(to: string, subject: string, htmlContent: string, textContent?: string) {
  // Здесь можно интегрировать внешний email провайдер
  // Например: SendGrid, Mailgun, AWS SES, Resend, etc.

  console.log(`Email to ${to}:`)
  console.log(`Subject: ${subject}`)
  console.log(`HTML: ${htmlContent.substring(0, 200)}...`)

  // Имитация отправки email
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() > 0.1) {
        resolve({ success: true, messageId: `email_${Date.now()}` })
      } else {
        reject(new Error("Email delivery failed"))
      }
    }, 1000)
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Получаем pending email из очереди
    const { data: pendingEmails, error } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lt("attempts", "max_attempts")
      .lte("scheduled_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(10) // Обрабатываем по 10 за раз

    if (error) {
      console.error("Error fetching pending emails:", error)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return NextResponse.json({ message: "No pending emails" })
    }

    const results = []

    for (const email of pendingEmails) {
      try {
        // Увеличиваем счетчик попыток
        await supabase
          .from("email_queue")
          .update({ attempts: email.attempts + 1 })
          .eq("id", email.id)

        // Пытаемся отправить email
        let result
        try {
          // Сначала пробуем через Supabase Auth
          result = await sendEmailViaSupabase(supabase, email.to_email, email.subject, email.html_content)
        } catch (supabaseError) {
          console.log("Supabase email failed, trying alternative provider...")
          // Если не получилось, используем альтернативный провайдер
          result = await sendEmailViaProvider(email.to_email, email.subject, email.html_content, email.text_content)
        }

        // Обновляем статус на "sent"
        await supabase
          .from("email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", email.id)

        results.push({
          id: email.id,
          email: email.to_email,
          status: "sent",
          result,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"

        // Если превышено максимальное количество попыток, помечаем как failed
        const newStatus = email.attempts + 1 >= email.max_attempts ? "failed" : "pending"

        await supabase
          .from("email_queue")
          .update({
            status: newStatus,
            error_message: errorMessage,
          })
          .eq("id", email.id)

        results.push({
          id: email.id,
          email: email.to_email,
          status: newStatus,
          error: errorMessage,
        })
      }
    }

    return NextResponse.json({
      message: "Email processing completed",
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error("Email processing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET endpoint для проверки статуса очереди email
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: stats, error } = await supabase.from("email_queue").select("status")

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
    console.error("Error getting email stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
