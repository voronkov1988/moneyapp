"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Bell, MessageSquare, Mail, Smartphone, CheckCircle, XCircle, Clock } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface NotificationSettings {
  id?: string
  family_id?: string
  sms_enabled: boolean
  sms_own_transactions: boolean
  sms_family_transactions: boolean
  sms_large_transactions: boolean
  sms_large_amount_threshold: number
  email_enabled: boolean
  email_own_transactions: boolean
  email_family_transactions: boolean
  email_weekly_summary: boolean
  email_monthly_summary: boolean
}

interface NotificationLog {
  id: string
  transaction_id: string
  notification_type: "sms" | "email"
  recipient_phone?: string
  recipient_email?: string
  message_content: string
  status: "pending" | "sent" | "failed" | "delivered"
  error_message?: string
  sent_at?: string
  created_at: string
  transaction_amount?: number
  transaction_category?: string
  transaction_description?: string
}

interface Family {
  id: string
  name: string
}

export default function NotificationsPage() {
  const [currentFamily, setCurrentFamily] = useState<Family | null>(null)
  const [settings, setSettings] = useState<NotificationSettings>({
    sms_enabled: false,
    sms_own_transactions: true,
    sms_family_transactions: true,
    sms_large_transactions: true,
    sms_large_amount_threshold: 5000,
    email_enabled: true,
    email_own_transactions: false,
    email_family_transactions: true,
    email_weekly_summary: true,
    email_monthly_summary: true,
  })
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [smsStats, setSmsStats] = useState<any>(null)
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
      // Загружаем текущую семью
      const { data: familyData } = await supabase.rpc("get_current_family")
      if (familyData && familyData.length > 0) {
        setCurrentFamily(familyData[0])
        await loadNotificationSettings(familyData[0].id)
      }

      // Загружаем логи уведомлений
      await loadNotificationLogs()

      // Загружаем статистику SMS
      await loadSmsStats()
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  const loadNotificationSettings = async (familyId: string) => {
    try {
      const { data, error } = await supabase.rpc("get_user_notification_settings")

      if (error) {
        console.error("Error loading notification settings:", error)
        return
      }

      if (data && data.length > 0) {
        const familySettings = data.find((s: any) => s.family_id === familyId)
        if (familySettings) {
          setSettings(familySettings)
        }
      }
    } catch (error) {
      console.error("Error loading notification settings:", error)
    }
  }

  const loadNotificationLogs = async () => {
    try {
      const { data, error } = await supabase.rpc("get_notification_logs", {
        limit_param: 20,
        offset_param: 0,
      })

      if (error) {
        console.error("Error loading notification logs:", error)
        return
      }

      if (data) {
        setLogs(data)
      }
    } catch (error) {
      console.error("Error loading notification logs:", error)
    }
  }

  const loadSmsStats = async () => {
    try {
      const response = await fetch("/api/send-sms")
      const data = await response.json()
      setSmsStats(data)
    } catch (error) {
      console.error("Error loading SMS stats:", error)
    }
  }

  const handleSaveSettings = async () => {
    if (!currentFamily) {
      setError("Семья не выбрана")
      return
    }

    setSaving(true)
    setError("")
    setSuccess("")

    try {
      const { error } = await supabase.rpc("upsert_notification_settings", {
        family_id_param: currentFamily.id,
        sms_enabled_param: settings.sms_enabled,
        sms_own_transactions_param: settings.sms_own_transactions,
        sms_family_transactions_param: settings.sms_family_transactions,
        sms_large_transactions_param: settings.sms_large_transactions,
        sms_large_amount_threshold_param: settings.sms_large_amount_threshold,
        email_enabled_param: settings.email_enabled,
        email_own_transactions_param: settings.email_own_transactions,
        email_family_transactions_param: settings.email_family_transactions,
        email_weekly_summary_param: settings.email_weekly_summary,
        email_monthly_summary_param: settings.email_monthly_summary,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess("Настройки сохранены!")
      }
    } catch (error) {
      setError("Ошибка при сохранении настроек")
    }

    setSaving(false)
  }

  const handleTestSms = async () => {
    try {
      const response = await fetch("/api/send-sms", { method: "POST" })
      const data = await response.json()
        console.log(response);
        
      if (response.ok) {
        setSuccess("SMS отправлены!")
        await loadNotificationLogs()
        await loadSmsStats()
      } else {
        setError("Ошибка отправки SMS: " + data.error)
      }
    } catch (error) {
      setError("Ошибка при отправке SMS")
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
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
      case "delivered":
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
            <h1 className="text-3xl font-bold text-gray-900">Настройки уведомлений</h1>
            <p className="text-gray-600 mt-2">Управление SMS и email уведомлениями о транзакциях</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleTestSms} variant="outline">
              Отправить pending SMS
            </Button>
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить настройки"}
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

        {!currentFamily ? (
          <Card>
            <CardContent className="text-center py-12">
              <Bell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет активной семьи</h3>
              <p className="text-gray-500 mb-6">
                Создайте семью или присоединитесь к существующей для настройки уведомлений
              </p>
              <Link href="/family">
                <Button>Перейти к семейному бюджету</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="settings" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="settings">Настройки</TabsTrigger>
              <TabsTrigger value="logs">История уведомлений</TabsTrigger>
              <TabsTrigger value="stats">Статистика</TabsTrigger>
            </TabsList>

            {/* Настройки уведомлений */}
            <TabsContent value="settings">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* SMS уведомления */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <MessageSquare className="mr-2 h-5 w-5" />
                      SMS уведомления
                    </CardTitle>
                    <CardDescription>Настройки SMS уведомлений о транзакциях</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Включить SMS уведомления</Label>
                        <p className="text-sm text-gray-500">Общий переключатель для всех SMS</p>
                      </div>
                      <Switch
                        checked={settings.sms_enabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, sms_enabled: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Мои транзакции</Label>
                        <p className="text-sm text-gray-500">Уведомления о ваших собственных тратах</p>
                      </div>
                      <Switch
                        checked={settings.sms_own_transactions}
                        onCheckedChange={(checked) => setSettings({ ...settings, sms_own_transactions: checked })}
                        disabled={!settings.sms_enabled}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Транзакции семьи</Label>
                        <p className="text-sm text-gray-500">Уведомления о тратах других членов семьи</p>
                      </div>
                      <Switch
                        checked={settings.sms_family_transactions}
                        onCheckedChange={(checked) => setSettings({ ...settings, sms_family_transactions: checked })}
                        disabled={!settings.sms_enabled}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Крупные транзакции</Label>
                        <p className="text-sm text-gray-500">Особые уведомления о больших тратах</p>
                      </div>
                      <Switch
                        checked={settings.sms_large_transactions}
                        onCheckedChange={(checked) => setSettings({ ...settings, sms_large_transactions: checked })}
                        disabled={!settings.sms_enabled}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="threshold">Порог крупной транзакции (₽)</Label>
                      <Input
                        id="threshold"
                        type="number"
                        value={settings.sms_large_amount_threshold}
                        onChange={(e) =>
                          setSettings({ ...settings, sms_large_amount_threshold: Number(e.target.value) })
                        }
                        disabled={!settings.sms_enabled || !settings.sms_large_transactions}
                        min="0"
                        step="100"
                      />
                      <p className="text-xs text-gray-500">Транзакции от этой суммы будут считаться крупными</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Email уведомления */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Mail className="mr-2 h-5 w-5" />
                      Email уведомления
                    </CardTitle>
                    <CardDescription>Настройки email уведомлений и отчетов</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Включить Email уведомления</Label>
                        <p className="text-sm text-gray-500">Общий переключатель для всех email</p>
                      </div>
                      <Switch
                        checked={settings.email_enabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, email_enabled: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Мои транзакции</Label>
                        <p className="text-sm text-gray-500">Email о ваших собственных транзакциях</p>
                      </div>
                      <Switch
                        checked={settings.email_own_transactions}
                        onCheckedChange={(checked) => setSettings({ ...settings, email_own_transactions: checked })}
                        disabled={!settings.email_enabled}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Транзакции семьи</Label>
                        <p className="text-sm text-gray-500">Email о транзакциях других членов семьи</p>
                      </div>
                      <Switch
                        checked={settings.email_family_transactions}
                        onCheckedChange={(checked) => setSettings({ ...settings, email_family_transactions: checked })}
                        disabled={!settings.email_enabled}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Недельные отчеты</Label>
                        <p className="text-sm text-gray-500">Еженедельная сводка по семейному бюджету</p>
                      </div>
                      <Switch
                        checked={settings.email_weekly_summary}
                        onCheckedChange={(checked) => setSettings({ ...settings, email_weekly_summary: checked })}
                        disabled={!settings.email_enabled}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Месячные отчеты</Label>
                        <p className="text-sm text-gray-500">Ежемесячная сводка по семейному бюджету</p>
                      </div>
                      <Switch
                        checked={settings.email_monthly_summary}
                        onCheckedChange={(checked) => setSettings({ ...settings, email_monthly_summary: checked })}
                        disabled={!settings.email_enabled}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* История уведомлений */}
            <TabsContent value="logs">
              <Card>
                <CardHeader>
                  <CardTitle>История уведомлений</CardTitle>
                  <CardDescription>Последние отправленные уведомления</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          {log.notification_type === "sms" ? (
                            <Smartphone className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Mail className="h-5 w-5 text-green-600" />
                          )}
                          <div>
                            <p className="font-medium">
                              {log.notification_type === "sms" ? log.recipient_phone : log.recipient_email}
                            </p>
                            <p className="text-sm text-gray-500">{log.message_content}</p>
                            {log.transaction_amount && (
                              <p className="text-xs text-gray-400">
                                Транзакция: {log.transaction_amount}₽ - {log.transaction_category}
                              </p>
                            )}
                            <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString("ru-RU")}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(log.status)}
                          <Badge variant={getStatusColor(log.status) as any}>
                            {log.status === "sent" && "Отправлено"}
                            {log.status === "delivered" && "Доставлено"}
                            {log.status === "failed" && "Ошибка"}
                            {log.status === "pending" && "Ожидает"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {logs.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p>Нет отправленных уведомлений</p>
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
                  <CardTitle>Статистика уведомлений</CardTitle>
                  <CardDescription>Общая статистика по отправленным уведомлениям</CardDescription>
                </CardHeader>
                <CardContent>
                  {smsStats ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{smsStats.total}</div>
                        <p className="text-sm text-gray-500">Всего SMS</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{smsStats.statusCounts?.sent || 0}</div>
                        <p className="text-sm text-gray-500">Отправлено</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{smsStats.statusCounts?.pending || 0}</div>
                        <p className="text-sm text-gray-500">В очереди</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{smsStats.statusCounts?.failed || 0}</div>
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
        )}
      </div>
    </div>
  )
}
