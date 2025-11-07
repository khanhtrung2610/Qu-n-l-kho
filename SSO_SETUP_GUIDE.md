# SSO Setup Guide

Hướng dẫn cấu hình SSO cho Google, GitHub và Facebook.

## 1. GitHub OAuth App

### Bước 1: Tạo OAuth App
1. Truy cập https://github.com/settings/developers
2. Click **"OAuth Apps"** → **"New OAuth App"**
3. Điền thông tin:
   - **Application name**: `Warehouse Management` (hoặc tên bạn muốn)
   - **Homepage URL**: `http://localhost:5000` (dev) hoặc domain thật (production)
   - **Authorization callback URL**: `http://localhost:5000/api/auth/sso/github/callback`
4. Click **"Register application"**
5. Lấy **Client ID** và **Generate a new client secret**

### Bước 2: Cấu hình Backend
Thêm vào file `backend/.env`:
```bash
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

### Lưu ý
- GitHub có thể không public email của user. App sẽ tự động lấy primary verified email.
- Nếu user không có email, app sẽ dùng GitHub username làm username trong hệ thống.

---

## 2. Facebook OAuth App

### Bước 1: Tạo Facebook App
1. Truy cập https://developers.facebook.com/apps
2. Click **"Create App"** → chọn **"Consumer"** hoặc **"Business"**
3. Điền **App Display Name**: `Warehouse Management`
4. Sau khi tạo, vào **Settings** → **Basic**:
   - Lấy **App ID** và **App Secret**
5. Vào **Add a Product** → chọn **Facebook Login** → **Set Up**
6. Chọn **Web** platform
7. Trong **Valid OAuth Redirect URIs**, thêm:
   - Dev: `http://localhost:5000/api/auth/sso/facebook/callback`
   - Production: `https://yourdomain.com/api/auth/sso/facebook/callback`
8. Lưu thay đổi

### Bước 2: Cấu hình Backend
Thêm vào file `backend/.env`:
```bash
FACEBOOK_CLIENT_ID=your_facebook_app_id_here
FACEBOOK_CLIENT_SECRET=your_facebook_app_secret_here
```

### Bước 3: Chuyển App sang Live Mode (Production)
- Mặc định app ở Development Mode, chỉ admin/dev/tester có thể đăng nhập.
- Để public: vào **App Review** → làm theo hướng dẫn để chuyển sang Live.

### Lưu ý
- Facebook yêu cầu HTTPS cho production (không chấp nhận HTTP trừ localhost).
- Scope `email` có thể bị từ chối nếu user không cho phép; app sẽ dùng `facebook:{fb_id}` làm username.

---

## 3. Google OAuth (đã có sẵn)

### Bước 1: Tạo OAuth Client
1. Truy cập https://console.cloud.google.com
2. Tạo project mới hoặc chọn project hiện có
3. Vào **APIs & Services** → **Credentials**
4. Click **"Create Credentials"** → **"OAuth client ID"**
5. Chọn **"Web application"**
6. **Authorized redirect URIs**: 
   - `http://localhost:5000/api/auth/sso/callback` (dev)
   - `https://yourdomain.com/api/auth/sso/callback` (production)
7. Lấy **Client ID** và **Client Secret**

### Bước 2: Cấu hình Backend
Thêm vào file `backend/.env`:
```bash
OIDC_ISSUER=https://accounts.google.com
OIDC_CLIENT_ID=your_google_client_id_here
OIDC_CLIENT_SECRET=your_google_client_secret_here
```

---

## 4. Kiểm tra sau khi cấu hình

1. Copy `backend/.env.example` → `backend/.env`
2. Điền các giá trị Client ID/Secret vào `.env`
3. Restart Flask backend:
   ```bash
   cd backend
   python app.py
   ```
4. Mở frontend: http://localhost:5000
5. Trang đăng nhập sẽ hiển thị 4 nút:
   - Đăng nhập (username/password)
   - Đăng nhập với Google
   - Đăng nhập với GitHub
   - Đăng nhập với Facebook
6. Click thử từng nút SSO và kiểm tra luồng đăng nhập

---

## 5. Xử lý lỗi thường gặp

### GitHub
- **Error: redirect_uri_mismatch**
  - Kiểm tra lại URL callback trong GitHub OAuth App settings phải khớp chính xác (bao gồm http/https, port).

### Facebook
- **Error: Can't Load URL**
  - Đảm bảo redirect URI đã được thêm vào Valid OAuth Redirect URIs.
  - Facebook yêu cầu HTTPS cho production.
- **Error: App Not Set Up**
  - Kiểm tra Facebook Login product đã được kích hoạt.

### Google
- **Error: redirect_uri_mismatch**
  - Kiểm tra Authorized redirect URIs trong Google Cloud Console.
- **Error: invalid_client**
  - Client ID/Secret sai hoặc chưa được cấu hình đúng trong `.env`.

---

## 6. Luồng hoạt động

1. User click nút SSO (Google/GitHub/Facebook)
2. Frontend redirect đến `/api/auth/sso/{provider}/login`
3. Backend redirect user đến trang đăng nhập của provider
4. User đăng nhập và cho phép quyền
5. Provider redirect về `/api/auth/sso/{provider}/callback`
6. Backend lấy thông tin user (email, name) từ provider
7. Tìm hoặc tạo user trong DB (username = email hoặc provider:id)
8. Tạo JWT token và redirect về frontend với `#token=...`
9. Frontend đọc token từ hash, lưu vào localStorage và load dashboard

---

## 7. Bảo mật Production

- **HTTPS bắt buộc**: Cấu hình SSL/TLS cho domain production.
- **CORS**: Đảm bảo chỉ domain chính thức được phép gọi API.
- **Rate Limiting**: Giới hạn số lần đăng nhập/callback để chống brute-force.
- **Rotate Secrets**: Định kỳ thay đổi Client Secret.
- **Review Permissions**: Chỉ yêu cầu scope tối thiểu (email, profile).

---

Nếu có thắc mắc hoặc lỗi, kiểm tra:
- Console log trên browser (F12)
- Backend log (terminal chạy Flask)
- Network tab để xem request/response

