"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Users, User, TrendingUp, TrendingDown, PieChart } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts"

interface Transaction {
  id: string
  amount: number
  type: "income" | "expense"
  category: string
  description: string
  date: string
  created_by: string
  user_id: string
}

interface FamilyMember {
  id: string
  user_id: string
  display_name: string
  role: string
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"]

export default function FamilyStatsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [selectedMember, setSelectedMember] = useState<string>("all")
  const [selectedPeriod, setSelectedPeriod] = useState("current-month")
  const [loading, setLoading] = useState(true)
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
    // Загружаем текущую семью
    const { data: profile } = await supabase.from("profiles").select("current_family_id").single()

    if (!profile?.current_family_id) {
      router.push("/family")
      return
    }

    // Загружаем участников семьи
    const { data: members } = await supabase
      .from("family_members")
      .select("*")
      .eq("family_id", profile.current_family_id)
      .eq("is_active", true)

    if (members) {
      setFamilyMembers(members)
    }

    // Загружаем транзакции семьи
    const { data: familyTransactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("family_id", profile.current_family_id)
      .order("date", { ascending: false })

    if (familyTransactions) {
      setTransactions(familyTransactions)
    }
  }

  const getFilteredTransactions = () => {
    const now = new Date()
    let startDate: Date
    let endDate = new Date()

    switch (selectedPeriod) {
      case "current-month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case "last-month":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case "current-year":
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case "last-3-months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    let filtered = transactions.filter((t) => {
      const date = new Date(t.date)
      return date >= startDate && date <= endDate
    })

    if (selectedMember !== "all") {
      filtered = filtered.filter((t) => t.created_by === selectedMember)
    }

    return filtered
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  const filteredTransactions = getFilteredTransactions()
  const totalIncome = filteredTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = filteredTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)
  const balance = totalIncome - totalExpenses

  // Статистика по участникам
  const memberStats = familyMembers.map((member) => {
    const memberTransactions = filteredTransactions.filter((t) => t.created_by === member.user_id)
    const memberIncome = memberTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
    const memberExpenses = memberTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)

    return {
      name: member.display_name,
      income: memberIncome,
      expenses: memberExpenses,
      balance: memberIncome - memberExpenses,
      transactions: memberTransactions.length,
    }
  })

  // Данные для графика расходов по категориям
  const categoryData = Object.entries(
    filteredTransactions.reduce(
      (acc, t) => {
        if (t.type === "expense") {
          acc[t.category] = (acc[t.category] || 0) + t.amount
        }
        return acc
      },
      {} as Record<string, number>,
    ),
  ).map(([name, value]) => ({ name, value }))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/family" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к семье
          </Link>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Семейная статистика</h1>
            <p className="text-gray-600 mt-2">Анализ расходов и доходов семьи</p>
          </div>
          <div className="flex gap-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current-month">Текущий месяц</SelectItem>
                <SelectItem value="last-month">Прошлый месяц</SelectItem>
                <SelectItem value="last-3-months">Последние 3 месяца</SelectItem>
                <SelectItem value="current-year">Текущий год</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Вся семья</SelectItem>
                {familyMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Общая статистика */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Доходы</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalIncome.toLocaleString("ru-RU")} ₽</div>
              <p className="text-xs text-muted-foreground">
                {selectedMember === "all"
                  ? "Семья"
                  : familyMembers.find((m) => m.user_id === selectedMember)?.display_name}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Расходы</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totalExpenses.toLocaleString("ru-RU")} ₽</div>
              <p className="text-xs text-muted-foreground">За выбранный период</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Баланс</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
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
              <PieChart className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{filteredTransactions.length}</div>
              <p className="text-xs text-muted-foreground">За выбранный период</p>
            </CardContent>
          </Card>
        </div>

        {/* Графики */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Статистика по участникам */}
          <Card>
            <CardHeader>
              <CardTitle>Статистика по участникам</CardTitle>
              <CardDescription>Доходы и расходы каждого участника семьи</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={memberStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString("ru-RU")} ₽`} />
                  <Legend />
                  <Bar dataKey="income" fill="#10B981" name="Доходы" />
                  <Bar dataKey="expenses" fill="#EF4444" name="Расходы" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Расходы по категориям */}
          <Card>
            <CardHeader>
              <CardTitle>Расходы по категориям</CardTitle>
              <CardDescription>
                {selectedMember === "all"
                  ? "Общие расходы семьи"
                  : `Расходы: ${familyMembers.find((m) => m.user_id === selectedMember)?.display_name}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString("ru-RU")} ₽`} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Детальная статистика по участникам */}
        <Card>
          <CardHeader>
            <CardTitle>Детальная статистика участников</CardTitle>
            <CardDescription>Подробная информация о финансовой активности каждого участника</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {memberStats.map((member, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium">{member.name}</h3>
                        <p className="text-sm text-gray-500">{member.transactions} транзакций</p>
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${member.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {member.balance.toLocaleString("ru-RU")} ₽
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Доходы</p>
                      <p className="font-medium text-green-600">{member.income.toLocaleString("ru-RU")} ₽</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Расходы</p>
                      <p className="font-medium text-red-600">{member.expenses.toLocaleString("ru-RU")} ₽</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Баланс</p>
                      <p className={`font-medium ${member.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {member.balance.toLocaleString("ru-RU")} ₽
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
