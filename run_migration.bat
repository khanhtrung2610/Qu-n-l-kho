@echo off
echo ====================================
echo MIGRATION: Remove Price and Update Delivery Date
echo ====================================
echo.
echo This will:
echo 0. DROP VIEW v_product_supplier_warehouse
echo 1. ADD delivery_date column (DATE)
echo 2. DROP default_price column
echo 3. DROP delivery_time column
echo 4. RECREATE VIEW with new schema
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo Running migration...
mysql -u root -p warehouse_management < backend\migrations\remove_price_update_delivery.sql

echo.
echo ====================================
echo Migration completed!
echo ====================================
echo.
echo Checking results...
mysql -u root -p warehouse_management -e "DESCRIBE product_supplier;"
echo.
pause
