-- Add password column to users table
-- This allows OAuth users to set a password for email/password login

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password TEXT;

-- Add comment to document the column
COMMENT ON COLUMN users.password IS 'Bcrypt hashed password for email/password authentication. NULL for OAuth-only users.';


