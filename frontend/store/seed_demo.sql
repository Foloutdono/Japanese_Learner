-- Store screenshots, step 0b (after seed_demo.py, local dev database only):
-- the learner boarded two weeks ago, so the ghost train measures a real pace
-- and a real promise, and the practice stations have grades to print.
UPDATE user_profiles SET onboarded_at = NOW() - interval '14 days', goal_set_at = NOW() - interval '14 days', goal_target_date = '2027-07-15' WHERE user_id = 'local-dev-user';
INSERT INTO reading_log (user_id, level, phase, phrase, romaji, answer, correct, quality, accuracy, created_at)
SELECT 'local-dev-user','N5','level','これはほんです。','korehahondesu.','korehahondesu',(g%6)<>0, 4, 90, now() - (g % 12 || ' days')::interval FROM generate_series(1,24) g;
INSERT INTO comprehension_log (user_id, level, text, translation, questions, answers, score, total, created_at)
SELECT 'local-dev-user','N5','x','x','[]','[]', 4 + (g%2), 5, now() - (g % 9 || ' days')::interval FROM generate_series(1,6) g;
INSERT INTO translation_log (user_id, level, phase, translation_prompt, phrase, romaji, answer, correct, quality, created_at)
SELECT 'local-dev-user','N5','level','x','x','x','x',(g%5)<>0, 4, now() - (g % 10 || ' days')::interval FROM generate_series(1,18) g;
INSERT INTO dictation_log (user_id, level, clip_id, phrase, answer, correct, accuracy, quality, plays, created_at)
SELECT 'local-dev-user','N5','c'||g,'x','x',(g%4)<>0, 92, 4, 1, now() - (g % 8 || ' days')::interval FROM generate_series(1,15) g;
INSERT INTO composition_log (user_id, level, raw_id, pattern, sentence, correct, quality, created_at)
SELECT 'local-dev-user','N5','r'||g,'〜ます','x',(g%4)<>0, 4, now() - (g % 7 || ' days')::interval FROM generate_series(1,8) g;
INSERT INTO conversation_log (user_id, level, scenario, mode, turn, accuracy, correct, quality, created_at)
SELECT 'local-dev-user','N5','s1','say', g%3, 90, (g%6)<>0, 4, now() - (g % 6 || ' days')::interval FROM generate_series(1,12) g;
INSERT INTO exam_attempts (user_id, exam_id, revision, section_id, answers, review, per_section, correct, total, started_at, finished_at)
VALUES ('local-dev-user','n5-vocab-01',1,'vocab','{}','[]','{}',17,21, now()-interval '3 days 20 minutes', now()-interval '3 days'),
       ('local-dev-user','n5-vocab-01',2,'vocab','{}','[]','{}',19,21, now()-interval '1 days 20 minutes', now()-interval '1 days'),
       ('local-dev-user','n5-grammar-01',1,'grammar','{}','[]','{}',14,17, now()-interval '2 days 30 minutes', now()-interval '2 days');
