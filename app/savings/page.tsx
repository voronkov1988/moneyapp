"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  PiggyBank,
  Plus,
  Target,
  TrendingUp,
  Calendar,
  DollarSign,
  Settings,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface SavingsGoal {
  id: string
  title: string
  target_amount: number
  monthly_target: number
  current_amount: number
  target_date?: string
  is_active: boolean
  created_at: string
}

interface SavingsTransaction {
  id: string
  savings_goal_id: string
  amount: number
  type: "deposit" | "withdrawal"
  description?: string
  date: string
}

interface BudgetSettings {
  monthly_income_target: number
  fixed_expenses: number
  emergency_buffer: number
}

export default function SavingsPage() {
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([])
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>({
    monthly_income_target: 0,
    fixed_expenses: 0,
    emergency_buffer: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null)
  const [monthlyStats, setMonthlyStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    totalSaved: 0,
    dailyLimit: 0,
    daysRemaining: 0,
    isOnTrack: true,
    spentToday: 0,
    remainingBudget: 0,
    activeSavingsGoals: 0,
  })
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
    await Promise.all([loadSavingsGoals(), loadBudgetSettings(), calculateMonthlyStats()])
  }

  const loadSavingsGoals = async () => {
    const { data } = await supabase.from("savings_goals").select("*").order("created_at", { ascending: false })

    if (data) {
      setSavingsGoals(data)
    }
  }

  const loadBudgetSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("savings_budget_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!error && data) {
        setBudgetSettings({
          monthly_income_target: data.monthly_income_target || 0,
          fixed_expenses: data.fixed_expenses || 0,
          emergency_buffer: data.emergency_buffer || 0,
        })
      }
    } catch (error) {
      console.error("Error loading budget settings:", error)
    }
  }

  const calculateMonthlyStats = async () => {
    try {
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      const currentDate = new Date()
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
      const daysRemaining = daysInMonth - currentDate.getDate() + 1

      // Получаем транзакции за текущий месяц
      const { data: transactions } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`)
        .lt("date", `${currentYear}-${String(currentMonth + 2).padStart(2, "0")}-01`)

      // Получаем накопления за текущий месяц
      const { data: savingsTransactions } = await supabase
        .from("savings_transactions")
        .select("*")
        .gte("date", `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`)
        .lt("date", `${currentYear}-${String(currentMonth + 2).padStart(2, "0")}-01`)

      const totalIncome = transactions?.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0) || 0

      const totalExpenses = transactions?.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0) || 0

      const totalSaved =
        savingsTransactions?.filter((t) => t.type === "deposit").reduce((sum, t) => sum + t.amount, 0) || 0

      // Расчет дневного лимита
      const totalSavingsTarget = savingsGoals.filter((g) => g.is_active).reduce((sum, g) => sum + g.monthly_target, 0)

      const availableForSpending =
        budgetSettings.monthly_income_target -
        budgetSettings.fixed_expenses -
        totalSavingsTarget -
        budgetSettings.emergency_buffer

      // Базовый дневной лимит
      const baseDailyLimit = Math.max(0, availableForSpending / daysInMonth)

      // Расчет оставшегося дневного лимита
      const daysPassedInMonth = currentDate.getDate()
      const remainingBudget = Math.max(0, availableForSpending - totalExpenses)
      const remainingDays = daysInMonth - daysPassedInMonth + 1

      // Скорректированный дневной лимит
      const adjustedDailyLimit = remainingDays > 0 ? remainingBudget / remainingDays : 0
      const dailyLimit = Math.min(baseDailyLimit, Math.max(0, adjustedDailyLimit))

      // Расчет трат за сегодня
      const today = new Date().toISOString().split("T")[0]
      const spentToday =
        transactions?.filter((t) => t.date === today && t.type === "expense").reduce((sum, t) => sum + t.amount, 0) || 0

      // Проверка, укладывается ли в лимиты
      const dailySpentAverage = totalExpenses / (daysInMonth - daysRemaining + 1)
      const isOnTrack =
        dailySpentAverage <= dailyLimit &&
        totalSaved >= (totalSavingsTarget * (daysInMonth - daysRemaining + 1)) / daysInMonth

      setMonthlyStats({
        totalIncome,
        totalExpenses,
        totalSaved,
        dailyLimit,
        daysRemaining,
        isOnTrack,
        spentToday,
        remainingBudget,
        activeSavingsGoals: savingsGoals.filter((g) => g.is_active).length,
      })
    } catch (error) {
      console.error("Error calculating monthly stats:", error)
    }
  }

  const handleCreateGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    const formData = new FormData(e.currentTarget)
    const title = formData.get("title") as string
    const targetAmount = Number.parseFloat(formData.get("targetAmount") as string)
    const monthlyTarget = Number.parseFloat(formData.get("monthlyTarget") as string)
    const targetDate = formData.get("targetDate") as string

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error: insertError } = await supabase.from("savings_goals").insert([
      {
        user_id: user.id,
        title,
        target_amount: targetAmount,
        monthly_target: monthlyTarget,
        target_date: targetDate || null,
      },
    ])

    if (insertError) {
      setError(insertError.message)
    } else {
      setSuccess("Цель накоплений создана!")
      setIsGoalDialogOpen(false)
      loadData()
    }

    setSaving(false)
  }

  const handleSaveBudgetSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    const formData = new FormData(e.currentTarget)
    const monthlyIncomeTarget = Number.parseFloat(formData.get("monthlyIncomeTarget") as string)
    const fixedExpenses = Number.parseFloat(formData.get("fixedExpenses") as string)
    const emergencyBuffer = Number.parseFloat(formData.get("emergencyBuffer") as string)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error: upsertError } = await supabase.from("savings_budget_settings").upsert({
      user_id: user.id,
      monthly_income_target: monthlyIncomeTarget,
      fixed_expenses: fixedExpenses,
      emergency_buffer: emergencyBuffer,
    })

    if (upsertError) {
      setError(upsertError.message)
    } else {
      setSuccess("Настройки бюджета сохранены!")
      setIsSettingsDialogOpen(false)
      setBudgetSettings({
        monthly_income_target: monthlyIncomeTarget,
        fixed_expenses: fixedExpenses,
        emergency_buffer: emergencyBuffer,
      })
      calculateMonthlyStats()
    }

    setSaving(false)
  }

  const handleSavingsTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    const formData = new FormData(e.currentTarget)
    const amount = Number.parseFloat(formData.get("amount") as string)
    const type = formData.get("type") as "deposit" | "withdrawal"
    const description = formData.get("description") as string
    const date = formData.get("date") as string

    if (!selectedGoal) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error: insertError } = await supabase.from("savings_transactions").insert([
      {
        user_id: user.id,
        savings_goal_id: selectedGoal.id,
        amount,
        type,
        description,
        date,
      },
    ])

    if (insertError) {
      setError(insertError.message)
    } else {
      setSuccess(`${type === "deposit" ? "Пополнение" : "Снятие"} записано!`)
      setIsTransactionDialogOpen(false)
      setSelectedGoal(null)
      loadData()
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

  const totalSavingsTarget = savingsGoals.filter((g) => g.is_active).reduce((sum, g) => sum + g.monthly_target, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к дашборду
          </Link>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Накопления</h1>
            <p className="text-gray-600 mt-2">Управление целями накоплений и контроль бюджета</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="mr-2 h-4 w-4" />
                  Настройки бюджета
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Настройки бюджета</DialogTitle>
                  <DialogDescription>Установите параметры для расчета дневного лимита трат</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveBudgetSettings} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthlyIncomeTarget">Планируемый доход в месяц (₽)</Label>
                    <Input
                      id="monthlyIncomeTarget"
                      name="monthlyIncomeTarget"
                      type="number"
                      step="0.01"
                      defaultValue={budgetSettings.monthly_income_target}
                      placeholder="Например: 80000"
                      required
                    />
                    <p className="text-xs text-gray-500">
                      Ваш общий доход за месяц (зарплата, фриланс, инвестиции и т.д.)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fixedExpenses">Фиксированные расходы (₽)</Label>
                    <Input
                      id="fixedExpenses"
                      name="fixedExpenses"
                      type="number"
                      step="0.01"
                      defaultValue={budgetSettings.fixed_expenses}
                      placeholder="Например: 35000"
                    />
                    <p className="text-xs text-gray-500">
                      Обязательные ежемесячные платежи: аренда/ипотека, коммунальные услуги, кредиты, страховки,
                      интернет, мобильная связь, подписки
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergencyBuffer">Буферная сумма (₽)</Label>
                    <Input
                      id="emergencyBuffer"
                      name="emergencyBuffer"
                      type="number"
                      step="0.01"
                      defaultValue={budgetSettings.emergency_buffer}
                      placeholder="Например: 5000"
                    />
                    <p className="text-xs text-gray-500">
                      Резерв на непредвиденные расходы: лекарства, ремонт техники, срочные покупки, подарки
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">💡 Как это работает:</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p>
                        <strong>Доступно для трат:</strong> Доход - Фиксированные расходы - Накопления - Буфер
                      </p>
                      <p>
                        <strong>Дневной лимит:</strong> Доступная сумма ÷ дни в месяце
                      </p>
                      <p>
                        <strong>Пример:</strong> 80,000 - 35,000 - 10,000 - 5,000 = 30,000 ₽ → 1,000 ₽/день
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Сохранение..." : "Сохранить"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
                      Отмена
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Новая цель
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Создать цель накоплений</DialogTitle>
                  <DialogDescription>Установите цель и ежемесячную сумму для накоплений</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateGoal} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Название цели</Label>
                    <Input id="title" name="title" placeholder="Например: Отпуск, Новый телефон" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="targetAmount">Целевая сумма (₽)</Label>
                      <Input id="targetAmount" name="targetAmount" type="number" step="0.01" min="0" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="monthlyTarget">В месяц (₽)</Label>
                      <Input id="monthlyTarget" name="monthlyTarget" type="number" step="0.01" min="0" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetDate">Целевая дата (необязательно)</Label>
                    <Input id="targetDate" name="targetDate" type="date" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Создание..." : "Создать цель"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsGoalDialogOpen(false)}>
                      Отмена
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
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

        {/* Статистика бюджета */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Дневной лимит</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {monthlyStats.dailyLimit.toLocaleString("ru-RU")} ₽
              </div>
              <p className="text-xs text-muted-foreground">
                Потрачено сегодня: {monthlyStats.spentToday.toLocaleString("ru-RU")} ₽
              </p>
              <p className="text-xs text-muted-foreground">
                Осталось: {Math.max(0, monthlyStats.dailyLimit - monthlyStats.spentToday).toLocaleString("ru-RU")} ₽
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Накоплено</CardTitle>
              <PiggyBank className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {monthlyStats.totalSaved.toLocaleString("ru-RU")} ₽
              </div>
              <p className="text-xs text-muted-foreground">За текущий месяц</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Потрачено</CardTitle>
              <TrendingUp className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {monthlyStats.totalExpenses.toLocaleString("ru-RU")} ₽
              </div>
              <p className="text-xs text-muted-foreground">За текущий месяц</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Статус накоплений</CardTitle>
              {monthlyStats.isOnTrack ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-lg font-bold ${monthlyStats.isOnTrack ? "text-green-600" : "text-red-600"}`}>
                {monthlyStats.isOnTrack ? "По плану" : "Отклонение"}
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{monthlyStats.activeSavingsGoals} активных целей</p>
                <p>{monthlyStats.daysRemaining} дней до конца месяца</p>
                {!monthlyStats.isOnTrack && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-red-700">
                    <p className="font-medium">Причины отклонения:</p>
                    {monthlyStats.totalExpenses / (30 - monthlyStats.daysRemaining + 1) > monthlyStats.dailyLimit && (
                      <p>• Превышен дневной лимит трат</p>
                    )}
                    {monthlyStats.totalSaved <
                      (savingsGoals.filter((g) => g.is_active).reduce((sum, g) => sum + g.monthly_target, 0) *
                        (30 - monthlyStats.daysRemaining + 1)) /
                        30 && <p>• Отстаем по плану накоплений</p>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Цели накоплений */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {savingsGoals.map((goal) => {
            const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0
            const monthsToTarget =
              goal.monthly_target > 0 ? Math.ceil((goal.target_amount - goal.current_amount) / goal.monthly_target) : 0

            return (
              <Card key={goal.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center">
                        <Target className="mr-2 h-5 w-5" />
                        {goal.title}
                      </CardTitle>
                      <CardDescription>
                        {goal.current_amount.toLocaleString("ru-RU")} ₽ из {goal.target_amount.toLocaleString("ru-RU")}{" "}
                        ₽
                      </CardDescription>
                    </div>
                    <Badge variant={goal.is_active ? "default" : "secondary"}>
                      {goal.is_active ? "Активная" : "Неактивная"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Прогресс</span>
                      <span>{progress.toFixed(1)}%</span>
                    </div>
                    <Progress value={Math.min(100, progress)} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Ежемесячно</p>
                      <p className="font-medium">{goal.monthly_target.toLocaleString("ru-RU")} ₽</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Осталось месяцев</p>
                      <p className="font-medium">{monthsToTarget}</p>
                    </div>
                  </div>

                  {goal.target_date && (
                    <div className="text-sm">
                      <p className="text-gray-500">Целевая дата</p>
                      <p className="font-medium flex items-center">
                        <Calendar className="mr-1 h-4 w-4" />
                        {new Date(goal.target_date).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" onClick={() => setSelectedGoal(goal)} className="flex-1">
                          Пополнить
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Операция с накоплениями</DialogTitle>
                          <DialogDescription>
                            Пополните или снимите средства с цели "{selectedGoal?.title}"
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSavingsTransaction} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="amount">Сумма (₽)</Label>
                              <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="type">Тип операции</Label>
                              <select id="type" name="type" className="w-full p-2 border rounded-md" required>
                                <option value="deposit">Пополнение</option>
                                <option value="withdrawal">Снятие</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="description">Описание (необязательно)</Label>
                            <Textarea id="description" name="description" placeholder="Комментарий к операции" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="date">Дата</Label>
                            <Input
                              id="date"
                              name="date"
                              type="date"
                              defaultValue={new Date().toISOString().split("T")[0]}
                              required
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" disabled={saving}>
                              {saving ? "Сохранение..." : "Сохранить"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setIsTransactionDialogOpen(false)
                                setSelectedGoal(null)
                              }}
                            >
                              Отмена
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {savingsGoals.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="text-center py-12">
                <PiggyBank className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Нет целей накоплений</h3>
                <p className="text-gray-500 mb-6">
                  Создайте свою первую цель накоплений для начала планирования бюджета
                </p>
                <Button onClick={() => setIsGoalDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Создать первую цель
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
