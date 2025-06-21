"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Mail, Send, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface EmailQueueItem {
  id: string
  to_email: string
  subject: string
  html_content: string
  text_content?: string
  template_name?: string
  status: "pending" | "sent" | "failed"
  attempts: number
  max_attempts: number
  error_message?: string
  scheduled_at: string
  sent_at?: string
  created_at: string
}

interface EmailStats {
  total: number
  statusCounts: Record<string, number>
}

export default function EmailQueuePage() {
  const [emails, setEmails] = useState<EmailQueueItem[]>([])
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth")
      return
    }
    await loadData()
    setLoading(false)
  }

  const loadData = async () => {
    try {
      // Загружаем очередь email
      const { data: emailData, error: emailError } = await supabase
        .from("email_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (emailError) {
        setError("Ошибка загрузки очереди email: " + emailError.message)
      } else if (emailData) {
        setEmails(emailData)
      }

      // Загружаем статистику
      const response = await fetch("/api/process-email-queue")
      const statsData = await response.json()
      setStats(statsData)
    } catch (error) {
      setError("Ошибка загрузки данных")
    }
  }

  const handleProcessQueue = async () => {
    setProcessing(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch("/api/process-email-queue", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(`Обработано ${data.processed} email`)
        await loadData()
      } else {
        setError("Ошибка обработки очереди: " + data.error)
      }
    } catch (error) {
      setError("Ошибка при обработке очереди")
    } finally {
      setProcessing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "default"
      case "failed":
        return "destructive"
      case "pending":
        return "secondary"
      default:
        return "outline"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к дашборду
          </Link>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Очередь Email</h1>
            <p className="text-gray-600 mt-2">Управление отправкой email уведомлений</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Обновить
            </Button>
            <Button onClick={handleProcessQueue} disabled={processing}>
              {processing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Обработать очередь
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="queue" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="queue">Очередь</TabsTrigger>
            <TabsTrigger value="stats">Статистика</TabsTrigger>
          </TabsList>

          {/* Очередь email */}
          <TabsContent value="queue">
            <Card>
              <CardHeader>
                <CardTitle>Email очередь</CardTitle>
                <CardDescription>Последние email в очереди отправки</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {emails.map((email) => (
                    <div key={email.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Mail className="h-5 w-5 text-blue-600" />
                        <div className="flex-1">
                          <p className="font-medium">{email.to_email}</p>
                          <p className="text-sm text-gray-500">{email.subject}</p>
                          <p className="text-xs text-gray-400">
                            Создан: {new Date(email.created_at).toLocaleString("ru-RU")}
                          </p>
                          {email.sent_at && (
                            <p className="text-xs text-gray-400">
                              Отправлен: {new Date(email.sent_at).toLocaleString("ru-RU")}
                            </p>
                          )}
                          {email.error_message && <p className="text-xs text-red-500">Ошибка: {email.error_message}</p>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(email.status)}
                        <Badge variant={getStatusColor(email.status) as any}>
                          {email.status === "sent" && "Отправлено"}
                          {email.status === "failed" && "Ошибка"}
                          {email.status === "pending" && "Ожидает"}
                        </Badge>
                        <Badge variant="outline">
                          {email.attempts}/{email.max_attempts}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {emails.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>Очередь email пуста</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Статистика */}
          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle>Статистика email</CardTitle>
                <CardDescription>Общая статистика по отправленным email</CardDescription>
              </CardHeader>
              <CardContent>
                {stats ? (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                      <p className="text-sm text-gray-500">Всего email</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.statusCounts?.sent || 0}</div>
                      <p className="text-sm text-gray-500">Отправлено</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{stats.statusCounts?.pending || 0}</div>
                      <p className="text-sm text-gray-500">В очереди</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{stats.statusCounts?.failed || 0}</div>
                      <p className="text-sm text-gray-500">Ошибки</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Загрузка статистики...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
