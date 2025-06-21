"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Download, Calendar, TrendingUp, TrendingDown, PieChart } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
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
  created_at?: string
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#FFC658", "#FF7C7C"]

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState("current-month")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (transactions.length > 0) {
      // Данные уже загружены, просто фильтруем
    } else {
      loadTransactions()
    }
  }, [selectedPeriod])

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth")
      return
    }
    await loadTransactions()
    setLoading(false)
  }

  const loadTransactions = async () => {
    const { data } = await supabase.from("transactions").select("*").order("date", { ascending: true })

    if (data) {
      setTransactions(data)
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
      case "last-year":
        startDate = new Date(now.getFullYear() - 1, 0, 1)
        endDate = new Date(now.getFullYear() - 1, 11, 31)
        break
      case "last-3-months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        break
      case "last-6-months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    return transactions.filter((t) => {
      const date = new Date(t.date)
      return date >= startDate && date <= endDate
    })
  }

  const exportToCSV = () => {
    const filteredTransactions = getFilteredTransactions()
    const csvContent = [
      ["Дата", "Тип", "Категория", "Описание", "Сумма"],
      ...filteredTransactions.map((t) => [
        new Date(t.date).toLocaleDateString("ru-RU"),
        t.type === "income" ? "Доход" : "Расход",
        t.category,
        t.description,
        t.amount.toString(),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `transactions-${selectedPeriod}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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

  // Данные для графиков
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

  // Данные по месяцам
  const monthlyData = Object.entries(
    filteredTransactions.reduce(
      (acc, t) => {
        const month = new Date(t.date).toLocaleDateString("ru-RU", { year: "numeric", month: "short" })
        if (!acc[month]) {
          acc[month] = { month, income: 0, expenses: 0 }
        }
        if (t.type === "income") {
          acc[month].income += t.amount
        } else {
          acc[month].expenses += t.amount
        }
        return acc
      },
      {} as Record<string, { month: string; income: number; expenses: number }>,
    ),
  ).map(([, data]) => data)

  // Тренд по дням
  const dailyTrend = Object.entries(
    filteredTransactions.reduce(
      (acc, t) => {
        const date = new Date(t.date).toLocaleDateString("ru-RU")
        if (!acc[date]) {
          acc[date] = { date, balance: 0 }
        }
        if (t.type === "income") {
          acc[date].balance += t.amount
        } else {
          acc[date].balance -= t.amount
        }
        return acc
      },
      {} as Record<string, { date: string; balance: number }>,
    ),
  )
    .map(([, data]) => data)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Накопительный баланс
  let cumulativeBalance = 0
  const cumulativeData = dailyTrend.map((item) => {
    cumulativeBalance += item.balance
    return { ...item, cumulative: cumulativeBalance }
  })

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
            <h1 className="text-3xl font-bold text-gray-900">Отчёты и аналитика</h1>
            <p className="text-gray-600 mt-2">Детальный анализ ваших финансов</p>
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
                <SelectItem value="last-6-months">Последние 6 месяцев</SelectItem>
                <SelectItem value="current-year">Текущий год</SelectItem>
                <SelectItem value="last-year">Прошлый год</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Экспорт CSV
            </Button>
          </div>
        </div>

        {/* Статистические карточки */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Доходы</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalIncome.toLocaleString("ru-RU")} ₽</div>
              <p className="text-xs text-muted-foreground">За выбранный период</p>
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
              <Calendar className="h-4 w-4 text-blue-600" />
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
          {/* График расходов по категориям */}
          <Card>
            <CardHeader>
              <CardTitle>Расходы по категориям</CardTitle>
              <CardDescription>Распределение расходов за выбранный период</CardDescription>
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

          {/* График доходов и расходов по месяцам */}
          <Card>
            <CardHeader>
              <CardTitle>Динамика по месяцам</CardTitle>
              <CardDescription>Доходы и расходы по месяцам</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
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

        {/* Тренд баланса */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Тренд накопительного баланса</CardTitle>
            <CardDescription>Изменение вашего баланса во времени</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => `${Number(value).toLocaleString("ru-RU")} ₽`} />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.3}
                  name="Накопительный баланс"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Детальная таблица транзакций */}
        <Card>
          <CardHeader>
            <CardTitle>Детальный список транзакций</CardTitle>
            <CardDescription>Все транзакции за выбранный период</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Дата</th>
                    <th className="text-left p-2">Тип</th>
                    <th className="text-left p-2">Категория</th>
                    <th className="text-left p-2">Описание</th>
                    <th className="text-right p-2">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions
                    .sort(
                      (a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime(),
                    )
                    .map((transaction) => (
                      <tr key={transaction.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{new Date(transaction.date).toLocaleDateString("ru-RU")}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              transaction.type === "income" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {transaction.type === "income" ? "Доход" : "Расход"}
                          </span>
                        </td>
                        <td className="p-2">{transaction.category}</td>
                        <td className="p-2">{transaction.description}</td>
                        <td
                          className={`p-2 text-right font-medium ${
                            transaction.type === "income" ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {transaction.amount.toLocaleString("ru-RU")} ₽
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {filteredTransactions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>Нет транзакций за выбранный период</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
