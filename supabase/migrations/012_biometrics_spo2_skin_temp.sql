-- Migration 012: Add SpO2 and skin temperature columns to biometric_readings
-- spo2 comes from Health Connect (OxygenSaturationRecord) or Samsung Sensor SDK
-- skin_temperature comes from Samsung Sensor SDK only

ALTER TABLE public.biometric_readings
  ADD COLUMN IF NOT EXISTS spo2             NUMERIC(5,2),  -- blood oxygen saturation (%)
  ADD COLUMN IF NOT EXISTS skin_temperature NUMERIC(5,2);  -- body surface temperature (°C)
