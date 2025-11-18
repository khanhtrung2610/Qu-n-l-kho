-- Migration: Remove default_price and change delivery_time to delivery_date
-- Date: 2025-11-07
-- IMPORTANT: Must drop VIEW first before altering table!

USE warehouse_management;

-- Step 0: Drop VIEW that references old columns
DROP VIEW IF EXISTS v_product_supplier_warehouse;

-- Step 1: Add new delivery_date column
ALTER TABLE product_supplier 
ADD COLUMN delivery_date DATE COMMENT 'Ngày giao hàng dự kiến' AFTER warehouse_id;

-- Step 2: Drop old columns
ALTER TABLE product_supplier 
DROP COLUMN default_price,
DROP COLUMN delivery_time;

-- Step 3: Recreate VIEW with new schema
CREATE OR REPLACE VIEW v_product_supplier_warehouse AS
SELECT 
  p.product_id,
  p.sku,
  p.product_name,
  s.supplier_id,
  s.supplier_name,
  s.phone AS supplier_phone,
  s.email AS supplier_email,
  w.warehouse_id,
  w.warehouse_code,
  w.warehouse_name,
  ps.delivery_date,
  ps.priority
FROM products p
JOIN product_supplier ps ON ps.product_id = p.product_id
JOIN suppliers s ON s.supplier_id = ps.supplier_id
LEFT JOIN warehouses w ON w.warehouse_id = ps.warehouse_id
WHERE ps.status = 'active' AND p.status = 'active' AND s.status = 'active';

-- Verification query
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'warehouse_management' 
  AND TABLE_NAME = 'product_supplier'
ORDER BY ORDINAL_POSITION;

-- Verify VIEW was created
SHOW CREATE VIEW v_product_supplier_warehouse;