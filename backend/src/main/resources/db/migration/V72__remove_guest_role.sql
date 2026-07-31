-- Preserve historical account IDs and their related records while removing the
-- legacy guest role from the active user model.
UPDATE users
SET role = 'STUDENT'
WHERE role = 'GUEST';
