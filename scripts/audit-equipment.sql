-- scripts/audit-equipment.sql
-- Update equipment names to match actual gym machine labels
-- Run manually: supabase db execute < scripts/audit-equipment.sql

-- First, check current equipment:
-- SELECT id, name, type FROM gym.equipment WHERE gym_id = '<your-gym-id>';

-- Update names to match physical machine labels.
-- The canonical names the user sees at their gym:
-- Chest Press, Shoulder Press, Standing Leg Curl, Standing Calf Raise,
-- Tricep Extension, Dual Adjustment Pulley, Lateral Seated Row

-- Example updates (verify IDs first):
-- UPDATE gym.equipment SET name = 'Chest Press' WHERE name = 'Chest Press Machine' AND gym_id = '<your-gym-id>';
-- UPDATE gym.equipment SET name = 'Shoulder Press' WHERE name LIKE '%Shoulder Press%' AND gym_id = '<your-gym-id>';

-- NOTE: Run SELECT first to map existing names → canonical names, then update.
-- The user will add more equipment names over time via the add_equipment tool.
