-- -- Создание таблицы семей
-- CREATE TABLE IF NOT EXISTS public.families (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   name TEXT NOT NULL,
--   description TEXT,
--   created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- -- Создание таблицы членов семьи
-- CREATE TABLE IF NOT EXISTS public.family_members (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   family_id UUID REFERENCES public.families(id) ON DELETE CASCADE NOT NULL,
--   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
--   role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
--   display_name TEXT NOT NULL, -- Имя для отображения в семье
--   joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   is_active BOOLEAN DEFAULT true,
--   UNIQUE(family_id, user_id)
-- );

-- -- Создание таблицы приглашений в семью
-- CREATE TABLE IF NOT EXISTS public.family_invitations (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   family_id UUID REFERENCES public.families(id) ON DELETE CASCADE NOT NULL,
--   invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
--   email TEXT NOT NULL,
--   display_name TEXT NOT NULL,
--   role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
--   status TEXT CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
--   invitation_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
--   expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   responded_at TIMESTAMP WITH TIME ZONE
-- );

-- -- Обновление таблицы профилей для поддержки семейного функционала
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_family_id UUID REFERENCES public.families(id);
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- -- Обновление таблицы транзакций для отслеживания автора
-- ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
-- ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id);

-- -- Обновление таблицы категорий для семейного использования
-- ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id);
-- ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- -- Обновление таблицы целей накоплений для семейного использования
-- ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id);
-- ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- -- Обновление таблицы настроек бюджета для семейного использования
-- ALTER TABLE public.savings_budget_settings ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id);

-- -- Создание таблицы для множественных номеров телефонов
-- CREATE TABLE IF NOT EXISTS public.family_phone_numbers (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   family_id UUID REFERENCES public.families(id) ON DELETE CASCADE NOT NULL,
--   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
--   phone_number TEXT NOT NULL,
--   is_primary BOOLEAN DEFAULT false,
--   notifications_enabled BOOLEAN DEFAULT true,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   UNIQUE(family_id, phone_number)
-- );

-- -- Индексы для оптимизации
-- CREATE INDEX IF NOT EXISTS idx_families_created_by ON public.families(created_by);
-- CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON public.family_members(family_id);
-- CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members(user_id);
-- CREATE INDEX IF NOT EXISTS idx_family_invitations_family_id ON public.family_invitations(family_id);
-- CREATE INDEX IF NOT EXISTS idx_family_invitations_email ON public.family_invitations(email);
-- CREATE INDEX IF NOT EXISTS idx_family_invitations_code ON public.family_invitations(invitation_code);
-- CREATE INDEX IF NOT EXISTS idx_transactions_family_id ON public.transactions(family_id);
-- CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions(created_by);
-- CREATE INDEX IF NOT EXISTS idx_categories_family_id ON public.categories(family_id);
-- CREATE INDEX IF NOT EXISTS idx_savings_goals_family_id ON public.savings_goals(family_id);
-- CREATE INDEX IF NOT EXISTS idx_family_phone_numbers_family_id ON public.family_phone_numbers(family_id);

-- -- RLS политики
-- ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.family_phone_numbers ENABLE ROW LEVEL SECURITY;

-- -- Политики для families
-- CREATE POLICY "Users can view families they belong to" ON public.families
--   FOR SELECT USING (
--     id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND is_active = true
--     )
--   );

-- CREATE POLICY "Users can create families" ON public.families
--   FOR INSERT WITH CHECK (auth.uid() = created_by);

-- CREATE POLICY "Family admins can update families" ON public.families
--   FOR UPDATE USING (
--     id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
--     )
--   );

-- -- Политики для family_members
-- CREATE POLICY "Users can view family members of their families" ON public.family_members
--   FOR SELECT USING (
--     family_id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND is_active = true
--     )
--   );

-- CREATE POLICY "Family admins can manage members" ON public.family_members
--   FOR ALL USING (
--     family_id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
--     )
--   );

-- -- Политики для family_invitations
-- CREATE POLICY "Users can view invitations for their families" ON public.family_invitations
--   FOR SELECT USING (
--     family_id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
--     )
--     OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
--   );

-- CREATE POLICY "Family admins can manage invitations" ON public.family_invitations
--   FOR ALL USING (
--     family_id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
--     )
--   );

-- -- Политики для family_phone_numbers
-- CREATE POLICY "Users can manage family phone numbers" ON public.family_phone_numbers
--   FOR ALL USING (
--     family_id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND is_active = true
--     )
--   );

-- -- Обновление политик для существующих таблиц
-- -- Транзакции: доступ к семейным транзакциям
-- DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
-- CREATE POLICY "Users can view family transactions" ON public.transactions
--   FOR SELECT USING (
--     auth.uid() = user_id 
--     OR family_id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND is_active = true
--     )
--   );

-- DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
-- CREATE POLICY "Users can insert family transactions" ON public.transactions
--   FOR INSERT WITH CHECK (
--     auth.uid() = user_id 
--     AND (family_id IS NULL OR family_id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND is_active = true
--     ))
--   );

-- DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
-- CREATE POLICY "Users can update own transactions" ON public.transactions
--   FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = created_by);

-- DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
-- CREATE POLICY "Users can delete own transactions" ON public.transactions
--   FOR DELETE USING (auth.uid() = user_id OR auth.uid() = created_by);

-- -- Категории: доступ к семейным категориям
-- DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
-- CREATE POLICY "Users can view family categories" ON public.categories
--   FOR SELECT USING (
--     auth.uid() = user_id 
--     OR family_id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND is_active = true
--     )
--   );

-- DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
-- CREATE POLICY "Users can insert family categories" ON public.categories
--   FOR INSERT WITH CHECK (
--     auth.uid() = user_id 
--     AND (family_id IS NULL OR family_id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND is_active = true
--     ))
--   );

-- -- Цели накоплений: доступ к семейным целям
-- DROP POLICY IF EXISTS "Users can manage own savings goals" ON public.savings_goals;
-- CREATE POLICY "Users can view family savings goals" ON public.savings_goals
--   FOR SELECT USING (
--     auth.uid() = user_id 
--     OR family_id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND is_active = true
--     )
--   );

-- CREATE POLICY "Users can insert family savings goals" ON public.savings_goals
--   FOR INSERT WITH CHECK (
--     auth.uid() = user_id 
--     AND (family_id IS NULL OR family_id IN (
--       SELECT family_id FROM public.family_members 
--       WHERE user_id = auth.uid() AND is_active = true
--     ))
--   );

-- -- Триггеры для обновления updated_at
-- CREATE TRIGGER handle_updated_at_families
--   BEFORE UPDATE ON public.families
--   FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -- Функция для автоматического добавления создателя семьи как администратора
-- CREATE OR REPLACE FUNCTION public.add_family_creator_as_admin()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   INSERT INTO public.family_members (family_id, user_id, role, display_name)
--   VALUES (
--     NEW.id, 
--     NEW.created_by, 
--     'admin',
--     COALESCE(
--       (SELECT display_name FROM public.profiles WHERE id = NEW.created_by),
--       (SELECT email FROM auth.users WHERE id = NEW.created_by),
--       'Администратор'
--     )
--   );
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- -- Триггер для автоматического добавления создателя семьи
-- CREATE TRIGGER add_family_creator_trigger
--   AFTER INSERT ON public.families
--   FOR EACH ROW EXECUTE FUNCTION public.add_family_creator_as_admin();

-- -- Функция для обновления family_id в транзакциях при создании
-- CREATE OR REPLACE FUNCTION public.set_transaction_family_id()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   -- Устанавливаем family_id из профиля пользователя
--   SELECT current_family_id INTO NEW.family_id
--   FROM public.profiles 
--   WHERE id = NEW.user_id;
  
--   -- Устанавливаем created_by
--   NEW.created_by = NEW.user_id;
  
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- -- Триггер для автоматической установки family_id в транзакциях
-- CREATE TRIGGER set_transaction_family_id_trigger
--   BEFORE INSERT ON public.transactions
--   FOR EACH ROW EXECUTE FUNCTION public.set_transaction_family_id();

-- -- Функция для обновления family_id в категориях при создании
-- CREATE OR REPLACE FUNCTION public.set_category_family_id()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   -- Устанавливаем family_id из профиля пользователя
--   SELECT current_family_id INTO NEW.family_id
--   FROM public.profiles 
--   WHERE id = NEW.user_id;
  
--   -- Устанавливаем created_by
--   NEW.created_by = NEW.user_id;
  
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- -- Триггер для автоматической установки family_id в категориях
-- CREATE TRIGGER set_category_family_id_trigger
--   BEFORE INSERT ON public.categories
--   FOR EACH ROW EXECUTE FUNCTION public.set_category_family_id();



-- Удаляем проблемные политики
DROP POLICY IF EXISTS "Users can view family categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert family categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

DROP POLICY IF EXISTS "Users can view family transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert family transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

DROP POLICY IF EXISTS "Users can view family savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can insert family savings goals" ON public.savings_goals;

-- Создаем функцию для проверки членства в семье (избегаем рекурсию)
CREATE OR REPLACE FUNCTION public.is_family_member(family_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.family_members 
    WHERE family_id = family_id_param 
    AND user_id = auth.uid() 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создаем функцию для получения текущей семьи пользователя
CREATE OR REPLACE FUNCTION public.get_user_family_id()
RETURNS UUID AS $$
DECLARE
  family_id_result UUID;
BEGIN
  SELECT current_family_id INTO family_id_result
  FROM public.profiles 
  WHERE id = auth.uid();
  
  RETURN family_id_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Исправленные политики для categories
CREATE POLICY "Users can view own and family categories" ON public.categories
  FOR SELECT USING (
    auth.uid() = user_id 
    OR (family_id IS NOT NULL AND public.is_family_member(family_id))
  );

CREATE POLICY "Users can insert categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE USING (auth.uid() = user_id);

-- Исправленные политики для transactions
CREATE POLICY "Users can view own and family transactions" ON public.transactions
  FOR SELECT USING (
    auth.uid() = user_id 
    OR (family_id IS NOT NULL AND public.is_family_member(family_id))
  );

CREATE POLICY "Users can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = created_by);

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = created_by);

-- Исправленные политики для savings_goals
CREATE POLICY "Users can view own and family savings goals" ON public.savings_goals
  FOR SELECT USING (
    auth.uid() = user_id 
    OR (family_id IS NOT NULL AND public.is_family_member(family_id))
  );

CREATE POLICY "Users can insert savings goals" ON public.savings_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings goals" ON public.savings_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings goals" ON public.savings_goals
  FOR DELETE USING (auth.uid() = user_id);

-- Исправленные политики для savings_transactions
DROP POLICY IF EXISTS "Users can manage own savings transactions" ON public.savings_transactions;

CREATE POLICY "Users can view own and family savings transactions" ON public.savings_transactions
  FOR SELECT USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.savings_goals sg 
      WHERE sg.id = savings_goal_id 
      AND (sg.user_id = auth.uid() OR public.is_family_member(sg.family_id))
    )
  );

CREATE POLICY "Users can insert savings transactions" ON public.savings_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings transactions" ON public.savings_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings transactions" ON public.savings_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Исправленные политики для savings_budget_settings
DROP POLICY IF EXISTS "Users can manage own savings budget settings" ON public.savings_budget_settings;

CREATE POLICY "Users can view own and family budget settings" ON public.savings_budget_settings
  FOR SELECT USING (
    auth.uid() = user_id 
    OR (family_id IS NOT NULL AND public.is_family_member(family_id))
  );

CREATE POLICY "Users can insert budget settings" ON public.savings_budget_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget settings" ON public.savings_budget_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget settings" ON public.savings_budget_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Упрощаем политики для family_members (избегаем рекурсию)
DROP POLICY IF EXISTS "Users can view family members of their families" ON public.family_members;
DROP POLICY IF EXISTS "Family admins can manage members" ON public.family_members;

CREATE POLICY "Users can view family members" ON public.family_members
  FOR SELECT USING (
    user_id = auth.uid() 
    OR family_id IN (
      SELECT fm.family_id FROM public.family_members fm 
      WHERE fm.user_id = auth.uid() AND fm.is_active = true
    )
  );

CREATE POLICY "Users can insert family members" ON public.family_members
  FOR INSERT WITH CHECK (
    family_id IN (
      SELECT fm.family_id FROM public.family_members fm 
      WHERE fm.user_id = auth.uid() AND fm.role = 'admin' AND fm.is_active = true
    )
  );

CREATE POLICY "Admins can update family members" ON public.family_members
  FOR UPDATE USING (
    family_id IN (
      SELECT fm.family_id FROM public.family_members fm 
      WHERE fm.user_id = auth.uid() AND fm.role = 'admin' AND fm.is_active = true
    )
  );

CREATE POLICY "Admins can delete family members" ON public.family_members
  FOR DELETE USING (
    family_id IN (
      SELECT fm.family_id FROM public.family_members fm 
      WHERE fm.user_id = auth.uid() AND fm.role = 'admin' AND fm.is_active = true
    )
  );

-- Упрощаем триггеры для избежания рекурсии
DROP TRIGGER IF EXISTS set_category_family_id_trigger ON public.categories;
DROP FUNCTION IF EXISTS public.set_category_family_id();

-- Новая функция без рекурсии
CREATE OR REPLACE FUNCTION public.set_category_family_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Устанавливаем created_by
  NEW.created_by = NEW.user_id;
  
  -- Устанавливаем family_id только если он не задан явно
  IF NEW.family_id IS NULL THEN
    NEW.family_id = public.get_user_family_id();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер заново
CREATE TRIGGER set_category_family_id_trigger
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_category_family_id();

-- Аналогично для транзакций
DROP TRIGGER IF EXISTS set_transaction_family_id_trigger ON public.transactions;
DROP FUNCTION IF EXISTS public.set_transaction_family_id();

CREATE OR REPLACE FUNCTION public.set_transaction_family_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Устанавливаем created_by
  NEW.created_by = NEW.user_id;
  
  -- Устанавливаем family_id только если он не задан явно
  IF NEW.family_id IS NULL THEN
    NEW.family_id = public.get_user_family_id();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_transaction_family_id_trigger
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_transaction_family_id();

-- Аналогично для целей накоплений
CREATE OR REPLACE FUNCTION public.set_savings_goal_family_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Устанавливаем created_by
  NEW.created_by = NEW.user_id;
  
  -- Устанавливаем family_id только если он не задан явно
  IF NEW.family_id IS NULL THEN
    NEW.family_id = public.get_user_family_id();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_savings_goal_family_id_trigger
  BEFORE INSERT ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_savings_goal_family_id();
