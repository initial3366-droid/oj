CREATE TABLE problem_folder_items (
    folder_id BIGINT NOT NULL,
    problem_id BIGINT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    relation_type VARCHAR(16) NOT NULL DEFAULT 'GRANT',
    added_by_account_type VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    added_by_id BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (folder_id, problem_id),
    KEY idx_problem_folder_items_problem (problem_id, relation_type),
    CONSTRAINT fk_problem_folder_items_folder FOREIGN KEY (folder_id)
        REFERENCES problem_folders(id) ON DELETE CASCADE,
    CONSTRAINT fk_problem_folder_items_problem FOREIGN KEY (problem_id)
        REFERENCES problems(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO problem_folder_items (
    folder_id,
    problem_id,
    display_order,
    relation_type,
    added_by_account_type,
    added_by_id,
    created_at
)
SELECT
    p.folder_id,
    p.id,
    p.id,
    'GRANT',
    COALESCE(p.owner_account_type, 'UNKNOWN'),
    p.owner_id,
    COALESCE(p.created_at, CURRENT_TIMESTAMP)
FROM problems p
WHERE p.folder_id IS NOT NULL
  AND p.is_deleted = FALSE;
