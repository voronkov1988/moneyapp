-- -- Проверим и исправим политики для family_invitations
-- DROP POLICY IF EXISTS "Users can view family invitations" ON public.family_invitations;
-- DROP POLICY IF EXISTS "Users can insert family invitations" ON public.family_invitations;
-- DROP POLICY IF EXISTS "Users can update family invitations" ON public.family_invitations;
-- DROP POLICY IF EXISTS "Users can delete family invitations" ON public.family_invitations;

-- -- Создаем более простые и надежные политики
-- CREATE POLICY "Users can view invitations they sent or received" ON public.family_invitations
--   FOR SELECT USING (
--     invited_by = auth.uid()
--     OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
--     OR family_id IN (
--       SELECT f.id FROM public.families f
--       WHERE f.created_by = auth.uid()
--       OR f.id IN (
--         SELECT fm.family_id FROM public.family_members fm 
--         WHERE fm.user_id = auth.uid() AND fm.is_active = true
--       )
--     )
--   );

-- CREATE POLICY "Users can create invitations for their families" ON public.family_invitations
--   FOR INSERT WITH CHECK (
--     invited_by = auth.uid()
--     AND family_id IN (
--       SELECT f.id FROM public.families f
--       WHERE f.created_by = auth.uid()
--       OR f.id IN (
--         SELECT fm.family_id FROM public.family_members fm 
--         WHERE fm.user_id = auth.uid() AND fm.role = 'admin' AND fm.is_active = true
--       )
--     )
--   );

-- CREATE POLICY "Users can update invitations they sent" ON public.family_invitations
--   FOR UPDATE USING (
--     invited_by = auth.uid()
--     OR family_id IN (
--       SELECT f.id FROM public.families f
--       WHERE f.created_by = auth.uid()
--       OR f.id IN (
--         SELECT fm.family_id FROM public.family_members fm 
--         WHERE fm.user_id = auth.uid() AND fm.role = 'admin' AND fm.is_active = true
--       )
--     )
--   );

-- CREATE POLICY "Users can delete invitations they sent" ON public.family_invitations
--   FOR DELETE USING (
--     invited_by = auth.uid()
--     OR family_id IN (
--       SELECT f.id FROM public.families f
--       WHERE f.created_by = auth.uid()
--       OR f.id IN (
--         SELECT fm.family_id FROM public.family_members fm 
--         WHERE fm.user_id = auth.uid() AND fm.role = 'admin' AND fm.is_active = true
--       )
--     )
--   );

-- -- Создаем функцию для получения приглашений семьи
-- CREATE OR REPLACE FUNCTION public.get_family_invitations(family_id_param UUID)
-- RETURNS TABLE(
--   id UUID,
--   email TEXT,
--   display_name TEXT,
--   role TEXT,
--   status TEXT,
--   invitation_code TEXT,
--   expires_at TIMESTAMPTZ,
--   created_at TIMESTAMPTZ,
--   invited_by UUID
-- ) AS $$
-- BEGIN
--   -- Проверяем права доступа к семье
--   IF NOT EXISTS (
--     SELECT 1 FROM public.families f
--     WHERE f.id = family_id_param
--     AND (
--       f.created_by = auth.uid()
--       OR f.id IN (
--         SELECT fm.family_id FROM public.family_members fm 
--         WHERE fm.user_id = auth.uid() AND fm.is_active = true
--       )
--     )
--   ) THEN
--     RAISE EXCEPTION 'Access denied to family invitations';
--   END IF;
  
--   RETURN QUERY
--   SELECT 
--     fi.id,
--     fi.email,
--     fi.display_name,
--     fi.role,
--     fi.status,
--     fi.invitation_code,
--     fi.expires_at,
--     fi.created_at,
--     fi.invited_by
--   FROM public.family_invitations fi
--   WHERE fi.family_id = family_id_param
--   AND fi.status = 'pending'
--   ORDER BY fi.created_at DESC;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- -- Создаем функцию для создания приглашения
-- CREATE OR REPLACE FUNCTION public.create_family_invitation(
--   family_id_param UUID,
--   email_param TEXT,
--   display_name_param TEXT,
--   role_param TEXT DEFAULT 'member'
-- )
-- RETURNS UUID AS $$
-- DECLARE
--   new_invitation_id UUID;
--   current_user_id UUID;
-- BEGIN
--   current_user_id := auth.uid();
  
--   -- Проверяем права администратора семьи
--   IF NOT EXISTS (
--     SELECT 1 FROM public.families f
--     WHERE f.id = family_id_param
--     AND (
--       f.created_by = current_user_id
--       OR f.id IN (
--         SELECT fm.family_id FROM public.family_members fm 
--         WHERE fm.user_id = current_user_id AND fm.role = 'admin' AND fm.is_active = true
--       )
--     )
--   ) THEN
--     RAISE EXCEPTION 'Only family admins can send invitations';
--   END IF;
  
--   -- Проверяем, что пользователь еще не в семье
--   IF EXISTS (
--     SELECT 1 FROM public.family_members fm
--     JOIN auth.users au ON fm.user_id = au.id
--     WHERE fm.family_id = family_id_param 
--     AND au.email = email_param 
--     AND fm.is_active = true
--   ) THEN
--     RAISE EXCEPTION 'User is already a member of this family';
--   END IF;
  
--   -- Проверяем, что нет активного приглашения
--   IF EXISTS (
--     SELECT 1 FROM public.family_invitations fi
--     WHERE fi.family_id = family_id_param 
--     AND fi.email = email_param 
--     AND fi.status = 'pending'
--     AND fi.expires_at > NOW()
--   ) THEN
--     RAISE EXCEPTION 'Active invitation already exists for this email';
--   END IF;
  
--   INSERT INTO public.family_invitations (
--     family_id, 
--     invited_by, 
--     email, 
--     display_name, 
--     role
--   )
--   VALUES (
--     family_id_param, 
--     current_user_id, 
--     email_param, 
--     display_name_param, 
--     role_param
--   )
--   RETURNING id INTO new_invitation_id;
  
--   RETURN new_invitation_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- -- Создаем функцию для удаления приглашения
-- CREATE OR REPLACE FUNCTION public.cancel_family_invitation(invitation_id_param UUID)
-- RETURNS BOOLEAN AS $$
-- DECLARE
--   target_family_id UUID;
--   current_user_id UUID;
-- BEGIN
--   current_user_id := auth.uid();
  
--   -- Получаем family_id приглашения
--   SELECT family_id INTO target_family_id 
--   FROM public.family_invitations 
--   WHERE id = invitation_id_param;
  
--   IF target_family_id IS NULL THEN
--     RAISE EXCEPTION 'Invitation not found';
--   END IF;
  
--   -- Проверяем права администратора
--   IF NOT EXISTS (
--     SELECT 1 FROM public.families f
--     WHERE f.id = target_family_id
--     AND (
--       f.created_by = current_user_id
--       OR f.id IN (
--         SELECT fm.family_id FROM public.family_members fm 
--         WHERE fm.user_id = current_user_id AND fm.role = 'admin' AND fm.is_active = true
--       )
--     )
--   ) THEN
--     RAISE EXCEPTION 'Only family admins can cancel invitations';
--   END IF;
  
--   UPDATE public.family_invitations 
--   SET status = 'expired'
--   WHERE id = invitation_id_param;
  
--   RETURN true;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;


-- Проверим и исправим политики для family_invitations
DROP POLICY IF EXISTS "Users can view family invitations" ON public.family_invitations;
DROP POLICY IF EXISTS "Users can insert family invitations" ON public.family_invitations;
DROP POLICY IF EXISTS "Users can update family invitations" ON public.family_invitations;
DROP POLICY IF EXISTS "Users can delete family invitations" ON public.family_invitations;

-- Создаем более простые и надежные политики
CREATE POLICY "Users can view invitations they sent or received" ON public.family_invitations
  FOR SELECT USING (
    invited_by = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR family_id IN (
      SELECT f.id FROM public.families f
      WHERE f.created_by = auth.uid()
      OR f.id IN (
        SELECT fm.family_id FROM public.family_members fm 
        WHERE fm.user_id = auth.uid() AND fm.is_active = true
      )
    )
  );

CREATE POLICY "Users can create invitations for their families" ON public.family_invitations
  FOR INSERT WITH CHECK (
    invited_by = auth.uid()
    AND family_id IN (
      SELECT f.id FROM public.families f
      WHERE f.created_by = auth.uid()
      OR f.id IN (
        SELECT fm.family_id FROM public.family_members fm 
        WHERE fm.user_id = auth.uid() AND fm.role = 'admin' AND fm.is_active = true
      )
    )
  );

CREATE POLICY "Users can update invitations they sent" ON public.family_invitations
  FOR UPDATE USING (
    invited_by = auth.uid()
    OR family_id IN (
      SELECT f.id FROM public.families f
      WHERE f.created_by = auth.uid()
      OR f.id IN (
        SELECT fm.family_id FROM public.family_members fm 
        WHERE fm.user_id = auth.uid() AND fm.role = 'admin' AND fm.is_active = true
      )
    )
  );

CREATE POLICY "Users can delete invitations they sent" ON public.family_invitations
  FOR DELETE USING (
    invited_by = auth.uid()
    OR family_id IN (
      SELECT f.id FROM public.families f
      WHERE f.created_by = auth.uid()
      OR f.id IN (
        SELECT fm.family_id FROM public.family_members fm 
        WHERE fm.user_id = auth.uid() AND fm.role = 'admin' AND fm.is_active = true
      )
    )
  );

-- Создаем функцию для получения приглашений семьи
CREATE OR REPLACE FUNCTION public.get_family_invitations(family_id_param UUID)
RETURNS TABLE(
  id UUID,
  email TEXT,
  display_name TEXT,
  role TEXT,
  status TEXT,
  invitation_code TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  invited_by UUID
) AS $$
BEGIN
  -- Проверяем права доступа к семье
  IF NOT EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = family_id_param
    AND (
      f.created_by = auth.uid()
      OR f.id IN (
        SELECT fm.family_id FROM public.family_members fm 
        WHERE fm.user_id = auth.uid() AND fm.is_active = true
      )
    )
  ) THEN
    RAISE EXCEPTION 'Access denied to family invitations';
  END IF;
  
  RETURN QUERY
  SELECT 
    fi.id,
    fi.email,
    fi.display_name,
    fi.role,
    fi.status,
    fi.invitation_code,
    fi.expires_at,
    fi.created_at,
    fi.invited_by
  FROM public.family_invitations fi
  WHERE fi.family_id = family_id_param
  AND fi.status = 'pending'
  ORDER BY fi.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создаем функцию для создания приглашения
CREATE OR REPLACE FUNCTION public.create_family_invitation(
  family_id_param UUID,
  email_param TEXT,
  display_name_param TEXT,
  role_param TEXT DEFAULT 'member'
)
RETURNS UUID AS $$
DECLARE
  new_invitation_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Проверяем права администратора семьи
  IF NOT EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = family_id_param
    AND (
      f.created_by = current_user_id
      OR f.id IN (
        SELECT fm.family_id FROM public.family_members fm 
        WHERE fm.user_id = current_user_id AND fm.role = 'admin' AND fm.is_active = true
      )
    )
  ) THEN
    RAISE EXCEPTION 'Only family admins can send invitations';
  END IF;
  
  -- Проверяем, что пользователь еще не в семье
  IF EXISTS (
    SELECT 1 FROM public.family_members fm
    JOIN auth.users au ON fm.user_id = au.id
    WHERE fm.family_id = family_id_param 
    AND au.email = email_param 
    AND fm.is_active = true
  ) THEN
    RAISE EXCEPTION 'User is already a member of this family';
  END IF;
  
  -- Проверяем, что нет активного приглашения
  IF EXISTS (
    SELECT 1 FROM public.family_invitations fi
    WHERE fi.family_id = family_id_param 
    AND fi.email = email_param 
    AND fi.status = 'pending'
    AND fi.expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Active invitation already exists for this email';
  END IF;
  
  INSERT INTO public.family_invitations (
    family_id, 
    invited_by, 
    email, 
    display_name, 
    role
  )
  VALUES (
    family_id_param, 
    current_user_id, 
    email_param, 
    display_name_param, 
    role_param
  )
  RETURNING id INTO new_invitation_id;
  
  RETURN new_invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создаем функцию для удаления приглашения
CREATE OR REPLACE FUNCTION public.cancel_family_invitation(invitation_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  target_family_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Получаем family_id приглашения
  SELECT family_id INTO target_family_id 
  FROM public.family_invitations 
  WHERE id = invitation_id_param;
  
  IF target_family_id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  
  -- Проверяем права администратора
  IF NOT EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = target_family_id
    AND (
      f.created_by = current_user_id
      OR f.id IN (
        SELECT fm.family_id FROM public.family_members fm 
        WHERE fm.user_id = current_user_id AND fm.role = 'admin' AND fm.is_active = true
      )
    )
  ) THEN
    RAISE EXCEPTION 'Only family admins can cancel invitations';
  END IF;
  
  UPDATE public.family_invitations 
  SET status = 'expired'
  WHERE id = invitation_id_param;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
