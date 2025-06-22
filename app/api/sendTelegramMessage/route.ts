import { createClient } from "@/lib/supabase"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

async function sendTelegramMessage(chatId: string, text: string) {
  const res = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  })

  const data = await res.json()
  if (!data.ok) {
    throw new Error(data.description || "Failed to send Telegram message")
  }
  return data
}

export async function POST(req: Request, res: Response) {

  const body = await req.json()
  const { message, profile } = body
  console.log(profile);
  

  await sendTelegramMessage( profile.phone, message)

  // return res.status(200).json({
  //   message: `Sent message to ${sentCount} Telegram chat(s)`,
  //   processed: sentCount,
  //   errors,
  // })
}
