"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ArrowLeft, Plus, Edit, Trash2, TrendingUp, TrendingDown } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Category {
  id: string
  name: string
  type: "income" | "expense"
  created_at: string
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
    loadCategories()
  }, [])

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth")
    }
  }

  const loadCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("type", { ascending: true })
      .order("name", { ascending: true })

    if (data) {
      setCategories(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const type = formData.get("type") as "income" | "expense"

    if (!name || !type) {
      setError("Пожалуйста, заполните все поля")
      setLoading(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError("Пользователь не авторизован")
      setLoading(false)
      return
    }

    if (editingCategory) {
      // Обновление категории
      const { error: updateError } = await supabase
        .from("categories")
        .update({ name, type })
        .eq("id", editingCategory.id)

      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess("Категория успешно обновлена!")
        setEditingCategory(null)
        setIsDialogOpen(false)
        loadCategories()
      }
    } else {
      // Создание новой категории
      const { error: insertError } = await supabase.from("categories").insert([{ user_id: user.id, name, type }])

      if (insertError) {
        setError(insertError.message)
      } else {
        setSuccess("Категория успешно создана!")
        setIsDialogOpen(false)
        loadCategories()
      }
    }

    setLoading(false)
  }

  const handleDelete = async (categoryId: string) => {
    if (!confirm("Вы уверены, что хотите удалить эту категорию?")) {
      return
    }

    const { error } = await supabase.from("categories").delete().eq("id", categoryId)

    if (error) {
      setError(error.message)
    } else {
      setSuccess("Категория успешно удалена!")
      loadCategories()
    }
  }

  const openEditDialog = (category: Category) => {
    setEditingCategory(category)
    setIsDialogOpen(true)
  }

  const openCreateDialog = () => {
    setEditingCategory(null)
    setIsDialogOpen(true)
  }

  // Создание предустановленных категорий
  const createDefaultCategories = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const defaultCategories = [
      // Расходы
      { name: "Продукты", type: "expense" as const },
      { name: "Транспорт", type: "expense" as const },
      { name: "Жильё", type: "expense" as const },
      { name: "Развлечения", type: "expense" as const },
      { name: "Здоровье", type: "expense" as const },
      { name: "Одежда", type: "expense" as const },
      { name: "Образование", type: "expense" as const },
      // Доходы
      { name: "Зарплата", type: "income" as const },
      { name: "Фриланс", type: "income" as const },
      { name: "Инвестиции", type: "income" as const },
      { name: "Подарки", type: "income" as const },
    ]

    const categoriesWithUserId = defaultCategories.map((cat) => ({
      ...cat,
      user_id: user.id,
    }))

    const { error } = await supabase.from("categories").insert(categoriesWithUserId)

    if (!error) {
      setSuccess("Предустановленные категории добавлены!")
      loadCategories()
    }
  }

  const incomeCategories = categories.filter((cat) => cat.type === "income")
  const expenseCategories = categories.filter((cat) => cat.type === "expense")

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к дашборду
          </Link>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Управление категориями</h1>
            <p className="text-gray-600 mt-2">Создавайте и редактируйте категории для ваших транзакций</p>
          </div>
          <div className="flex gap-2">
            {categories.length === 0 && (
              <Button onClick={createDefaultCategories} variant="outline">
                Добавить стандартные
              </Button>
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Новая категория
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? "Редактировать категорию" : "Создать категорию"}</DialogTitle>
                  <DialogDescription>
                    {editingCategory
                      ? "Измените данные категории"
                      : "Добавьте новую категорию для классификации ваших транзакций"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Название категории</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Например: Продукты"
                      defaultValue={editingCategory?.name || ""}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Тип</Label>
                    <Select name="type" defaultValue={editingCategory?.type || "expense"} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Доход</SelectItem>
                        <SelectItem value="expense">Расход</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Сохранение..." : editingCategory ? "Обновить" : "Создать"}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Категории доходов */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-green-600" />
                Категории доходов
              </CardTitle>
              <CardDescription>Категории для классификации ваших доходов</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {incomeCategories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-gray-500">
                        Создано: {new Date(category.created_at).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(category)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(category.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {incomeCategories.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>Нет категорий доходов</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Категории расходов */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingDown className="mr-2 h-5 w-5 text-red-600" />
                Категории расходов
              </CardTitle>
              <CardDescription>Категории для классификации ваших расходов</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expenseCategories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-gray-500">
                        Создано: {new Date(category.created_at).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(category)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(category.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {expenseCategories.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>Нет категорий расходов</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
