-- V26: migrate legacy frontend carousel JSON into the home carousel table.
-- The runtime carousel source is home_carousel_slides. frontend.carousel_images
-- only existed in the old settings screen and is removed after migration.

SET @legacy_carousel := (
    SELECT setting_value
    FROM system_settings
    WHERE setting_key = 'frontend.carousel_images'
      AND JSON_VALID(setting_value) = 1
    LIMIT 1
);

SET @legacy_count := IFNULL(JSON_LENGTH(@legacy_carousel), 0);

SET @custom_home_carousel_count := (
    SELECT COUNT(*)
    FROM home_carousel_slides
    WHERE image_url NOT IN ('/banners/problem-bank.svg', '/banners/contest-lab.svg')
);

DELETE h
FROM home_carousel_slides h
WHERE @legacy_count > 0
  AND @custom_home_carousel_count = 0
  AND h.image_url IN ('/banners/problem-bank.svg', '/banners/contest-lab.svg');

SET @carousel_base_order := (
    SELECT IFNULL(MAX(display_order), 0)
    FROM home_carousel_slides
);

INSERT INTO home_carousel_slides (
    title,
    subtitle,
    image_url,
    cta,
    target_url,
    display_order,
    enabled
)
SELECT
    COALESCE(NULLIF(j.title, ''), CONCAT('轮播图 ', j.ord)),
    '',
    j.image_url,
    '查看详情',
    COALESCE(NULLIF(j.link_url, ''), '/'),
    @carousel_base_order + j.ord,
    TRUE
FROM JSON_TABLE(
    COALESCE(@legacy_carousel, JSON_ARRAY()),
    '$[*]' COLUMNS (
        ord FOR ORDINALITY,
        image_url VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$.imageUrl',
        link_url VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$.linkUrl' NULL ON EMPTY,
        title VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$.title' NULL ON EMPTY
    )
) j
WHERE @legacy_count > 0
  AND j.image_url IS NOT NULL
  AND j.image_url <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM home_carousel_slides existing
      WHERE existing.image_url = j.image_url
  );

DELETE FROM system_settings
WHERE setting_key = 'frontend.carousel_images';
