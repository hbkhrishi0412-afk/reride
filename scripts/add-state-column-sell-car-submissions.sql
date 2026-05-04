-- Run once on existing databases that already created sell_car_submissions without `state`.
ALTER TABLE sell_car_submissions ADD COLUMN IF NOT EXISTS state TEXT;
