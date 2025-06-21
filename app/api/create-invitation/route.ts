import { createClient } from "@/lib/supabase"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { familyId, email, displayName, role } = await request.json()

    if (!familyId || !email || !displayName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createClient()

    // Создаем приглашение с автоматической отправкой email
    const { data, error } = await supabase.rpc("create_family_invitation_with_email", {
      family_id_param: familyId,
      email_param: email,
      display_name_param: displayName,
      role_param: role || "member",
    })

    if (error) {
      console.error("Error creating invitation:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Запускаем обработку очереди email
    try {
      await fetch(`${request.nextUrl.origin}/api/process-email-queue`, {
        method: "POST",
      })
    } catch (emailError) {
      console.error("Error processing email queue:", emailError)
      // Не возвращаем ошибку, так как приглашение уже создано
    }

    return NextResponse.json({
      success: true,
      invitationId: data,
      message: "Invitation created and email queued for sending",
    })
  } catch (error) {
    console.error("Create invitation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
