-- Best-effort backfill for folders created before owner_id existed.
-- Assign each non-default folder to the owner who owns the most active problems in that folder.
UPDATE problem_folders pf
SET pf.owner_id = (
    SELECT p.owner_id
    FROM problems p
    WHERE p.folder_id = pf.id
      AND p.owner_id IS NOT NULL
      AND COALESCE(p.is_deleted, 0) = 0
    GROUP BY p.owner_id
    ORDER BY COUNT(*) DESC, p.owner_id ASC
    LIMIT 1
)
WHERE pf.owner_id IS NULL
  AND pf.name <> '未分类'
  AND EXISTS (
      SELECT 1
      FROM problems p
      WHERE p.folder_id = pf.id
        AND p.owner_id IS NOT NULL
        AND COALESCE(p.is_deleted, 0) = 0
  );
