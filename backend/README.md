# Warehouse Backend (Flask + MySQL)

## 1) Prerequisites
- Python 3.11+
- MySQL 8.0+
- Database schema imported from `../warehouse_mysql_schema.sql`

## 2) Setup
```bash
# In d:/CSDL-2025/backend
copy .env.example .env
# Edit .env and set DATABASE_URL and JWT_SECRET_KEY

pip install -r requirements.txt
python app.py
```

Health check:
```
GET http://localhost:5000/api/health
```

## 3) Auth
- Login:
```
POST /api/auth/login
{ "username": "manager1", "password": "<your password or placeholder>" }
```
- Me:
```
GET /api/auth/me (Authorization: Bearer <token>)
```
- Set password (demo only):
```
POST /api/auth/set-password (Bearer)
{ "new_password": "123456" }
```

## 4) Products
```
GET /api/products/ (Bearer)
POST /api/products/ (manager only)
PUT /api/products/{id} (manager only)
DELETE /api/products/{id} (manager only)
```

## 5) Stock Operations
```
POST /api/stock/in       (Bearer)
POST /api/stock/out      (Bearer)
POST /api/stock/adjust   (Bearer)
```
Payloads follow stored procedure params defined in DB.

## 6) Reports
```
GET /api/reports/current-stock   (Bearer)
GET /api/reports/low-stock       (Bearer)
GET /api/reports/monthly-in-out  (Bearer)
GET /api/reports/top-moving      (Bearer)
```

## Notes
- Password hashes in DB are placeholders. Use `/api/auth/set-password` to set a pbkdf2 hash for the logged-in user for testing.
- Role enforcement: endpoints check JWT `role` (manager/staff) to limit operations.
- Stock operations call MySQL stored procedures so validations & triggers are enforced inside DB.
