# 🔐 DATABASE CONFIGURATION

## ✅ PASSWORD ĐÃ CẬP NHẬT: `Led@nh28624`

### 📋 **CÁC FILE ĐÃ CẬP NHẬT:**

#### 1. **backend/config.py** ✅
```python
SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root:Led%40nh28624@localhost:3306/warehouse_db'
```

#### 2. **backend/update_passwords.py** ✅
```python
DATABASE_URI = 'mysql+pymysql://root:Led%40nh28624@localhost/warehouse_db'
```

#### 3. **backend/.env.example** ✅
```
DATABASE_URL=mysql+pymysql://root:Led%40nh28624@localhost:3306/warehouse_db
```

#### 4. **backend/.env.local** ✅ (VỪA TẠO)
```
DATABASE_URL=mysql+pymysql://root:Led%40nh28624@localhost:3306/warehouse_db
```

---

## 🚀 **KHỞI ĐỘNG LẠI:**

1. **Restart Backend:**
   ```bash
   RESTART_BACKEND.bat
   ```

2. **Hoặc manual:**
   ```bash
   cd backend
   python app.py
   ```

---

## 📝 **LƯU Ý:**

- Password trong URL phải encode: `@` → `%40`
- Password thật: `Led@nh28624`
- Password trong URL: `Led%40nh28624`

---

## ✅ **DATABASE INFO:**

- **Host:** localhost
- **Port:** 3306
- **Database:** warehouse_db
- **Username:** root
- **Password:** Led@nh28624

---

## 🎯 **NẾU MUỐN TẠO .env FILE:**

```bash
cd backend
copy .env.local .env
```

(File `.env` bị gitignore nên tôi tạo `.env.local` để bạn tham khảo)
