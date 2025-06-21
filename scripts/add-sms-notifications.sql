-- Создание таблицы для настроек уведомлений
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  
  -- SMS уведомления
  sms_enabled BOOLEAN DEFAULT false,
  sms_own_transactions BOOLEAN DEFAULT true,
  sms_family_transactions BOOLEAN DEFAULT true,
  sms_large_transactions BOOLEAN DEFAULT true,
  sms_large_amount_threshold DECIMAL(10,2) DEFAULT 5000.00,
  
  -- Email уведомления  
  email_enabled BOOLEAN DEFAULT true,
  email_own_transactions BOOLEAN DEFAULT false,
  email_family_transactions BOOLEAN DEFAULT true,
  email_weekly_summary BOOLEAN DEFAULT true,
  email_monthly_summary BOOLEAN DEFAULT true,
  
  -- Push уведомления (для будущего)
  push_enabled BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, family_id)
);

-- Создание таблицы для логов уведомлений
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  
  notification_type TEXT CHECK (notification_type IN ('sms', 'email', 'push')) NOT NULL,
  recipient_phone TEXT,
  recipient_email TEXT,
  
  message_content TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed', 'delivered')) DEFAULT 'pending',
  error_message TEXT,
  
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы для шаблонов сообщений
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL UNIQUE,
  template_type TEXT CHECK (template_type IN ('sms', 'email')) NOT NULL,
  
  subject TEXT, -- Для email
  content TEXT NOT NULL,
  
  -- Переменные: {amount}, {category}, {description}, {user_name}, {family_name}, {date}
  variables TEXT[] DEFAULT ARRAY['amount', 'category', 'description', 'user_name', 'family_name', 'date'],
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON public.notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_family_id ON public.notification_settings(family_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON public.notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_transaction_id ON public.notification_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON public.notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs(created_at);

-- RLS политики
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Политики для notification_settings
CREATE POLICY "Users can manage own notification settings" ON public.notification_settings
  FOR ALL USING (
    user_id = auth.uid()
    OR family_id = ANY(public.user_family_ids())
  );

-- Политики для notification_logs
CREATE POLICY "Users can view own notification logs" ON public.notification_logs
  FOR SELECT USING (
    user_id = auth.uid()
    OR family_id = ANY(public.user_family_ids())
  );

-- Политики для notification_templates (только чтение для пользователей)
CREATE POLICY "Users can view notification templates" ON public.notification_templates
  FOR SELECT USING (true);

-- Триггеры для updated_at
CREATE TRIGGER handle_updated_at_notification_settings
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_notification_templates
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Вставляем базовые шаблоны уведомлений
INSERT INTO public.notification_templates (template_name, template_type, content) VALUES
('transaction_sms', 'sms', '💰 {user_name}: {amount}₽ на {category}. {description}. Семья: {family_name}'),
('large_transaction_sms', 'sms', '🚨 КРУПНАЯ ТРАТА: {user_name} потратил {amount}₽ на {category}. {description}'),
('income_sms', 'sms', '💚 {user_name}: +{amount}₽ доход от {category}. {description}'),
('transaction_email', 'email', 'Новая транзакция в семье {family_name}: {user_name} {amount}₽ на {category}. Описание: {description}. Дата: {date}'),
('weekly_summary_email', 'email', 'Недельный отчет семьи {family_name}: доходы {total_income}₽, расходы {total_expenses}₽, баланс {balance}₽'),
('monthly_summary_email', 'email', 'Месячный отчет семьи {family_name}: доходы {total_income}₽, расходы {total_expenses}₽, баланс {balance}₽')
ON CONFLICT (template_name) DO NOTHING;

-- Функция для получения настроек уведомлений пользователя
CREATE OR REPLACE FUNCTION public.get_user_notification_settings(user_id_param UUID DEFAULT auth.uid())
RETURNS TABLE(
  id UUID,
  family_id UUID,
  sms_enabled BOOLEAN,
  sms_own_transactions BOOLEAN,
  sms_family_transactions BOOLEAN,
  sms_large_transactions BOOLEAN,
  sms_large_amount_threshold DECIMAL(10,2),
  email_enabled BOOLEAN,
  email_own_transactions BOOLEAN,
  email_family_transactions BOOLEAN,
  email_weekly_summary BOOLEAN,
  email_monthly_summary BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ns.id,
    ns.family_id,
    ns.sms_enabled,
    ns.sms_own_transactions,
    ns.sms_family_transactions,
    ns.sms_large_transactions,
    ns.sms_large_amount_threshold,
    ns.email_enabled,
    ns.email_own_transactions,
    ns.email_family_transactions,
    ns.email_weekly_summary,
    ns.email_monthly_summary
  FROM public.notification_settings ns
  WHERE ns.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для создания/обновления настроек уведомлений
CREATE OR REPLACE FUNCTION public.upsert_notification_settings(
  family_id_param UUID,
  sms_enabled_param BOOLEAN DEFAULT false,
  sms_own_transactions_param BOOLEAN DEFAULT true,
  sms_family_transactions_param BOOLEAN DEFAULT true,
  sms_large_transactions_param BOOLEAN DEFAULT true,
  sms_large_amount_threshold_param DECIMAL(10,2) DEFAULT 5000.00,
  email_enabled_param BOOLEAN DEFAULT true,
  email_own_transactions_param BOOLEAN DEFAULT false,
  email_family_transactions_param BOOLEAN DEFAULT true,
  email_weekly_summary_param BOOLEAN DEFAULT true,
  email_monthly_summary_param BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
  settings_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  INSERT INTO public.notification_settings (
    user_id,
    family_id,
    sms_enabled,
    sms_own_transactions,
    sms_family_transactions,
    sms_large_transactions,
    sms_large_amount_threshold,
    email_enabled,
    email_own_transactions,
    email_family_transactions,
    email_weekly_summary,
    email_monthly_summary
  )
  VALUES (
    current_user_id,
    family_id_param,
    sms_enabled_param,
    sms_own_transactions_param,
    sms_family_transactions_param,
    sms_large_transactions_param,
    sms_large_amount_threshold_param,
    email_enabled_param,
    email_own_transactions_param,
    email_family_transactions_param,
    email_weekly_summary_param,
    email_monthly_summary_param
  )
  ON CONFLICT (user_id, family_id) 
  DO UPDATE SET
    sms_enabled = sms_enabled_param,
    sms_own_transactions = sms_own_transactions_param,
    sms_family_transactions = sms_family_transactions_param,
    sms_large_transactions = sms_large_transactions_param,
    sms_large_amount_threshold = sms_large_amount_threshold_param,
    email_enabled = email_enabled_param,
    email_own_transactions = email_own_transactions_param,
    email_family_transactions = email_family_transactions_param,
    email_weekly_summary = email_weekly_summary_param,
    email_monthly_summary = email_monthly_summary_param,
    updated_at = NOW()
  RETURNING id INTO settings_id;
  
  RETURN settings_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для отправки уведомлений о транзакции
CREATE OR REPLACE FUNCTION public.send_transaction_notifications()
RETURNS TRIGGER AS $$
DECLARE
  family_member RECORD;
  phone_record RECORD;
  template_content TEXT;
  message_content TEXT;
  notification_settings RECORD;
  family_name TEXT;
  user_name TEXT;
  is_large_transaction BOOLEAN;
BEGIN
  -- Получаем информацию о семье и пользователе
  SELECT f.name INTO family_name 
  FROM public.families f 
  WHERE f.id = NEW.family_id;
  
  SELECT fm.display_name INTO user_name
  FROM public.family_members fm
  WHERE fm.user_id = NEW.user_id AND fm.family_id = NEW.family_id;
  
  -- Если нет семьи, выходим
  IF NEW.family_id IS NULL OR family_name IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Проходим по всем участникам семьи
  FOR family_member IN 
    SELECT fm.user_id, fm.display_name
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id AND fm.is_active = true
  LOOP
    -- Получаем настройки уведомлений участника
    SELECT * INTO notification_settings
    FROM public.notification_settings ns
    WHERE ns.user_id = family_member.user_id AND ns.family_id = NEW.family_id;
    
    -- Если настройки не найдены, создаем дефолтные
    IF notification_settings IS NULL THEN
      INSERT INTO public.notification_settings (user_id, family_id)
      VALUES (family_member.user_id, NEW.family_id);
      
      SELECT * INTO notification_settings
      FROM public.notification_settings ns
      WHERE ns.user_id = family_member.user_id AND ns.family_id = NEW.family_id;
    END IF;
    
    -- Проверяем, нужно ли отправлять SMS
    IF notification_settings.sms_enabled THEN
      -- Определяем, крупная ли это транзакция
      is_large_transaction := NEW.amount >= notification_settings.sms_large_amount_threshold;
      
      -- Проверяем условия отправки
      IF (NEW.user_id = family_member.user_id AND notification_settings.sms_own_transactions) OR
         (NEW.user_id != family_member.user_id AND notification_settings.sms_family_transactions) OR
         (is_large_transaction AND notification_settings.sms_large_transactions) THEN
        
        -- Получаем шаблон сообщения
        IF NEW.type = 'income' THEN
          SELECT content INTO template_content 
          FROM public.notification_templates 
          WHERE template_name = 'income_sms' AND is_active = true;
        ELSIF is_large_transaction THEN
          SELECT content INTO template_content 
          FROM public.notification_templates 
          WHERE template_name = 'large_transaction_sms' AND is_active = true;
        ELSE
          SELECT content INTO template_content 
          FROM public.notification_templates 
          WHERE template_name = 'transaction_sms' AND is_active = true;
        END IF;
        
        -- Заменяем переменные в шаблоне
        message_content := template_content;
        message_content := REPLACE(message_content, '{amount}', NEW.amount::TEXT);
        message_content := REPLACE(message_content, '{category}', NEW.category);
        message_content := REPLACE(message_content, '{description}', NEW.description);
        message_content := REPLACE(message_content, '{user_name}', user_name);
        message_content := REPLACE(message_content, '{family_name}', family_name);
        message_content := REPLACE(message_content, '{date}', NEW.date::TEXT);
        
        -- Получаем номера телефонов участника
        FOR phone_record IN
          SELECT fpn.phone_number
          FROM public.family_phone_numbers fpn
          WHERE fpn.user_id = family_member.user_id 
          AND fpn.family_id = NEW.family_id
          AND fpn.notifications_enabled = true
        LOOP
          -- Создаем запись в логе уведомлений
          INSERT INTO public.notification_logs (
            user_id,
            family_id,
            transaction_id,
            notification_type,
            recipient_phone,
            message_content,
            status
          ) VALUES (
            family_member.user_id,
            NEW.family_id,
            NEW.id,
            'sms',
            phone_record.phone_number,
            message_content,
            'pending'
          );
        END LOOP;
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер для автоматической отправки уведомлений
CREATE TRIGGER send_transaction_notifications_trigger
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.send_transaction_notifications();

-- Функция для получения логов уведомлений
CREATE OR REPLACE FUNCTION public.get_notification_logs(
  limit_param INTEGER DEFAULT 50,
  offset_param INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  transaction_id UUID,
  notification_type TEXT,
  recipient_phone TEXT,
  recipient_email TEXT,
  message_content TEXT,
  status TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  transaction_amount DECIMAL(10,2),
  transaction_category TEXT,
  transaction_description TEXT
) AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  RETURN QUERY
  SELECT 
    nl.id,
    nl.transaction_id,
    nl.notification_type,
    nl.recipient_phone,
    nl.recipient_email,
    nl.message_content,
    nl.status,
    nl.error_message,
    nl.sent_at,
    nl.created_at,
    t.amount as transaction_amount,
    t.category as transaction_category,
    t.description as transaction_description
  FROM public.notification_logs nl
  LEFT JOIN public.transactions t ON nl.transaction_id = t.id
  WHERE nl.user_id = current_user_id
  OR nl.family_id = ANY(public.user_family_ids())
  ORDER BY nl.created_at DESC
  LIMIT limit_param OFFSET offset_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
