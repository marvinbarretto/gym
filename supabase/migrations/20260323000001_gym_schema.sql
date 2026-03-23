-- Gym PWA schema — lives alongside collectr's public schema
-- All tables under `gym` schema to avoid collisions

CREATE SCHEMA IF NOT EXISTS gym;

-- ============================================================
-- Lookup tables
-- ============================================================

CREATE TABLE gym.muscle_groups (
  id   smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL UNIQUE
);

INSERT INTO gym.muscle_groups (name) VALUES
  ('chest'), ('back'), ('shoulders'), ('biceps'), ('triceps'),
  ('quads'), ('hamstrings'), ('glutes'), ('calves'), ('core'), ('forearms');

ALTER TABLE gym.muscle_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "muscle_groups readable by all"
  ON gym.muscle_groups FOR SELECT
  USING (true);

-- ============================================================
-- Users & Profiles
-- ============================================================

CREATE TABLE gym.profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     text,
  height_cm        numeric,
  weight_kg        numeric,
  date_of_birth    date,
  fitness_goal     text,
  experience_level text CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own row"
  ON gym.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- User Gyms
-- ============================================================

CREATE TABLE gym.user_gyms (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name      text NOT NULL,
  location  text,
  notes     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym.user_gyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_gyms: own rows"
  ON gym.user_gyms FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Equipment
-- ============================================================

CREATE TABLE gym.equipment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      uuid NOT NULL REFERENCES gym.user_gyms(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('machine', 'free_weight', 'cable', 'bodyweight', 'cardio')),
  description text,
  photo_url   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipment: via gym ownership"
  ON gym.equipment FOR ALL
  USING (EXISTS (
    SELECT 1 FROM gym.user_gyms g WHERE g.id = gym_id AND g.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM gym.user_gyms g WHERE g.id = gym_id AND g.user_id = auth.uid()
  ));

-- ============================================================
-- Exercises
-- ============================================================

CREATE TABLE gym.exercises (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- null = system seed
  name                  text NOT NULL,
  primary_muscle_group  smallint REFERENCES gym.muscle_groups(id),
  description           text,
  movement_type         text CHECK (movement_type IN ('compound', 'isolation')),
  equipment_type        text CHECK (equipment_type IN ('machine', 'free_weight', 'cable', 'bodyweight', 'cardio')),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Secondary muscle groups (many-to-many)
CREATE TABLE gym.exercise_muscle_groups (
  exercise_id     uuid NOT NULL REFERENCES gym.exercises(id) ON DELETE CASCADE,
  muscle_group_id smallint NOT NULL REFERENCES gym.muscle_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, muscle_group_id)
);

ALTER TABLE gym.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.exercise_muscle_groups ENABLE ROW LEVEL SECURITY;

-- System seeds (user_id IS NULL) readable by all; user-created scoped to owner
CREATE POLICY "exercises: read system + own"
  ON gym.exercises FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "exercises: insert own"
  ON gym.exercises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exercises: update own"
  ON gym.exercises FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exercises: delete own"
  ON gym.exercises FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "exercise_muscle_groups: read via exercise"
  ON gym.exercise_muscle_groups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM gym.exercises e
    WHERE e.id = exercise_id AND (e.user_id IS NULL OR e.user_id = auth.uid())
  ));

CREATE POLICY "exercise_muscle_groups: write via own exercise"
  ON gym.exercise_muscle_groups FOR ALL
  USING (EXISTS (
    SELECT 1 FROM gym.exercises e
    WHERE e.id = exercise_id AND e.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM gym.exercises e
    WHERE e.id = exercise_id AND e.user_id = auth.uid()
  ));

-- ============================================================
-- Workout Plans
-- ============================================================

CREATE TABLE gym.plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  split_type  text CHECK (split_type IN ('push_pull_legs', 'upper_lower', 'full_body', 'custom')),
  created_by  text NOT NULL CHECK (created_by IN ('user', 'ai')),
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gym.plan_days (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id   uuid NOT NULL REFERENCES gym.plans(id) ON DELETE CASCADE,
  label     text NOT NULL,
  day_order smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Plan day target muscle groups (many-to-many)
CREATE TABLE gym.plan_day_muscle_groups (
  plan_day_id     uuid NOT NULL REFERENCES gym.plan_days(id) ON DELETE CASCADE,
  muscle_group_id smallint NOT NULL REFERENCES gym.muscle_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_day_id, muscle_group_id)
);

CREATE TABLE gym.plan_day_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_day_id     uuid NOT NULL REFERENCES gym.plan_days(id) ON DELETE CASCADE,
  exercise_id     uuid NOT NULL REFERENCES gym.exercises(id),
  suggested_sets  smallint,
  suggested_reps  text, -- e.g. "8-12" or "to failure"
  suggested_weight_kg numeric,
  exercise_order  smallint NOT NULL,
  notes           text
);

ALTER TABLE gym.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.plan_day_muscle_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.plan_day_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans: own rows"
  ON gym.plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "plan_days: via plan ownership"
  ON gym.plan_days FOR ALL
  USING (EXISTS (
    SELECT 1 FROM gym.plans p WHERE p.id = plan_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM gym.plans p WHERE p.id = plan_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "plan_day_muscle_groups: via plan ownership"
  ON gym.plan_day_muscle_groups FOR ALL
  USING (EXISTS (
    SELECT 1 FROM gym.plan_days pd
    JOIN gym.plans p ON p.id = pd.plan_id
    WHERE pd.id = plan_day_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM gym.plan_days pd
    JOIN gym.plans p ON p.id = pd.plan_id
    WHERE pd.id = plan_day_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "plan_day_exercises: via plan ownership"
  ON gym.plan_day_exercises FOR ALL
  USING (EXISTS (
    SELECT 1 FROM gym.plan_days pd
    JOIN gym.plans p ON p.id = pd.plan_id
    WHERE pd.id = plan_day_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM gym.plan_days pd
    JOIN gym.plans p ON p.id = pd.plan_id
    WHERE pd.id = plan_day_id AND p.user_id = auth.uid()
  ));

-- ============================================================
-- Sessions
-- ============================================================

CREATE TABLE gym.sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gym_id            uuid REFERENCES gym.user_gyms(id),
  plan_day_id       uuid REFERENCES gym.plan_days(id),
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  pre_energy        smallint CHECK (pre_energy BETWEEN 1 AND 5),
  pre_mood          text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gym.session_sets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES gym.sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES gym.exercises(id),
  set_number  smallint NOT NULL,
  reps        smallint,
  weight_kg   numeric,
  rpe         smallint CHECK (rpe BETWEEN 1 AND 10),
  duration_s  integer, -- for timed exercises
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gym.session_cardio (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES gym.sessions(id) ON DELETE CASCADE,
  exercise_id   uuid NOT NULL REFERENCES gym.exercises(id),
  duration_s    integer NOT NULL,
  distance_km   numeric,
  avg_heart_rate smallint,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.session_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.session_cardio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions: own rows"
  ON gym.sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "session_sets: via session ownership"
  ON gym.session_sets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM gym.sessions s WHERE s.id = session_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM gym.sessions s WHERE s.id = session_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "session_cardio: via session ownership"
  ON gym.session_cardio FOR ALL
  USING (EXISTS (
    SELECT 1 FROM gym.sessions s WHERE s.id = session_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM gym.sessions s WHERE s.id = session_id AND s.user_id = auth.uid()
  ));

-- ============================================================
-- Subjective Tracking
-- ============================================================

CREATE TABLE gym.body_check_ins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in_date date NOT NULL,
  soreness_map  jsonb NOT NULL DEFAULT '{}', -- { "chest": 3, "quads": 5 }
  energy        smallint CHECK (energy BETWEEN 1 AND 5),
  sleep_quality smallint CHECK (sleep_quality BETWEEN 1 AND 5),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, check_in_date)
);

CREATE TABLE gym.supplements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text CHECK (type IN ('protein', 'creatine', 'vitamin', 'other')),
  dosage_unit text, -- e.g. 'g', 'mg', 'ml', 'scoop'
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gym.supplement_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id uuid NOT NULL REFERENCES gym.supplements(id) ON DELETE CASCADE,
  dosage        numeric,
  taken_at      timestamptz NOT NULL DEFAULT now(),
  notes         text
);

ALTER TABLE gym.body_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.supplement_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "body_check_ins: own rows"
  ON gym.body_check_ins FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "supplements: own rows"
  ON gym.supplements FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "supplement_logs: own rows"
  ON gym.supplement_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Classes
-- ============================================================

CREATE TABLE gym.gym_classes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL REFERENCES gym.user_gyms(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  day_of_week         smallint CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time          time,
  duration_minutes    smallint,
  instructor          text,
  muscle_group_tags   smallint[], -- references muscle_groups.id
  difficulty_estimate smallint CHECK (difficulty_estimate BETWEEN 1 AND 5),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gym.class_attendances (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id   uuid NOT NULL REFERENCES gym.gym_classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES gym.sessions(id),
  rating     smallint CHECK (rating BETWEEN 1 AND 5),
  notes      text,
  attended_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym.gym_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.class_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gym_classes: via gym ownership"
  ON gym.gym_classes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM gym.user_gyms g WHERE g.id = gym_id AND g.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM gym.user_gyms g WHERE g.id = gym_id AND g.user_id = auth.uid()
  ));

CREATE POLICY "class_attendances: own rows"
  ON gym.class_attendances FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Conversations
-- ============================================================

CREATE TABLE gym.conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  uuid REFERENCES gym.sessions(id),
  type        text NOT NULL CHECK (type IN ('session', 'check_in', 'planning', 'question')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz
);

CREATE TABLE gym.conversation_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES gym.conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  tool_calls      jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations: own rows"
  ON gym.conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversation_messages: via conversation ownership"
  ON gym.conversation_messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM gym.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM gym.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

-- ============================================================
-- System: Model Config, AI Usage, Pending Tasks
-- ============================================================

CREATE TABLE gym.model_config (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  config     jsonb NOT NULL DEFAULT '{
    "in_session": "claude-haiku-4-5",
    "post_session": "claude-sonnet-4-6",
    "deep_analysis": "claude-opus",
    "fallback": "gemini-2.5-flash"
  }',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gym.ai_usage (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model          text NOT NULL,
  task_type      text NOT NULL,
  tokens_in      integer NOT NULL DEFAULT 0,
  tokens_out     integer NOT NULL DEFAULT 0,
  estimated_cost numeric NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gym.pending_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type    text NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  input        jsonb NOT NULL DEFAULT '{}',
  output       jsonb,
  retry_count  smallint NOT NULL DEFAULT 0,
  max_retries  smallint NOT NULL DEFAULT 3,
  claimed_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE gym.model_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.pending_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_config: own row"
  ON gym.model_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_usage: own rows"
  ON gym.ai_usage FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pending_tasks: own rows"
  ON gym.pending_tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Useful indexes
-- ============================================================

CREATE INDEX idx_session_sets_session ON gym.session_sets(session_id);
CREATE INDEX idx_session_sets_exercise ON gym.session_sets(exercise_id);
CREATE INDEX idx_session_cardio_session ON gym.session_cardio(session_id);
CREATE INDEX idx_sessions_user_started ON gym.sessions(user_id, started_at DESC);
CREATE INDEX idx_body_check_ins_user_date ON gym.body_check_ins(user_id, check_in_date DESC);
CREATE INDEX idx_conversations_user ON gym.conversations(user_id, started_at DESC);
CREATE INDEX idx_conversation_messages_conv ON gym.conversation_messages(conversation_id, created_at);
CREATE INDEX idx_ai_usage_user_created ON gym.ai_usage(user_id, created_at DESC);
CREATE INDEX idx_pending_tasks_status ON gym.pending_tasks(status, claimed_at);
CREATE INDEX idx_exercises_muscle_group ON gym.exercises(primary_muscle_group);
CREATE INDEX idx_supplement_logs_user ON gym.supplement_logs(user_id, taken_at DESC);

-- ============================================================
-- Grant usage on gym schema to authenticated role
-- ============================================================

GRANT USAGE ON SCHEMA gym TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA gym TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA gym TO authenticated;

-- Allow anon to read muscle_groups and system exercises
GRANT USAGE ON SCHEMA gym TO anon;
GRANT SELECT ON gym.muscle_groups TO anon;
GRANT SELECT ON gym.exercises TO anon;
GRANT SELECT ON gym.exercise_muscle_groups TO anon;
