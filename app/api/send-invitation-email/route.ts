import { createClient } from "@/lib/supabase"
import { type NextRequest, NextResponse } from "next/server"

// Функция для отправки email (здесь нужно интегрировать реальный email провайдер)
async function sendEmail(to: string, subject: string, htmlContent: string, textContent?: string) {
  // Здесь должна быть интеграция с email провайдером
  // Например: SendGrid, Mailgun, AWS SES, или другой сервис

  console.log(`Email to ${to}:`)
  console.log(`Subject: ${subject}`)
  console.log(`HTML: ${htmlContent}`)

  // Имитация отправки email
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Имитируем успешную отправку в 95% случаев
      if (Math.random() > 0.05) {
        resolve({ success: true, messageId: `email_${Date.now()}` })
      } else {
        reject(new Error("Email delivery failed"))
      }
    }, 500)
  })
}

export async function POST(request: NextRequest) {
  try {
    const { invitationId } = await request.json()

    if (!invitationId) {
      return NextResponse.json({ error: "Invitation ID is required" }, { status: 400 })
    }

    const supabase = createClient()

    // Получаем данные приглашения
    const { data: invitation, error: invitationError } = await supabase
      .from("family_invitations")
      .select(`
        *,
        families!inner(name),
        family_members!inner(display_name)
      `)
      .eq("id", invitationId)
      .eq("status", "pending")
      .single()

    if (invitationError || !invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
    }

    // Получаем шаблон email
    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_name", "family_invitation")
      .eq("is_active", true)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: "Email template not found" }, { status: 500 })
    }

    // Формируем URL приглашения
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const invitationUrl = `${baseUrl}/invite/${invitation.invitation_token}`

    // Заменяем переменные в шаблоне
    const variables = {
      family_name: invitation.families.name,
      inviter_name: invitation.family_members.display_name,
      display_name: invitation.display_name,
      invitation_url: invitationUrl,
      app_url: baseUrl,
    }

    let subject = template.subject
    let htmlContent = template.html_content
    let textContent = template.text_content

    // Заменяем переменные
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`
      subject = subject.replace(new RegExp(placeholder, "g"), value)
      htmlContent = htmlContent.replace(new RegExp(placeholder, "g"), value)
      if (textContent) {
        textContent = textContent.replace(new RegExp(placeholder, "g"), value)
      }
    })

    try {
      // Отправляем email
      const result = await sendEmail(invitation.email, subject, htmlContent, textContent)

      return NextResponse.json({
        success: true,
        message: "Invitation email sent successfully",
        invitationUrl,
        result,
      })
    } catch (emailError) {
      console.error("Failed to send email:", emailError)
      return NextResponse.json(
        {
          error: "Failed to send email",
          details: emailError instanceof Error ? emailError.message : "Unknown error",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Send invitation email error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
