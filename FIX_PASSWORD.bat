@echo off
echo ========================================
echo FIX PASSWORD HASH
echo ========================================
echo.
echo This will update all user passwords to: admin123
echo.
pause

cd backend
python update_passwords.py

echo.
echo Done! Now you can login with:
echo - Username: admin / Password: admin123
echo - Username: quanly1 / Password: admin123
echo - Username: nhanvien1 / Password: admin123
echo.
pause
