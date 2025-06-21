"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Download, Check, X, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface ImportedTransaction {
  id: string
  bank_transaction_id: string
  amount: number
  type: "income" | "expense"
  merchant: string
  description: string
  date: string
  category_suggested: string
  processed: boolean
  created_at: string
}

export default function ImportPage() {
  const [importedTransactions, setImportedTransactions] = useState<ImportedTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
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
    await loadImportedTransactions()
    setLoading(false)
  }

  const loadImportedTransactions = async () => {
    const { data } = await supabase
      .from("imported_transactions")
      .select("*")
      .eq("processed", false)
      .order("created_at", { ascending: false })

    if (data) {
      setImportedTransactions(data)
    }
  }

  const processTransaction = async (transaction: ImportedTransaction, approve: boolean) => {
    setProcessing(true)
    setError("")

    if (approve) {
      // Добавляем транзакцию в основную таблицу
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error: insertError } = await supabase.from("transactions").insert([
        {
          user_id: user.id,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category_suggested,
          description: transaction.description,
          date: transaction.date,
        },
      ])

      if (insertError) {
        setError(insertError.message)
        setProcessing(false)
        return
      }
    }

    // Помечаем как обработанную
    const { error: updateError } = await supabase
      .from("imported_transactions")
      .update({ processed: true })
      .eq("id", transaction.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(approve ? "Транзакция добавлена!" : "Транзакция отклонена!")
      // Удаляем из списка
      setImportedTransactions((prev) => prev.filter((t) => t.id !== transaction.id))
    }

    setProcessing(false)
  }

  const processAllTransactions = async (approve: boolean) => {
    setProcessing(true)
    setError("")

    for (const transaction of importedTransactions) {
      await processTransaction(transaction, approve)
    }

    setSuccess(`Все транзакции ${approve ? "добавлены" : "отклонены"}!`)
    setProcessing(false)
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

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Импорт транзакций</h1>
            <p className="text-gray-600 mt-2">Обработка автоматически импортированных транзакций</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadImportedTransactions} variant="outline" disabled={processing}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Обновить
            </Button>
            {importedTransactions.length > 0 && (
              <>
                <Button onClick={() => processAllTransactions(true)} disabled={processing} variant="default">
                  Принять все
                </Button>
                <Button onClick={() => processAllTransactions(false)} disabled={processing} variant="destructive">
                  Отклонить все
                </Button>
              </>
            )}
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

        {importedTransactions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Download className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет новых транзакций</h3>
              <p className="text-gray-500 mb-6">
                Автоматически импортированные транзакции будут отображаться здесь для подтверждения.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <h4 className="font-medium text-blue-900 mb-2">🚀 Автоматический импорт</h4>
                <p className="text-blue-800 text-sm">
                  Подключите банковский аккаунт в настройках профиля для автоматического импорта транзакций.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {importedTransactions.map((transaction) => (
              <Card key={transaction.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={transaction.type === "income" ? "default" : "destructive"}>
                          {transaction.type === "income" ? "Доход" : "Расход"}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {new Date(transaction.date).toLocaleDateString("ru-RU")}
                        </span>
                        <span className="text-sm text-gray-500">
                          Импортировано: {new Date(transaction.created_at).toLocaleDateString("ru-RU")}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Описание</p>
                          <p className="text-gray-900">{transaction.description}</p>
                          {transaction.merchant && (
                            <p className="text-sm text-gray-500">Мерчант: {transaction.merchant}</p>
                          )}
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-700">Сумма</p>
                          <p
                            className={`text-lg font-bold ${
                              transaction.type === "income" ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {transaction.type === "income" ? "+" : "-"}
                            {transaction.amount.toLocaleString("ru-RU")} ₽
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-700">Предложенная категория</p>
                          <Badge variant="outline">{transaction.category_suggested}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button size="sm" onClick={() => processTransaction(transaction, true)} disabled={processing}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => processTransaction(transaction, false)}
                        disabled={processing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
