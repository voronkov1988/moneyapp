-- Создание таблицы для целей накоплений
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  target_amount DECIMAL(10,2) NOT NULL CHECK (target_amount > 0),
  monthly_target DECIMAL(10,2) NOT NULL CHECK (monthly_target > 0),
  current_amount DECIMAL(10,2) DEFAULT 0,
  target_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы для записей накоплений
CREATE TABLE IF NOT EXISTS public.savings_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  savings_goal_id UUID REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT CHECK (type IN ('deposit', 'withdrawal')) NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы для настроек бюджета накоплений
CREATE TABLE IF NOT EXISTS public.savings_budget_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  monthly_income_target DECIMAL(10,2) DEFAULT 0,
  fixed_expenses DECIMAL(10,2) DEFAULT 0, -- фиксированные расходы (жилье, кредиты и т.д.)
  emergency_buffer DECIMAL(10,2) DEFAULT 0, -- буферная сумма на непредвиденные расходы
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON public.savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_active ON public.savings_goals(is_active);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_user_id ON public.savings_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_goal_id ON public.savings_transactions(savings_goal_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_date ON public.savings_transactions(date);
CREATE INDEX IF NOT EXISTS idx_savings_budget_settings_user_id ON public.savings_budget_settings(user_id);

-- RLS политики
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_budget_settings ENABLE ROW LEVEL SECURITY;

-- Политики для savings_goals
CREATE POLICY "Users can manage own savings goals" ON public.savings_goals
  FOR ALL USING (auth.uid() = user_id);

-- Политики для savings_transactions
CREATE POLICY "Users can manage own savings transactions" ON public.savings_transactions
  FOR ALL USING (auth.uid() = user_id);

-- Политики для savings_budget_settings
CREATE POLICY "Users can manage own savings budget settings" ON public.savings_budget_settings
  FOR ALL USING (auth.uid() = user_id);

-- Триггеры для обновления updated_at
CREATE TRIGGER handle_updated_at_savings_goals
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_savings_budget_settings
  BEFORE UPDATE ON public.savings_budget_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Функция для обновления текущей суммы накоплений
CREATE OR REPLACE FUNCTION update_savings_goal_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.savings_goals 
  SET current_amount = (
    SELECT COALESCE(SUM(
      CASE 
        WHEN type = 'deposit' THEN amount 
        WHEN type = 'withdrawal' THEN -amount 
        ELSE 0 
      END
    ), 0)
    FROM public.savings_transactions 
    WHERE savings_goal_id = COALESCE(NEW.savings_goal_id, OLD.savings_goal_id)
  )
  WHERE id = COALESCE(NEW.savings_goal_id, OLD.savings_goal_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления суммы накоплений
CREATE TRIGGER update_savings_amount_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION update_savings_goal_amount();
