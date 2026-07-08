CREATE TABLE problem_test_cases (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    problem_id BIGINT NOT NULL,
    case_no INT NOT NULL,
    input_data LONGTEXT NOT NULL,
    output_data LONGTEXT NOT NULL,
    explanation TEXT,
    sample BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_problem_test_case_no_sample (problem_id, case_no, sample),
    CONSTRAINT fk_problem_test_cases_problem FOREIGN KEY (problem_id) REFERENCES problems(id)
);

INSERT INTO problem_test_cases (problem_id, case_no, input_data, output_data, explanation, sample)
SELECT id, 1, '1 2', '3', '1 + 2 = 3', TRUE
FROM problems
WHERE title = 'A+B Problem'
  AND NOT EXISTS (
      SELECT 1 FROM problem_test_cases WHERE problem_id = problems.id AND sample = TRUE
  );

INSERT INTO problem_test_cases (problem_id, case_no, input_data, output_data, explanation, sample)
SELECT id, 1, '1 2', '3', NULL, FALSE
FROM problems
WHERE title = 'A+B Problem'
  AND NOT EXISTS (
      SELECT 1 FROM problem_test_cases WHERE problem_id = problems.id AND sample = FALSE
  );
