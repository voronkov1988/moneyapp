"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Target, Edit, AlertTriangle, CheckCircle } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Category {
  id: string
  name: string
  type: "income" | "expense"
  budget_limit?: number
}

interface BudgetData {
  category: string
  budgetLimit: number
  spent: number
  remaining: number
  percentage: number
}

export default function BudgetPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [budgetData, setBudgetData] = useState<BudgetData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
    loadData()
  }, [])

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth")
    }
  }

  const loadData = async () => {
    // Загрузка категорий расходов
    const { data: categoriesData } = await supabase.from("categories").select("*").eq("type", "expense").order("name")

    if (categoriesData) {
      setCategories(categoriesData)
      await calculateBudgetData(categoriesData)
    }
  }

  const calculateBudgetData = async (categories: Category[]) => {
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()

    // Получение транзакций за текущий месяц
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("type", "expense")
      .gte("date", `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`)
      .lt("date", `${currentYear}-${String(currentMonth + 2).padStart(2, "0")}-01`)

    const budgetData: BudgetData[] = categories
      .filter((cat) => cat.budget_limit && cat.budget_limit > 0)
      .map((category) => {
        const spent =
          transactions?.filter((t) => t.category === category.name).reduce((sum, t) => sum + t.amount, 0) || 0

        const budgetLimit = category.budget_limit || 0
        const remaining = budgetLimit - spent // Убираем Math.max, чтобы показать отрицательные значения
        const percentage = budgetLimit > 0 ? (spent / budgetLimit) * 100 : 0

        return {
          category: category.name,
          budgetLimit,
          spent,
          remaining,
          percentage,
        }
      })

    setBudgetData(budgetData)
  }

  const handleSetBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    const formData = new FormData(e.currentTarget)
    const budgetLimit = Number.parseFloat(formData.get("budgetLimit") as string)

    if (!budgetLimit || budgetLimit <= 0) {
      setError("Пожалуйста, введите корректную сумму бюджета")
      setLoading(false)
      return
    }

    if (!editingCategory) {
      setError("Категория не выбрана")
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from("categories")
      .update({ budget_limit: budgetLimit })
      .eq("id", editingCategory.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess("Бюджет успешно установлен!")
      setIsDialogOpen(false)
      setEditingCategory(null)
      loadData()
    }

    setLoading(false)
  }

  const openBudgetDialog = (category: Category) => {
    setEditingCategory(category)
    setIsDialogOpen(true)
  }

  const getBudgetStatus = (spent: number, budgetLimit: number) => {
    if (spent > budgetLimit) {
      return { color: "text-red-600", icon: AlertTriangle, text: "Превышен" }
    }
    if (spent === budgetLimit) {
      return { color: "text-orange-600", icon: AlertTriangle, text: "Достигнут лимит" }
    }
    if (spent >= budgetLimit * 0.8) {
      // 80% и выше от лимита
      return { color: "text-yellow-600", icon: AlertTriangle, text: "Близко к лимиту" }
    }
    return { color: "text-green-600", icon: CheckCircle, text: "В пределах нормы" }
  }

  const totalBudget = budgetData.reduce((sum, item) => sum + item.budgetLimit, 0)
  const totalSpent = budgetData.reduce((sum, item) => sum + item.spent, 0)
  const totalRemaining = totalBudget - totalSpent

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к дашборду
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Планирование бюджета</h1>
          <p className="text-gray-600 mt-2">Установите лимиты расходов по категориям и отслеживайте их выполнение</p>
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

        {/* Общая статистика */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Общий бюджет</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{totalBudget.toLocaleString("ru-RU")} ₽</div>
              <p className="text-sm text-gray-500">На текущий месяц</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Потрачено</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totalSpent.toLocaleString("ru-RU")} ₽</div>
              <p className="text-sm text-gray-500">
                {totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(1)}% от бюджета` : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Остаток</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalRemaining >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalRemaining.toLocaleString("ru-RU")} ₽
              </div>
              <p className="text-sm text-gray-500">До конца месяца</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Бюджеты по категориям */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="mr-2 h-5 w-5" />
                Бюджеты по категориям
              </CardTitle>
              <CardDescription>Отслеживание расходов по установленным лимитам</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budgetData.map((item) => {
                  const status = getBudgetStatus(item.spent, item.budgetLimit)
                  const StatusIcon = status.icon

                  return (
                    <div key={item.category} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">{item.category}</h3>
                        <div className={`flex items-center text-sm ${status.color}`}>
                          <StatusIcon className="mr-1 h-4 w-4" />
                          {status.text}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Progress value={Math.min(100, item.percentage)} className="h-2" />
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Потрачено: {item.spent.toLocaleString("ru-RU")} ₽</span>
                          <span>Лимит: {item.budgetLimit.toLocaleString("ru-RU")} ₽</span>
                        </div>
                        <div className="text-sm">
                          <span className={item.remaining >= 0 ? "text-green-600" : "text-red-600"}>
                            {item.remaining >= 0 ? "Остаток" : "Превышение"}:{" "}
                            {Math.abs(item.remaining).toLocaleString("ru-RU")} ₽
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {budgetData.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>Нет установленных бюджетов</p>
                    <p className="text-sm">Установите лимиты для категорий расходов</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Управление бюджетами */}
          <Card>
            <CardHeader>
              <CardTitle>Управление бюджетами</CardTitle>
              <CardDescription>Установите или измените лимиты расходов по категориям</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-gray-500">
                        {category.budget_limit
                          ? `Лимит: ${category.budget_limit.toLocaleString("ru-RU")} ₽`
                          : "Лимит не установлен"}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openBudgetDialog(category)}>
                      <Edit className="mr-2 h-4 w-4" />
                      {category.budget_limit ? "Изменить" : "Установить"}
                    </Button>
                  </div>
                ))}

                {categories.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>Нет категорий расходов</p>
                    <Link href="/categories">
                      <Button className="mt-4">Создать категории</Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Диалог установки бюджета */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Установить бюджет для категории "{editingCategory?.name}"</DialogTitle>
              <DialogDescription>
                Укажите максимальную сумму, которую вы планируете тратить по этой категории в месяц
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSetBudget} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="budgetLimit">Месячный лимит (₽)</Label>
                <Input
                  id="budgetLimit"
                  name="budgetLimit"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  defaultValue={editingCategory?.budget_limit || ""}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Сохранение..." : "Сохранить"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
