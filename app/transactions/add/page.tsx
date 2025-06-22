"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Plus, TrendingUp, TrendingDown } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Category {
  id: string
  name: string
  type: "income" | "expense"
}

export default function AddTransactionPage() {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [transactionType, setTransactionType] = useState<"income" | "expense">("expense")
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
    const { data } = await supabase.from("categories").select("*").order("name")

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
    const amount = Number.parseFloat(formData.get("amount") as string)
    const category = formData.get("category") as string
    const description = formData.get("description") as string
    const date = formData.get("date") as string

    if (!amount || !category || !description || !date) {
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
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

    const { error: insertError } = await supabase.from("transactions").insert([
      {
        user_id: user.id,
        amount,
        type: transactionType,
        category,
        description,
        date,
      },
    ])

    if (insertError) {
      setError(insertError.message)
    } else {
      setSuccess("Транзакция успешно добавлена!")

      // Автоматически отправляем Telegram уведомления
      const message = `Новая транзакция добавлена - 
                          Сумма: ${amount} ₽
                          Тип: ${transactionType === "income" ? "Доход" : "Расход"}
                          Категория: ${category}
                          Описание: ${description}
                          Дата: ${date}
                        `


      const telegramResponse = await fetch("/api/sendTelegramMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, profile }),
      })

    // const telegramResponse = await fetch("https://api.telegram.org/bot<token>/sendMessage", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({ message, profile }),
    //   })

      setTimeout(() => {
        router.push("/")
      }, 2000)
    }
    setLoading(false)
  }

  const filteredCategories = categories.filter((cat) => cat.type === transactionType)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к дашборду
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="mr-2 h-5 w-5" />
              Добавить транзакцию
            </CardTitle>
            <CardDescription>Добавьте новый доход или расход в ваш финансовый трекер</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Тип транзакции */}
              <div className="space-y-3">
                <Label>Тип транзакции</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant={transactionType === "income" ? "default" : "outline"}
                    className="h-12"
                    onClick={() => setTransactionType("income")}
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Доход
                  </Button>
                  <Button
                    type="button"
                    variant={transactionType === "expense" ? "default" : "outline"}
                    className="h-12"
                    onClick={() => setTransactionType("expense")}
                  >
                    <TrendingDown className="mr-2 h-4 w-4" />
                    Расход
                  </Button>
                </div>
              </div>

              {/* Сумма */}
              <div className="space-y-2">
                <Label htmlFor="amount">Сумма (₽)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="0.00" required />
              </div>

              {/* Категория */}
              <div className="space-y-2">
                <Label htmlFor="category">Категория</Label>
                <Select name="category" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filteredCategories.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Нет доступных категорий для типа "{transactionType === "income" ? "доход" : "расход"}".{" "}
                    <Link href="/categories" className="text-primary hover:underline">
                      Создать категорию
                    </Link>
                  </p>
                )}
              </div>

              {/* Описание */}
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Краткое описание транзакции"
                  rows={3}
                  required
                />
              </div>

              {/* Дата */}
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

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-4">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Добавление..." : "Добавить транзакцию"}
                </Button>
                <Link href="/">
                  <Button type="button" variant="outline">
                    Отмена
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
