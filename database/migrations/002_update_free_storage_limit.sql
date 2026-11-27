USE boardstack_app;

ALTER TABLE app_user_profiles MODIFY COLUMN storage_limit_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0;

UPDATE app_user_profiles
SET storage_limit_bytes = 0
WHERE subscription_tier = 'free' OR subscription_tier IS NULL;
