USE boardstack_app;

UPDATE organizations
SET name = REGEXP_REPLACE(name, ' Organization$', '')
WHERE name LIKE '% Organization';
