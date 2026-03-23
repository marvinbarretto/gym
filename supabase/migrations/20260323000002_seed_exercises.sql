-- Seed exercise library — system exercises (user_id = NULL)
-- Muscle group IDs reference gym.muscle_groups seeded in 20260323000001

-- Helper: get muscle group ID by name
CREATE OR REPLACE FUNCTION gym._mg(p_name text) RETURNS smallint AS $$
  SELECT id FROM gym.muscle_groups WHERE name = p_name;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- Chest
-- ============================================================

INSERT INTO gym.exercises (user_id, name, primary_muscle_group, movement_type, equipment_type, description) VALUES
  (NULL, 'Flat Barbell Bench Press',     gym._mg('chest'), 'compound', 'free_weight', 'Barbell press on flat bench'),
  (NULL, 'Incline Barbell Bench Press',  gym._mg('chest'), 'compound', 'free_weight', 'Barbell press on incline bench'),
  (NULL, 'Decline Barbell Bench Press',  gym._mg('chest'), 'compound', 'free_weight', 'Barbell press on decline bench'),
  (NULL, 'Flat Dumbbell Press',          gym._mg('chest'), 'compound', 'free_weight', 'Dumbbell press on flat bench'),
  (NULL, 'Incline Dumbbell Press',       gym._mg('chest'), 'compound', 'free_weight', 'Dumbbell press on incline bench'),
  (NULL, 'Dumbbell Flyes',              gym._mg('chest'), 'isolation', 'free_weight', 'Flat bench dumbbell flyes'),
  (NULL, 'Cable Crossover',             gym._mg('chest'), 'isolation', 'cable', 'Standing cable flyes'),
  (NULL, 'Chest Press Machine',         gym._mg('chest'), 'compound', 'machine', 'Seated chest press machine'),
  (NULL, 'Pec Deck',                    gym._mg('chest'), 'isolation', 'machine', 'Seated pec deck machine'),
  (NULL, 'Push-Up',                     gym._mg('chest'), 'compound', 'bodyweight', 'Standard push-up'),
  (NULL, 'Dip (Chest)',                 gym._mg('chest'), 'compound', 'bodyweight', 'Chest-focused dip, forward lean');

-- ============================================================
-- Back
-- ============================================================

INSERT INTO gym.exercises (user_id, name, primary_muscle_group, movement_type, equipment_type, description) VALUES
  (NULL, 'Barbell Row',                 gym._mg('back'), 'compound', 'free_weight', 'Bent-over barbell row'),
  (NULL, 'Dumbbell Row',               gym._mg('back'), 'compound', 'free_weight', 'Single-arm dumbbell row'),
  (NULL, 'Pull-Up',                    gym._mg('back'), 'compound', 'bodyweight', 'Overhand grip pull-up'),
  (NULL, 'Chin-Up',                    gym._mg('back'), 'compound', 'bodyweight', 'Underhand grip chin-up'),
  (NULL, 'Lat Pulldown',              gym._mg('back'), 'compound', 'cable', 'Wide-grip lat pulldown'),
  (NULL, 'Seated Cable Row',          gym._mg('back'), 'compound', 'cable', 'Seated cable row, close grip'),
  (NULL, 'T-Bar Row',                 gym._mg('back'), 'compound', 'free_weight', 'T-bar row, chest-supported or standing'),
  (NULL, 'Face Pull',                  gym._mg('back'), 'isolation', 'cable', 'Cable face pull for rear delts and upper back'),
  (NULL, 'Deadlift',                   gym._mg('back'), 'compound', 'free_weight', 'Conventional deadlift'),
  (NULL, 'Romanian Deadlift',          gym._mg('back'), 'compound', 'free_weight', 'Stiff-leg Romanian deadlift'),
  (NULL, 'Hyperextension',            gym._mg('back'), 'isolation', 'bodyweight', 'Back extension on Roman chair');

-- ============================================================
-- Shoulders
-- ============================================================

INSERT INTO gym.exercises (user_id, name, primary_muscle_group, movement_type, equipment_type, description) VALUES
  (NULL, 'Overhead Press',             gym._mg('shoulders'), 'compound', 'free_weight', 'Standing barbell overhead press'),
  (NULL, 'Dumbbell Shoulder Press',    gym._mg('shoulders'), 'compound', 'free_weight', 'Seated dumbbell shoulder press'),
  (NULL, 'Arnold Press',               gym._mg('shoulders'), 'compound', 'free_weight', 'Rotating dumbbell press'),
  (NULL, 'Lateral Raise',             gym._mg('shoulders'), 'isolation', 'free_weight', 'Dumbbell lateral raise'),
  (NULL, 'Cable Lateral Raise',       gym._mg('shoulders'), 'isolation', 'cable', 'Single-arm cable lateral raise'),
  (NULL, 'Front Raise',               gym._mg('shoulders'), 'isolation', 'free_weight', 'Dumbbell or plate front raise'),
  (NULL, 'Reverse Pec Deck',          gym._mg('shoulders'), 'isolation', 'machine', 'Reverse pec deck for rear delts'),
  (NULL, 'Upright Row',               gym._mg('shoulders'), 'compound', 'free_weight', 'Barbell or dumbbell upright row'),
  (NULL, 'Shoulder Press Machine',    gym._mg('shoulders'), 'compound', 'machine', 'Seated shoulder press machine');

-- ============================================================
-- Biceps
-- ============================================================

INSERT INTO gym.exercises (user_id, name, primary_muscle_group, movement_type, equipment_type, description) VALUES
  (NULL, 'Barbell Curl',              gym._mg('biceps'), 'isolation', 'free_weight', 'Standing barbell curl'),
  (NULL, 'Dumbbell Curl',             gym._mg('biceps'), 'isolation', 'free_weight', 'Standing or seated dumbbell curl'),
  (NULL, 'Hammer Curl',               gym._mg('biceps'), 'isolation', 'free_weight', 'Neutral-grip dumbbell curl'),
  (NULL, 'Preacher Curl',             gym._mg('biceps'), 'isolation', 'free_weight', 'EZ-bar or dumbbell preacher curl'),
  (NULL, 'Cable Curl',                gym._mg('biceps'), 'isolation', 'cable', 'Standing cable curl'),
  (NULL, 'Incline Dumbbell Curl',     gym._mg('biceps'), 'isolation', 'free_weight', 'Incline bench dumbbell curl'),
  (NULL, 'Concentration Curl',        gym._mg('biceps'), 'isolation', 'free_weight', 'Seated single-arm concentration curl');

-- ============================================================
-- Triceps
-- ============================================================

INSERT INTO gym.exercises (user_id, name, primary_muscle_group, movement_type, equipment_type, description) VALUES
  (NULL, 'Tricep Pushdown',           gym._mg('triceps'), 'isolation', 'cable', 'Cable pushdown with rope or bar'),
  (NULL, 'Overhead Tricep Extension', gym._mg('triceps'), 'isolation', 'free_weight', 'Dumbbell or cable overhead extension'),
  (NULL, 'Skull Crusher',             gym._mg('triceps'), 'isolation', 'free_weight', 'EZ-bar lying tricep extension'),
  (NULL, 'Close-Grip Bench Press',    gym._mg('triceps'), 'compound', 'free_weight', 'Narrow-grip barbell bench press'),
  (NULL, 'Dip (Tricep)',              gym._mg('triceps'), 'compound', 'bodyweight', 'Upright tricep-focused dip'),
  (NULL, 'Kickback',                  gym._mg('triceps'), 'isolation', 'free_weight', 'Dumbbell tricep kickback');

-- ============================================================
-- Quads
-- ============================================================

INSERT INTO gym.exercises (user_id, name, primary_muscle_group, movement_type, equipment_type, description) VALUES
  (NULL, 'Barbell Back Squat',        gym._mg('quads'), 'compound', 'free_weight', 'High-bar or low-bar back squat'),
  (NULL, 'Front Squat',               gym._mg('quads'), 'compound', 'free_weight', 'Barbell front squat'),
  (NULL, 'Goblet Squat',              gym._mg('quads'), 'compound', 'free_weight', 'Dumbbell or kettlebell goblet squat'),
  (NULL, 'Leg Press',                 gym._mg('quads'), 'compound', 'machine', 'Seated or 45-degree leg press'),
  (NULL, 'Leg Extension',             gym._mg('quads'), 'isolation', 'machine', 'Seated leg extension machine'),
  (NULL, 'Bulgarian Split Squat',     gym._mg('quads'), 'compound', 'free_weight', 'Rear-foot-elevated split squat'),
  (NULL, 'Hack Squat',                gym._mg('quads'), 'compound', 'machine', 'Machine hack squat'),
  (NULL, 'Walking Lunge',             gym._mg('quads'), 'compound', 'free_weight', 'Dumbbell or barbell walking lunge');

-- ============================================================
-- Hamstrings
-- ============================================================

INSERT INTO gym.exercises (user_id, name, primary_muscle_group, movement_type, equipment_type, description) VALUES
  (NULL, 'Lying Leg Curl',            gym._mg('hamstrings'), 'isolation', 'machine', 'Prone leg curl machine'),
  (NULL, 'Seated Leg Curl',           gym._mg('hamstrings'), 'isolation', 'machine', 'Seated leg curl machine'),
  (NULL, 'Nordic Hamstring Curl',     gym._mg('hamstrings'), 'isolation', 'bodyweight', 'Partner-assisted or pad-anchored Nordic curl'),
  (NULL, 'Good Morning',              gym._mg('hamstrings'), 'compound', 'free_weight', 'Barbell good morning'),
  (NULL, 'Stiff-Leg Deadlift',        gym._mg('hamstrings'), 'compound', 'free_weight', 'Straight-leg deadlift');

-- ============================================================
-- Glutes
-- ============================================================

INSERT INTO gym.exercises (user_id, name, primary_muscle_group, movement_type, equipment_type, description) VALUES
  (NULL, 'Hip Thrust',                gym._mg('glutes'), 'compound', 'free_weight', 'Barbell hip thrust'),
  (NULL, 'Glute Bridge',              gym._mg('glutes'), 'isolation', 'bodyweight', 'Bodyweight or weighted glute bridge'),
  (NULL, 'Cable Pull-Through',        gym._mg('glutes'), 'compound', 'cable', 'Cable pull-through for glute activation'),
  (NULL, 'Glute Kickback Machine',    gym._mg('glutes'), 'isolation', 'machine', 'Machine glute kickback'),
  (NULL, 'Step-Up',                   gym._mg('glutes'), 'compound', 'free_weight', 'Dumbbell or barbell step-up');

-- ============================================================
-- Calves
-- ============================================================

INSERT INTO gym.exercises (user_id, name, primary_muscle_group, movement_type, equipment_type, description) VALUES
  (NULL, 'Standing Calf Raise',       gym._mg('calves'), 'isolation', 'machine', 'Machine standing calf raise'),
  (NULL, 'Seated Calf Raise',         gym._mg('calves'), 'isolation', 'machine', 'Machine seated calf raise'),
  (NULL, 'Donkey Calf Raise',         gym._mg('calves'), 'isolation', 'machine', 'Donkey calf raise machine or partner');

-- ============================================================
-- Core
-- ============================================================

INSERT INTO gym.exercises (user_id, name, primary_muscle_group, movement_type, equipment_type, description) VALUES
  (NULL, 'Plank',                     gym._mg('core'), 'isolation', 'bodyweight', 'Front plank hold'),
  (NULL, 'Hanging Leg Raise',         gym._mg('core'), 'isolation', 'bodyweight', 'Hanging leg or knee raise'),
  (NULL, 'Cable Crunch',              gym._mg('core'), 'isolation', 'cable', 'Kneeling cable crunch'),
  (NULL, 'Ab Wheel Rollout',          gym._mg('core'), 'isolation', 'bodyweight', 'Ab wheel or barbell rollout'),
  (NULL, 'Russian Twist',             gym._mg('core'), 'isolation', 'free_weight', 'Seated Russian twist with plate or dumbbell'),
  (NULL, 'Woodchop',                  gym._mg('core'), 'compound', 'cable', 'Cable or dumbbell woodchop'),
  (NULL, 'Dead Bug',                  gym._mg('core'), 'isolation', 'bodyweight', 'Supine dead bug'),
  (NULL, 'Crunch',                    gym._mg('core'), 'isolation', 'bodyweight', 'Standard crunch');

-- ============================================================
-- Forearms
-- ============================================================

INSERT INTO gym.exercises (user_id, name, primary_muscle_group, movement_type, equipment_type, description) VALUES
  (NULL, 'Wrist Curl',                gym._mg('forearms'), 'isolation', 'free_weight', 'Seated barbell or dumbbell wrist curl'),
  (NULL, 'Reverse Wrist Curl',        gym._mg('forearms'), 'isolation', 'free_weight', 'Seated reverse wrist curl'),
  (NULL, 'Farmer''s Walk',            gym._mg('forearms'), 'compound', 'free_weight', 'Loaded carry for grip and traps');

-- ============================================================
-- Cardio
-- ============================================================

INSERT INTO gym.exercises (user_id, name, primary_muscle_group, movement_type, equipment_type, description) VALUES
  (NULL, 'Treadmill Run',             NULL, 'compound', 'cardio', 'Treadmill running or jogging'),
  (NULL, 'Rowing Machine',            gym._mg('back'), 'compound', 'cardio', 'Indoor rower / ergometer'),
  (NULL, 'Stationary Bike',           gym._mg('quads'), 'compound', 'cardio', 'Upright or recumbent bike'),
  (NULL, 'Elliptical',                NULL, 'compound', 'cardio', 'Elliptical trainer'),
  (NULL, 'Stair Climber',             gym._mg('quads'), 'compound', 'cardio', 'Stair climber / StairMaster'),
  (NULL, 'Assault Bike',              NULL, 'compound', 'cardio', 'Fan bike / air bike'),
  (NULL, 'Jump Rope',                 gym._mg('calves'), 'compound', 'bodyweight', 'Skipping rope');

-- ============================================================
-- Secondary muscle group mappings
-- ============================================================

-- Bench press variations → triceps, shoulders
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('triceps') FROM gym.exercises e WHERE e.name IN ('Flat Barbell Bench Press', 'Incline Barbell Bench Press', 'Decline Barbell Bench Press', 'Flat Dumbbell Press', 'Incline Dumbbell Press', 'Close-Grip Bench Press');
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('shoulders') FROM gym.exercises e WHERE e.name IN ('Flat Barbell Bench Press', 'Incline Barbell Bench Press', 'Decline Barbell Bench Press', 'Flat Dumbbell Press', 'Incline Dumbbell Press');

-- Push-up, dips → triceps, shoulders
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('triceps') FROM gym.exercises e WHERE e.name IN ('Push-Up', 'Dip (Chest)');
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('shoulders') FROM gym.exercises e WHERE e.name IN ('Push-Up', 'Dip (Chest)');

-- Rows → biceps
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('biceps') FROM gym.exercises e WHERE e.name IN ('Barbell Row', 'Dumbbell Row', 'Seated Cable Row', 'T-Bar Row');

-- Pull-up/chin-up → biceps
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('biceps') FROM gym.exercises e WHERE e.name IN ('Pull-Up', 'Chin-Up', 'Lat Pulldown');

-- Deadlift → hamstrings, glutes
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('hamstrings') FROM gym.exercises e WHERE e.name IN ('Deadlift', 'Romanian Deadlift');
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('glutes') FROM gym.exercises e WHERE e.name IN ('Deadlift', 'Romanian Deadlift');

-- Squats → glutes, hamstrings
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('glutes') FROM gym.exercises e WHERE e.name IN ('Barbell Back Squat', 'Front Squat', 'Goblet Squat', 'Hack Squat', 'Bulgarian Split Squat');
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('hamstrings') FROM gym.exercises e WHERE e.name IN ('Barbell Back Squat', 'Goblet Squat');

-- Leg press → glutes
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('glutes') FROM gym.exercises e WHERE e.name = 'Leg Press';

-- Lunges → glutes
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('glutes') FROM gym.exercises e WHERE e.name = 'Walking Lunge';

-- Hip thrust → hamstrings
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('hamstrings') FROM gym.exercises e WHERE e.name = 'Hip Thrust';

-- Overhead press → triceps
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('triceps') FROM gym.exercises e WHERE e.name IN ('Overhead Press', 'Dumbbell Shoulder Press', 'Arnold Press', 'Shoulder Press Machine');

-- Face pull → shoulders
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('shoulders') FROM gym.exercises e WHERE e.name = 'Face Pull';

-- Farmer's walk → core, back
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('core') FROM gym.exercises e WHERE e.name = 'Farmer''s Walk';
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('back') FROM gym.exercises e WHERE e.name = 'Farmer''s Walk';

-- Dip (Tricep) → chest, shoulders
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('chest') FROM gym.exercises e WHERE e.name = 'Dip (Tricep)';
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('shoulders') FROM gym.exercises e WHERE e.name = 'Dip (Tricep)';

-- Good morning → glutes
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('glutes') FROM gym.exercises e WHERE e.name = 'Good Morning';

-- Stiff-leg deadlift → glutes
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('glutes') FROM gym.exercises e WHERE e.name = 'Stiff-Leg Deadlift';

-- Rowing machine → shoulders, biceps
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('shoulders') FROM gym.exercises e WHERE e.name = 'Rowing Machine';
INSERT INTO gym.exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, gym._mg('biceps') FROM gym.exercises e WHERE e.name = 'Rowing Machine';

-- Clean up helper function
DROP FUNCTION gym._mg(text);
