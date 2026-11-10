CREATE KEYSPACE IF NOT EXISTS boardpdf_telemetry
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 1
}
AND durable_writes = true;

USE boardpdf_telemetry;

CREATE TABLE IF NOT EXISTS http_request_metrics_by_day (
  event_date date,
  service_name text,
  created_at timestamp,
  event_id uuid,
  request_id text,
  method text,
  route_pattern text,
  raw_path text,
  status_code int,
  status_class smallint,
  latency_ms int,
  duration_us bigint,
  request_bytes bigint,
  response_bytes bigint,
  user_id bigint,
  subscription_tier text,
  ip_hash text,
  user_agent text,
  country_code text,
  PRIMARY KEY ((event_date, service_name), created_at, event_id)
) WITH CLUSTERING ORDER BY (created_at DESC, event_id ASC)
  AND default_time_to_live = 7776000
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
  };

CREATE TABLE IF NOT EXISTS pdf_processing_events_by_day (
  event_date date,
  tool_name text,
  created_at timestamp,
  event_id uuid,
  operation_id text,
  user_id bigint,
  is_authenticated boolean,
  status text,
  error_code text,
  file_count int,
  input_bytes bigint,
  output_bytes bigint,
  page_count int,
  processing_ms int,
  storage_provider text,
  client_type text,
  metadata_json text,
  PRIMARY KEY ((event_date, tool_name), created_at, event_id)
) WITH CLUSTERING ORDER BY (created_at DESC, event_id ASC)
  AND default_time_to_live = 7776000
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
  };

CREATE TABLE IF NOT EXISTS security_and_auth_events_by_day (
  event_date date,
  event_type text,
  created_at timestamp,
  event_id uuid,
  severity text,
  outcome text,
  user_id bigint,
  actor_hash text,
  ip_hash text,
  route_pattern text,
  reason text,
  user_agent text,
  metadata_json text,
  PRIMARY KEY ((event_date, event_type), created_at, event_id)
) WITH CLUSTERING ORDER BY (created_at DESC, event_id ASC)
  AND default_time_to_live = 7776000
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
  };

CREATE TABLE IF NOT EXISTS ai_and_collab_events_by_day (
  event_date date,
  event_type text,
  created_at timestamp,
  event_id uuid,
  user_id bigint,
  document_id text,
  feature_name text,
  tokens_consumed int,
  tokens_remaining int,
  latency_ms int,
  status text,
  metadata_json text,
  PRIMARY KEY ((event_date, event_type), created_at, event_id)
) WITH CLUSTERING ORDER BY (created_at DESC, event_id ASC)
  AND default_time_to_live = 7776000
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
  };

CREATE TABLE IF NOT EXISTS storage_and_lifecycle_events_by_day (
  event_date date,
  event_type text,
  created_at timestamp,
  event_id uuid,
  user_id bigint,
  object_key text,
  file_id text,
  bytes_delta bigint,
  file_count int,
  storage_tier text,
  status text,
  metadata_json text,
  PRIMARY KEY ((event_date, event_type), created_at, event_id)
) WITH CLUSTERING ORDER BY (created_at DESC, event_id ASC)
  AND default_time_to_live = 7776000
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
  };

CREATE TABLE IF NOT EXISTS application_error_events_by_day (
  event_date date,
  service_name text,
  created_at timestamp,
  event_id uuid,
  severity text,
  error_name text,
  error_code text,
  message text,
  route_pattern text,
  method text,
  user_id bigint,
  request_id text,
  metadata_json text,
  PRIMARY KEY ((event_date, service_name), created_at, event_id)
) WITH CLUSTERING ORDER BY (created_at DESC, event_id ASC)
  AND default_time_to_live = 7776000
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
  };

CREATE TABLE IF NOT EXISTS telemetry_tool_counters_by_day (
  event_date date,
  tool_name text,
  executions counter,
  success_count counter,
  error_count counter,
  total_files counter,
  total_input_bytes counter,
  total_output_bytes counter,
  total_pages counter,
  total_processing_ms counter,
  PRIMARY KEY ((event_date, tool_name))
);

CREATE TABLE IF NOT EXISTS telemetry_route_counters_by_hour (
  bucket_hour timestamp,
  route_pattern text,
  method text,
  request_count counter,
  error_4xx_count counter,
  error_5xx_count counter,
  total_latency_ms counter,
  total_duration_us counter,
  total_request_bytes counter,
  total_response_bytes counter,
  PRIMARY KEY ((bucket_hour, route_pattern, method))
);
