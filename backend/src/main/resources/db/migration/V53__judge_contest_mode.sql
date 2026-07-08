-- V53: 区分普通练习判题模式与比赛判题模式。

INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at)
VALUES
('judge.contest_mode', 'domjudge', 'judge', '比赛判题模式：domjudge、docker、unsafe-local', NOW())
ON DUPLICATE KEY UPDATE setting_value = setting_value;
