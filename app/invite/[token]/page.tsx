"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users, Crown, User, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface InvitationData {
  id: string
  family_id: string
  family_name: string
  invited_by: string
  inviter_name: string
  email: string
  display_name: string
  role: "admin" | "member"
  status: string
  expires_at: string
  created_at: string
}

export default function InvitePage({ params }: { params: { token: string } }) {
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [currentUser, setCurrentUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadInvitation()
    checkCurrentUser()
  }, [params.token])

  const checkCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  const loadInvitation = async () => {
    try {
      const { data, error } = await supabase.rpc("get_invitation_by_token", {
        token_param: params.token,
      })

      if (error) {
        setError("Ошибка загрузки приглашения: " + error.message)
        return
      }

      if (!data || data.length === 0) {
        setError("Приглашение не найдено или истекло")
        return
      }

      setInvitation(data[0])
    } catch (error) {
      setError("Ошибка при загрузке приглашения")
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptInvitation = async () => {
    if (!currentUser) {
      // Перенаправляем на регистрацию с сохранением токена
      router.push(`/auth?invite=${params.token}&email=${invitation?.email}`)
      return
    }

    setProcessing(true)
    setError("")
    setSuccess("")

    try {
      const { error } = await supabase.rpc("accept_family_invitation", {
        token_param: params.token,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess("Приглашение принято! Добро пожаловать в семью!")
        setTimeout(() => {
          router.push("/family")
        }, 2000)
      }
    } catch (error) {
      setError("Ошибка при принятии приглашения")
    } finally {
      setProcessing(false)
    }
  }

  const handleDeclineInvitation = async () => {
    if (!confirm("Вы уверены, что хотите отклонить это приглашение?")) return

    setProcessing(true)
    setError("")

    try {
      const { error } = await supabase.rpc("decline_family_invitation", {
        token_param: params.token,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess("Приглашение отклонено")
        setTimeout(() => {
          router.push("/")
        }, 2000)
      }
    } catch (error) {
      setError("Ошибка при отклонении приглашения")
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-12">
            <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Приглашение недействительно</h3>
            <p className="text-gray-500 mb-6">{error}</p>
            <Link href="/">
              <Button>На главную</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Приглашение в семейный бюджет</h1>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {invitation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                {invitation.family_name}
              </CardTitle>
              <CardDescription>
                {invitation.inviter_name} приглашает вас присоединиться к семейному бюджету
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Детали приглашения</h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex justify-between">
                    <span>Семья:</span>
                    <span className="font-medium">{invitation.family_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Пригласил:</span>
                    <span className="font-medium">{invitation.inviter_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ваша роль:</span>
                    <span className="flex items-center font-medium">
                      {invitation.role === "admin" ? (
                        <>
                          <Crown className="mr-1 h-4 w-4" />
                          Администратор
                        </>
                      ) : (
                        <>
                          <User className="mr-1 h-4 w-4" />
                          Участник
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Имя в семье:</span>
                    <span className="font-medium">{invitation.display_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="font-medium">{invitation.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Истекает:</span>
                    <span className="font-medium">{new Date(invitation.expires_at).toLocaleDateString("ru-RU")}</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-900 mb-2">Что вы получите:</h3>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Доступ к семейным финансам и транзакциям</li>
                  <li>• Возможность добавлять свои доходы и расходы</li>
                  <li>• Участие в планировании семейного бюджета</li>
                  <li>• Уведомления о тратах семьи</li>
                  <li>• Доступ к отчетам и аналитике</li>
                  {invitation.role === "admin" && <li>• Права администратора семьи</li>}
                </ul>
              </div>

              {!currentUser && (
                <Alert>
                  <AlertDescription>
                    Для принятия приглашения необходимо войти в аккаунт или зарегистрироваться с email{" "}
                    <strong>{invitation.email}</strong>
                  </AlertDescription>
                </Alert>
              )}

              {currentUser && currentUser.email !== invitation.email && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Вы вошли как <strong>{currentUser.email}</strong>, но приглашение отправлено на{" "}
                    <strong>{invitation.email}</strong>. Войдите с правильным email.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={handleAcceptInvitation}
                  disabled={processing || (currentUser && currentUser.email !== invitation.email)}
                  className="flex-1"
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Обработка...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {currentUser ? "Принять приглашение" : "Войти и принять"}
                    </>
                  )}
                </Button>
                <Button onClick={handleDeclineInvitation} disabled={processing} variant="outline">
                  <XCircle className="mr-2 h-4 w-4" />
                  Отклонить
                </Button>
              </div>

              {!currentUser && (
                <div className="text-center">
                  <Link href={`/auth?invite=${params.token}&email=${invitation.email}`}>
                    <Button variant="outline">Войти или зарегистрироваться</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
