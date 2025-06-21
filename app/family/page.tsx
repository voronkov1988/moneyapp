"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ArrowLeft, Users, Plus, UserPlus, Crown, User, Phone, Copy, Check, Trash2, Mail, Send } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Family {
  id: string
  name: string
  description?: string
  created_by: string
  created_at: string
  user_role?: string
}

interface FamilyMember {
  id: string
  user_id: string
  display_name: string
  role: "admin" | "member"
  joined_at: string
  is_active: boolean
  email?: string
}

interface FamilyInvitation {
  id: string
  email: string
  display_name: string
  role: "admin" | "member"
  status: "pending" | "accepted" | "declined" | "expired"
  invitation_code: string
  invitation_token?: string
  expires_at: string
  created_at: string
  invited_by: string
}

interface PhoneNumber {
  id: string
  phone_number: string
  is_primary: boolean
  notifications_enabled: boolean
  user_id: string
  display_name?: string
}

export default function FamilyPage() {
  const [currentFamily, setCurrentFamily] = useState<Family | null>(null)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([])
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isCreateFamilyOpen, setIsCreateFamilyOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isPhoneOpen, setIsPhoneOpen] = useState(false)
  const [copiedCode, setCopiedCode] = useState("")
  const [sendingEmail, setSendingEmail] = useState<string>("")
  const [currentUser, setCurrentUser] = useState<any>(null)
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
    setCurrentUser(user)
    await loadFamilyData()
    setLoading(false)
  }

  const loadFamilyData = async () => {
    try {
      // Используем новую функцию для получения текущей семьи
      const { data: familyData, error: familyError } = await supabase.rpc("get_current_family")

      if (familyError) {
        console.error("Error loading family:", familyError)
        return
      }

      if (familyData && familyData.length > 0) {
        const family = familyData[0]
        setCurrentFamily(family)
        await loadFamilyMembers(family.id)
        await loadInvitations(family.id)
        await loadPhoneNumbers(family.id)
      }
    } catch (error) {
      console.error("Error loading family data:", error)
    }
  }

  const loadFamilyMembers = async (familyId: string) => {
    try {
      const { data, error } = await supabase.rpc("get_family_members", {
        family_id_param: familyId,
      })

      if (error) {
        console.error("Error loading family members:", error)
        return
      }

      if (data) {
        setFamilyMembers(data)
      }
    } catch (error) {
      console.error("Error loading family members:", error)
    }
  }

  const loadInvitations = async (familyId: string) => {
    try {
      // Используем новую функцию для получения приглашений
      const { data, error } = await supabase.rpc("get_family_invitations", {
        family_id_param: familyId,
      })

      if (error) {
        console.error("Error loading invitations:", error)
        setError("Ошибка загрузки приглашений: " + error.message)
        return
      }

      if (data) {
        setInvitations(data)
      }
    } catch (error) {
      console.error("Error loading invitations:", error)
      setError("Ошибка загрузки приглашений")
    }
  }

  const loadPhoneNumbers = async (familyId: string) => {
    try {
      const { data, error } = await supabase.rpc("get_family_phone_numbers", {
        family_id_param: familyId,
      })

      if (error) {
        console.error("Error loading phone numbers:", error)
        return
      }

      if (data) {
        setPhoneNumbers(data)
      }
    } catch (error) {
      console.error("Error loading phone numbers:", error)
    }
  }

  const handleCreateFamily = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const description = formData.get("description") as string

    try {
      const { data: family, error: createError } = await supabase
        .from("families")
        .insert([
          {
            name,
            description,
            created_by: currentUser.id,
          },
        ])
        .select()
        .single()

      if (createError) {
        setError(createError.message)
      } else {
        // Обновляем профиль пользователя
        await supabase.from("profiles").update({ current_family_id: family.id }).eq("id", currentUser.id)

        setSuccess("Семья успешно создана!")
        setIsCreateFamilyOpen(false)
        await loadFamilyData()
      }
    } catch (error) {
      setError("Ошибка при создании семьи")
    }

    setSaving(false)
  }

  const handleInviteMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const displayName = formData.get("displayName") as string
    const role = formData.get("role") as "admin" | "member"

    if (!currentFamily) return

    try {
      // Используем новую функцию для создания приглашения
      const { data, error: inviteError } = await supabase.rpc("create_family_invitation", {
        family_id_param: currentFamily.id,
        email_param: email,
        display_name_param: displayName,
        role_param: role,
      })

      if (inviteError) {
        setError(inviteError.message)
      } else {
        setSuccess("Приглашение создано!")
        setIsInviteOpen(false)
        await loadInvitations(currentFamily.id)
        // Очищаем форму
        const form = e.currentTarget
        form.reset()
      }
    } catch (error) {
      setError("Ошибка при отправке приглашения")
    }

    setSaving(false)
  }

  const handleSendEmail = async (invitationId: string) => {
    setSendingEmail(invitationId)
    setError("")
    setSuccess("")

    try {
      const response = await fetch("/api/send-invitation-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invitationId }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess("Email приглашение отправлено!")
      } else {
        setError("Ошибка отправки email: " + data.error)
      }
    } catch (error) {
      setError("Ошибка при отправке email")
    } finally {
      setSendingEmail("")
    }
  }

  const handleAddPhone = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    const formData = new FormData(e.currentTarget)
    const phoneNumber = formData.get("phoneNumber") as string
    const isPrimary = formData.get("isPrimary") === "on"

    if (!currentFamily) return

    try {
      const { error: phoneError } = await supabase.rpc("add_family_phone_number", {
        family_id_param: currentFamily.id,
        phone_number_param: phoneNumber,
        is_primary_param: isPrimary,
      })

      if (phoneError) {
        setError(phoneError.message)
      } else {
        setSuccess("Номер телефона добавлен!")
        setIsPhoneOpen(false)
        await loadPhoneNumbers(currentFamily.id)
        // Очищаем форму
        const form = e.currentTarget
        form.reset()
      }
    } catch (error) {
      setError("Ошибка при добавлении номера")
    }

    setSaving(false)
  }

  const copyInvitationLink = async (invitation: FamilyInvitation) => {
    if (!invitation.invitation_token) {
      setError("Токен приглашения не найден")
      return
    }

    const baseUrl = window.location.origin
    const invitationUrl = `${baseUrl}/invite/${invitation.invitation_token}`

    try {
      await navigator.clipboard.writeText(invitationUrl)
      setCopiedCode(invitation.id)
      setSuccess("Ссылка приглашения скопирована!")
      setTimeout(() => setCopiedCode(""), 2000)
    } catch (error) {
      setError("Не удалось скопировать ссылку")
    }
  }

  const removeInvitation = async (invitationId: string) => {
    if (!confirm("Вы уверены, что хотите отменить это приглашение?")) return

    try {
      const { error } = await supabase.rpc("cancel_family_invitation", {
        invitation_id_param: invitationId,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess("Приглашение отменено")
        if (currentFamily) {
          await loadInvitations(currentFamily.id)
        }
      }
    } catch (error) {
      setError("Ошибка при отмене приглашения")
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm("Вы уверены, что хотите исключить этого члена семьи?")) return

    try {
      const { error } = await supabase.rpc("remove_family_member", {
        member_id_param: memberId,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess("Член семьи исключен")
        if (currentFamily) {
          await loadFamilyMembers(currentFamily.id)
        }
      }
    } catch (error) {
      setError("Ошибка при удалении участника")
    }
  }

  const removePhone = async (phoneId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот номер?")) return

    try {
      const { error } = await supabase.from("family_phone_numbers").delete().eq("id", phoneId)

      if (!error) {
        setSuccess("Номер телефона удален")
        if (currentFamily) {
          await loadPhoneNumbers(currentFamily.id)
        }
      } else {
        setError("Ошибка при удалении номера")
      }
    } catch (error) {
      setError("Ошибка при удалении номера")
    }
  }

  const isAdmin = currentFamily?.user_role === "admin"

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
            <h1 className="text-3xl font-bold text-gray-900">Семейный бюджет</h1>
            <p className="text-gray-600 mt-2">Управление семьей и совместными финансами</p>
          </div>
          {!currentFamily && (
            <Dialog open={isCreateFamilyOpen} onOpenChange={setIsCreateFamilyOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Создать семью
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Создать семью</DialogTitle>
                  <DialogDescription>Создайте семью для совместного управления бюджетом</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateFamily} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Название семьи</Label>
                    <Input id="name" name="name" placeholder="Например: Семья Ивановых" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Описание (необязательно)</Label>
                    <Textarea id="description" name="description" placeholder="Краткое описание семьи" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Создание..." : "Создать"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsCreateFamilyOpen(false)}>
                      Отмена
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
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
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет активной семьи</h3>
              <p className="text-gray-500 mb-6">
                Создайте семью или присоединитесь к существующей для совместного управления бюджетом
              </p>
              <Button onClick={() => setIsCreateFamilyOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Создать семью
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="members">Участники</TabsTrigger>
              <TabsTrigger value="invitations">Приглашения</TabsTrigger>
              <TabsTrigger value="notifications">Уведомления</TabsTrigger>
            </TabsList>

            {/* Обзор семьи */}
            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="mr-2 h-5 w-5" />
                    {currentFamily.name}
                  </CardTitle>
                  <CardDescription>{currentFamily.description || "Семейный бюджет"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{familyMembers.length}</div>
                      <p className="text-sm text-gray-500">Участников</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{invitations.length}</div>
                      <p className="text-sm text-gray-500">Активных приглашений</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{phoneNumbers.length}</div>
                      <p className="text-sm text-gray-500">Номеров для уведомлений</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Участники семьи */}
            <TabsContent value="members">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Участники семьи</CardTitle>
                      <CardDescription>Управление участниками семейного бюджета</CardDescription>
                    </div>
                    {isAdmin && (
                      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Пригласить
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Пригласить в семью</DialogTitle>
                            <DialogDescription>Отправьте приглашение новому участнику</DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleInviteMember} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="email">Email</Label>
                              <Input id="email" name="email" type="email" placeholder="user@example.com" required />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="displayName">Имя для отображения</Label>
                              <Input id="displayName" name="displayName" placeholder="Например: Мама, Папа" required />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="role">Роль</Label>
                              <select id="role" name="role" className="w-full p-2 border rounded-md">
                                <option value="member">Участник</option>
                                <option value="admin">Администратор</option>
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <Button type="submit" disabled={saving}>
                                {saving ? "Отправка..." : "Создать приглашение"}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                                Отмена
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {familyMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            {member.role === "admin" ? (
                              <Crown className="h-5 w-5 text-blue-600" />
                            ) : (
                              <User className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{member.display_name}</p>
                            <p className="text-sm text-gray-500">{member.email}</p>
                            <p className="text-xs text-gray-400">
                              Присоединился: {new Date(member.joined_at).toLocaleDateString("ru-RU")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                            {member.role === "admin" ? "Администратор" : "Участник"}
                          </Badge>
                          {isAdmin && member.user_id !== currentUser?.id && (
                            <Button size="sm" variant="outline" onClick={() => removeMember(member.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Приглашения */}
            <TabsContent value="invitations">
              <Card>
                <CardHeader>
                  <CardTitle>Активные приглашения</CardTitle>
                  <CardDescription>Отправленные приглашения в семью</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {invitations.map((invitation) => (
                      <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{invitation.display_name}</p>
                          <p className="text-sm text-gray-500">{invitation.email}</p>
                          <p className="text-xs text-gray-400">
                            Истекает: {new Date(invitation.expires_at).toLocaleDateString("ru-RU")}
                          </p>
                          <p className="text-xs text-gray-400">
                            Код: <span className="font-mono">{invitation.invitation_code}</span>
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">Ожидает</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyInvitationLink(invitation)}
                            disabled={!invitation.invitation_token}
                          >
                            {copiedCode === invitation.id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendEmail(invitation.id)}
                            disabled={sendingEmail === invitation.id}
                          >
                            {sendingEmail === invitation.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            ) : (
                              <>
                                <Mail className="h-4 w-4 mr-1" />
                                <Send className="h-4 w-4" />
                              </>
                            )}
                          </Button>
                          {isAdmin && (
                            <Button size="sm" variant="outline" onClick={() => removeInvitation(invitation.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {invitations.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p>Нет активных приглашений</p>
                        {isAdmin && (
                          <p className="text-sm mt-2">
                            Нажмите "Пригласить" на вкладке "Участники" чтобы добавить новых членов семьи
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Уведомления */}
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Номера для уведомлений</CardTitle>
                      <CardDescription>SMS уведомления о тратах семьи</CardDescription>
                    </div>
                    <Dialog open={isPhoneOpen} onOpenChange={setIsPhoneOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Phone className="mr-2 h-4 w-4" />
                          Добавить номер
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Добавить номер телефона</DialogTitle>
                          <DialogDescription>Добавьте номер для получения SMS уведомлений</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddPhone} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="phoneNumber">Номер телефона</Label>
                            <Input
                              id="phoneNumber"
                              name="phoneNumber"
                              type="tel"
                              placeholder="+7 (999) 123-45-67"
                              required
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <input type="checkbox" id="isPrimary" name="isPrimary" />
                            <Label htmlFor="isPrimary">Основной номер</Label>
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" disabled={saving}>
                              {saving ? "Добавление..." : "Добавить"}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsPhoneOpen(false)}>
                              Отмена
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {phoneNumbers.map((phone) => (
                      <div key={phone.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Phone className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-medium">{phone.phone_number}</p>
                            <p className="text-sm text-gray-500">{phone.display_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {phone.is_primary && <Badge>Основной</Badge>}
                          <Badge variant={phone.notifications_enabled ? "default" : "secondary"}>
                            {phone.notifications_enabled ? "Включены" : "Отключены"}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => removePhone(phone.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {phoneNumbers.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p>Нет добавленных номеров</p>
                        <p className="text-sm mt-2">
                          Добавьте номера телефонов для получения SMS уведомлений о тратах семьи
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
