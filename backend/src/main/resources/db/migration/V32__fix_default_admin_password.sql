UPDATE admin_users
SET password_hash = '$2y$12$osxhdvwti5ztyybTvfXNxuVJMCQJcCsKHx2EqREIvc8lFN7NecFSG',
    updated_at = CURRENT_TIMESTAMP
WHERE username = 'admin'
  AND password_hash = '$2y$12$lgK2BzmwVbP1bdQNVihl5OcKBMHZuRr3h.Y0onvtnWVvSJZT030su';
