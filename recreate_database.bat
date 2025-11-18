@echo off
echo ========================================
echo RECREATE DATABASE - Warehouse Management
echo ========================================
echo.
echo WARNING: This will DROP and RECREATE the entire database!
echo All existing data will be LOST!
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo Step 1: Dropping existing database...
mysql -u root -p -e "DROP DATABASE IF EXISTS warehouse_db;"

echo.
echo Step 2: Creating new database...
mysql -u root -p -e "CREATE DATABASE warehouse_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo.
echo Step 3: Running schema from warehouse_db.sql...
mysql -u root -p warehouse_db < warehouse_db.sql

echo.
echo ========================================
echo Database recreated successfully!
echo ========================================
echo.
echo Verifying product_supplier table...
mysql -u root -p warehouse_db -e "DESCRIBE product_supplier;"

echo.
echo Verifying view...
mysql -u root -p warehouse_db -e "SHOW CREATE VIEW v_product_supplier_warehouse\G"

echo.
pause
