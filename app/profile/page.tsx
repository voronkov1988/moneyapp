"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, User, Bell, CreditCard, Smartphone, Mail, Save, Send } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

interface UserProfile {
  id: string
  email: string
  full_name?: string
  phone?: string
  notifications_enabled: boolean
  sms_notifications: boolean
  email_notifications: boolean
  budget_alerts: boolean
  transaction_alerts: boolean
  created_at: string
  updated_at: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()
  const supabase = createClient()
  const [openModal, setOpenModal] = useState(false)

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
    await loadProfile(user.id)
    setLoading(false)
  }

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

    if (error && error.code !== "PGRST116") {
      setError("Ошибка загрузки профиля")
      return
    }

    if (data) {
      setProfile(data)
    } else {
      // Создаем профиль если его нет
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const newProfile = {
          id: user.id,
          email: user.email || "",
          notifications_enabled: true,
          sms_notifications: false,
          email_notifications: true,
          budget_alerts: true,
          transaction_alerts: false,
        }
        const { data: createdProfile } = await supabase.from("profiles").insert([newProfile]).select().single()
        if (createdProfile) {
          setProfile(createdProfile)
        }
      }
    }
  }

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    const formData = new FormData(e.currentTarget)
    const fullName = formData.get("fullName") as string
    const phone = formData.get("phone") as string

    if (!profile) {
      setError("Профиль не загружен")
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess("Профиль успешно обновлен!")
      setProfile({ ...profile, full_name: fullName, phone: phone })
    }

    setSaving(false)
  }

  const handleNotificationUpdate = async (field: string, value: boolean) => {
    if (!profile) return

    setSaving(true)
    setError("")

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        [field]: value,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setProfile({ ...profile, [field]: value } as UserProfile)
      setSuccess("Настройки уведомлений обновлены!")
    }

    setSaving(false)
  }

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    const formData = new FormData(e.currentTarget)
    const newPassword = formData.get("newPassword") as string
    const confirmPassword = formData.get("confirmPassword") as string

    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают")
      setSaving(false)
      return
    }

    if (newPassword.length < 6) {
      setError("Пароль должен содержать минимум 6 символов")
      setSaving(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setError(error.message)
    } else {
      setSuccess("Пароль успешно изменен!")
      // Очистка формы
      const form = e.currentTarget
      form.reset()
    }

    setSaving(false)
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к дашборду
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Профиль пользователя</h1>
          <p className="text-gray-600 mt-2">Управление личными данными и настройками</p>
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

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Личные данные</TabsTrigger>
            <TabsTrigger value="notifications">Уведомления</TabsTrigger>
            <TabsTrigger value="security">Безопасность</TabsTrigger>
          </TabsList>

          {/* Личные данные */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Личная информация
                </CardTitle>
                <CardDescription>Обновите свои личные данные</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          value={profile?.email || ""}
                          disabled
                          className="pl-10 bg-gray-50"
                        />
                      </div>
                      <p className="text-xs text-gray-500">Email нельзя изменить</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fullName">Полное имя</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        placeholder="Введите ваше полное имя"
                        defaultValue={profile?.full_name || ""}
                      />
                    </div>

                    {/* <div className="space-y-2">
                      <Label htmlFor="phone">Телефон</Label>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="+7 (999) 123-45-67"
                          defaultValue={profile?.phone || ""}
                          className="pl-10"
                        />
                      </div>
                      <p className="text-xs text-gray-500">Для SMS уведомлений</p>
                    </div> */}

                    <div className="space-y-2">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Label htmlFor="phone">Телеграмм ID</Label>
                        <div onClick={() => setOpenModal(true)} style={{ cursor: 'help' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-question-mark-icon lucide-message-circle-question-mark"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                        </div>
                      </div>
                      <div className="relative">
                        <Send className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="+7 (999) 123-45-67"
                          defaultValue={profile?.phone || ""}
                          className="pl-10"
                        />
                      </div>
                      <p className="text-xs text-gray-500">Для уведомлений в телеграмм</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Дата регистрации</Label>
                      <Input
                        value={
                          profile?.created_at ? new Date(profile.created_at).toLocaleDateString("ru-RU") : "Не указана"
                        }
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Сохранение..." : "Сохранить изменения"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Уведомления */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="mr-2 h-5 w-5" />
                  Настройки уведомлений
                </CardTitle>
                <CardDescription>Управление уведомлениями и оповещениями</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Включить уведомления</Label>
                    <p className="text-sm text-gray-500">Общий переключатель для всех уведомлений</p>
                  </div>
                  <Switch
                    checked={profile?.notifications_enabled || false}
                    onCheckedChange={(checked) => handleNotificationUpdate("notifications_enabled", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email уведомления</Label>
                    <p className="text-sm text-gray-500">Получать уведомления на email</p>
                  </div>
                  <Switch
                    checked={profile?.email_notifications || false}
                    onCheckedChange={(checked) => handleNotificationUpdate("email_notifications", checked)}
                    disabled={!profile?.notifications_enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>SMS уведомления</Label>
                    <p className="text-sm text-gray-500">Получать SMS на указанный телефон</p>
                  </div>
                  <Switch
                    checked={profile?.sms_notifications || false}
                    onCheckedChange={(checked) => handleNotificationUpdate("sms_notifications", checked)}
                    disabled={!profile?.notifications_enabled || !profile?.phone}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Уведомления о бюджете</Label>
                    <p className="text-sm text-gray-500">Предупреждения о превышении бюджета</p>
                  </div>
                  <Switch
                    checked={profile?.budget_alerts || false}
                    onCheckedChange={(checked) => handleNotificationUpdate("budget_alerts", checked)}
                    disabled={!profile?.notifications_enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Уведомления о транзакциях</Label>
                    <p className="text-sm text-gray-500">Уведомления о новых транзакциях</p>
                  </div>
                  <Switch
                    checked={profile?.transaction_alerts || false}
                    onCheckedChange={(checked) => handleNotificationUpdate("transaction_alerts", checked)}
                    disabled={!profile?.notifications_enabled}
                  />
                </div>

                {!profile?.phone && profile?.sms_notifications && (
                  <Alert>
                    <AlertDescription>
                      Для получения SMS уведомлений необходимо указать номер телефона в личных данных.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Безопасность */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="mr-2 h-5 w-5" />
                  Безопасность аккаунта
                </CardTitle>
                <CardDescription>Изменение пароля и настройки безопасности</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Новый пароль</Label>
                    <Input id="newPassword" name="newPassword" type="password" placeholder="••••••••" minLength={6} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      minLength={6}
                    />
                  </div>

                  <Button type="submit" disabled={saving}>
                    {saving ? "Изменение..." : "Изменить пароль"}
                  </Button>
                </form>

                <div className="mt-8 pt-6 border-t">
                  <h3 className="text-lg font-medium mb-4">Автоматические транзакции</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">🚀 Скоро появится!</h4>
                    <p className="text-blue-800 text-sm mb-3">
                      Мы работаем над интеграцией с банковскими API для автоматического импорта транзакций.
                    </p>
                    <div className="space-y-2 text-sm text-blue-700">
                      <p>• Автоматическое добавление транзакций с банковских карт</p>
                      <p>• Интеграция с популярными банками России</p>
                      <p>• Безопасное подключение через Open Banking</p>
                      <p>• Автоматическая категоризация транзакций</p>
                    </div>
                    <Button disabled className="mt-4" variant="outline">
                      Подключить банк (скоро)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent>
          <DialogTitle>Настройка уведомлений в телеграмм:</DialogTitle>
          <DialogDescription>
            1. Для начала откройте бота, в нем можно получить ваш ид <a target="_blank" href="https://t.me/getidsbot">https://t.me/getidsbot</a>
            <img src="/instr.png" alt="" />
            2. Открыть бота <a target="_blank" href="https://t.me/finance_tracker_appbot">https://t.me/finance_tracker_appbot</a> и нажать кнопку START
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  )
}
