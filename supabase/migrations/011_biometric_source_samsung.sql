-- Migration 011: Add 'samsung_sensor' as a valid biometric source
-- Run AFTER 002_biometrics.sql

ALTER TABLE public.biometric_readings
  DROP CONSTRAINT IF EXISTS biometric_readings_source_check;

ALTER TABLE public.biometric_readings
  ADD CONSTRAINT biometric_readings_source_check
  CHECK (source IN ('healthkit', 'health_connect', 'samsung_sensor', 'manual'));
