-- Вставка примерных категорий (будет выполнена после регистрации пользователя)
-- Этот скрипт можно использовать для создания тестовых данных

-- Примечание: Замените 'your-user-id' на реальный UUID пользователя
-- INSERT INTO public.categories (user_id, name, type, budget_limit) VALUES
-- ('your-user-id', 'Зарплата', 'income', NULL),
-- ('your-user-id', 'Фриланс', 'income', NULL),
-- ('your-user-id', 'Инвестиции', 'income', NULL),
-- ('your-user-id', 'Продукты', 'expense', 15000.00),
-- ('your-user-id', 'Транспорт', 'expense', 5000.00),
-- ('your-user-id', 'Жильё', 'expense', 25000.00),
-- ('your-user-id', 'Развлечения', 'expense', 8000.00),
-- ('your-user-id', 'Здоровье', 'expense', 3000.00),
-- ('your-user-id', 'Одежда', 'expense', 5000.00);

-- Примерные транзакции
-- INSERT INTO public.transactions (user_id, amount, type, category, description, date) VALUES
-- ('your-user-id', 50000.00, 'income', 'Зарплата', 'Зарплата за ноябрь', '2024-11-01'),
-- ('your-user-id', 2500.00, 'expense', 'Продукты', 'Покупки в супермаркете', '2024-11-02'),
-- ('your-user-id', 1200.00, 'expense', 'Транспорт', 'Проездной билет', '2024-11-03'),
-- ('your-user-id', 3500.00, 'expense', 'Развлечения', 'Кино и ресторан', '2024-11-04'),
-- ('your-user-id', 15000.00, 'income', 'Фриланс', 'Проект веб-разработки', '2024-11-05');

-- Создание функции для автоматической вставки профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер для автоматического создания профиля
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
