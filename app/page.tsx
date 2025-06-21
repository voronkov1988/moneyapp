"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  PiggyBank,
  AlertTriangle,
  CheckCircle,
  Users,
  Bell,
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

interface Transaction {
  id: string
  amount: number
  type: "income" | "expense"
  category: string
  description: string
  date: string
}

interface Category {
  id: string
  name: string
  type: "income" | "expense"
  budget_limit?: number
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"]

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{ full_name?: string } | null>(null)
  const [savingsStats, setSavingsStats] = useState({
    dailyLimit: 0,
    totalSaved: 0,
    isOnTrack: true,
    activeSavingsGoals: 0,
    remainingBudget: 0,
    spentToday: 0,
    baseDailyLimit: 0,
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
    setUser(user)
    await loadData()
    setLoading(false)
  }

  const loadData = async () => {
    // Загрузка транзакций
    const { data: transactionsData } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false }) // Сортировка по времени создания
      .limit(100)

    // Загрузка категорий
    const { data: categoriesData } = await supabase.from("categories").select("*")

    // Загрузка профиля пользователя
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()

      if (profileData) {
        setProfile(profileData)
      }
    }

    if (transactionsData) setTransactions(transactionsData)
    if (categoriesData) setCategories(categoriesData)

    // Загружаем статистику накоплений после загрузки транзакций
    if (transactionsData) {
      await loadSavingsStats(transactionsData)
    }
  }

  const loadSavingsStats = async (transactionsData: Transaction[]) => {
    try {
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      const currentDate = new Date()
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

      // Загрузка целей накоплений
      const { data: savingsGoals } = await supabase.from("savings_goals").select("*").eq("is_active", true)

      // Загрузка настроек бюджета с обработкой ошибки
      const {
        data: { user },
      } = await supabase.auth.getUser()

      let budgetSettings = null
      if (user) {
        const { data, error } = await supabase
          .from("savings_budget_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle()

        if (!error) {
          budgetSettings = data
        }
      }

      // Загрузка накоплений за месяц
      const { data: savingsTransactions } = await supabase
        .from("savings_transactions")
        .select("*")
        .eq("type", "deposit")
        .gte("date", `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`)
        .lt("date", `${currentYear}-${String(currentMonth + 2).padStart(2, "0")}-01`)

      const totalSavingsTarget = savingsGoals?.reduce((sum, g) => sum + g.monthly_target, 0) || 0
      const totalSaved = savingsTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0

      const monthlyIncomeTarget = budgetSettings?.monthly_income_target || 0
      const fixedExpenses = budgetSettings?.fixed_expenses || 0
      const emergencyBuffer = budgetSettings?.emergency_buffer || 0

      const availableForSpending = monthlyIncomeTarget - fixedExpenses - totalSavingsTarget - emergencyBuffer

      // Расчет фактических расходов за текущий месяц
      const monthlyTransactions = transactionsData.filter((t) => {
        const date = new Date(t.date)
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear
      })

      const totalExpenses = monthlyTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0)

      // Базовый дневной лимит (месячный бюджет / дни в месяце)
      const baseDailyLimit = Math.max(0, availableForSpending / daysInMonth)

      // Расчет оставшегося дневного лимита
      const daysPassedInMonth = currentDate.getDate()
      const expectedSpentSoFar = baseDailyLimit * daysPassedInMonth
      const actuallySpent = totalExpenses
      const remainingBudget = Math.max(0, availableForSpending - actuallySpent)
      const remainingDays = daysInMonth - daysPassedInMonth + 1

      // Скорректированный дневной лимит на оставшиеся дни
      const adjustedDailyLimit = remainingDays > 0 ? remainingBudget / remainingDays : 0

      // Используем минимум из базового лимита и скорректированного
      const dailyLimit = Math.min(baseDailyLimit, Math.max(0, adjustedDailyLimit))

      // Проверка выполнения плана накоплений
      const expectedSaved = (totalSavingsTarget * currentDate.getDate()) / daysInMonth
      const isOnTrack =
        totalSaved >= expectedSaved && totalExpenses <= (availableForSpending * currentDate.getDate()) / daysInMonth

      // Расчет трат за сегодня
      const today = new Date().toISOString().split("T")[0]
      const todayTransactions = transactionsData.filter((t) => t.date === today && t.type === "expense")
      const spentToday = todayTransactions.reduce((sum, t) => sum + t.amount, 0)

      setSavingsStats({
        dailyLimit,
        totalSaved,
        isOnTrack,
        activeSavingsGoals: savingsGoals?.length || 0,
        remainingBudget: remainingBudget,
        spentToday: spentToday,
        baseDailyLimit: baseDailyLimit,
      })
    } catch (error) {
      console.error("Error loading savings stats:", error)
      // Устанавливаем значения по умолчанию при ошибке
      setSavingsStats({
        dailyLimit: 0,
        totalSaved: 0,
        isOnTrack: true,
        activeSavingsGoals: 0,
        remainingBudget: 0,
        spentToday: 0,
        baseDailyLimit: 0,
      })
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Расчёт статистики
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  const monthlyTransactions = transactions.filter((t) => {
    const date = new Date(t.date)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  })

  const totalIncome = monthlyTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = monthlyTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)

  const balance = totalIncome - totalExpenses

  // Данные для графиков
  const expensesByCategory = categories
    .filter((c) => c.type === "expense")
    .map((category) => {
      const amount = monthlyTransactions
        .filter((t) => t.type === "expense" && t.category === category.name)
        .reduce((sum, t) => sum + t.amount, 0)
      return {
        name: category.name,
        value: amount,
        budget: category.budget_limit || 0,
      }
    })
    .filter((item) => item.value > 0)

  // Данные для графика по дням
  const dailyData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    const dayTransactions = transactions.filter((t) => {
      const tDate = new Date(t.date)
      return tDate.toDateString() === date.toDateString()
    })

    const income = dayTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)

    const expenses = dayTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)

    return {
      date: date.getDate().toString(),
      income,
      expenses,
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <Wallet className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900">Финансовый трекер</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/profile" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
                Добро пожаловать, {profile?.full_name || user?.email}
              </Link>
              <Button variant="outline" onClick={handleSignOut}>
                Выйти
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Статистические карточки */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Доходы</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalIncome.toLocaleString("ru-RU")} ₽</div>
              <p className="text-xs text-muted-foreground">За текущий месяц</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Расходы</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totalExpenses.toLocaleString("ru-RU")} ₽</div>
              <p className="text-xs text-muted-foreground">За текущий месяц</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Баланс</CardTitle>
              <Wallet className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {balance.toLocaleString("ru-RU")} ₽
              </div>
              <p className="text-xs text-muted-foreground">Разница доходов и расходов</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Транзакции</CardTitle>
              <Target className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{monthlyTransactions.length}</div>
              <p className="text-xs text-muted-foreground">За текущий месяц</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Дневной лимит</CardTitle>
              <PiggyBank className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {savingsStats.dailyLimit.toLocaleString("ru-RU")} ₽
              </div>
              <p className="text-xs text-muted-foreground">
                Потрачено сегодня: {savingsStats.spentToday.toLocaleString("ru-RU")} ₽
              </p>
              <p className="text-xs text-muted-foreground">
                Осталось: {Math.max(0, savingsStats.dailyLimit - savingsStats.spentToday).toLocaleString("ru-RU")} ₽
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Статус накоплений</CardTitle>
              {savingsStats.isOnTrack ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-lg font-bold ${savingsStats.isOnTrack ? "text-green-600" : "text-red-600"}`}>
                {savingsStats.isOnTrack ? "По плану" : "Отклонение"}
              </div>
              <p className="text-xs text-muted-foreground">{savingsStats.activeSavingsGoals} активных целей</p>
            </CardContent>
          </Card>
        </div>

        {/* Быстрые действия */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <Link href="/transactions/add">
            <Button className="w-full h-12">
              <Plus className="mr-2 h-4 w-4" />
              Добавить транзакцию
            </Button>
          </Link>
          <Link href="/categories">
            <Button variant="outline" className="w-full h-12">
              Управление категориями
            </Button>
          </Link>
          <Link href="/budget">
            <Button variant="outline" className="w-full h-12">
              Планирование бюджета
            </Button>
          </Link>
          <Link href="/savings">
            <Button variant="outline" className="w-full h-12">
              <PiggyBank className="mr-2 h-4 w-4" />
              Накопления
            </Button>
          </Link>
          <Link href="/family">
            <Button variant="outline" className="w-full h-12">
              <Users className="mr-2 h-4 w-4" />
              Семейный бюджет
            </Button>
          </Link>
          <Link href="/notifications">
            <Button variant="outline" className="w-full h-12">
              <Bell className="mr-2 h-4 w-4" />
              Уведомления
            </Button>
          </Link>
          <Link href="/reports">
            <Button variant="outline" className="w-full h-12">
              Отчёты и аналитика
            </Button>
          </Link>
          <Link href="/profile">
            <Button variant="outline" className="w-full h-12">
              Профиль
            </Button>
          </Link>
        </div>

        {/* Графики */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* График расходов по категориям */}
          <Card>
            <CardHeader>
              <CardTitle>Расходы по категориям</CardTitle>
              <CardDescription>Распределение расходов за текущий месяц</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString("ru-RU")} ₽`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* График доходов и расходов по дням */}
          <Card>
            <CardHeader>
              <CardTitle>Динамика за 30 дней</CardTitle>
              <CardDescription>Доходы и расходы по дням</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString("ru-RU")} ₽`} />
                  <Legend />
                  <Bar dataKey="income" fill="#10B981" name="Доходы" />
                  <Bar dataKey="expenses" fill="#EF4444" name="Расходы" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Последние транзакции */}
        <Card>
          <CardHeader>
            <CardTitle>Последние транзакции</CardTitle>
            <CardDescription>Ваши недавние финансовые операции</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        transaction.type === "income" ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-gray-500">{transaction.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${transaction.type === "income" ? "text-green-600" : "text-red-600"}`}>
                      {transaction.type === "income" ? "+" : "-"}
                      {transaction.amount.toLocaleString("ru-RU")} ₽
                    </p>
                    <p className="text-sm text-gray-500">{new Date(transaction.date).toLocaleDateString("ru-RU")}</p>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>Пока нет транзакций</p>
                  <Link href="/transactions/add">
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Добавить первую транзакцию
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
