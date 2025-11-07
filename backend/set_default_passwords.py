"""
Script to set default passwords for demo users
Run this after creating the database to set usable passwords
"""
from werkzeug.security import generate_password_hash
from extensions import db
from models import User
from app import create_app

# Default passwords (change these in production!)
DEFAULT_PASSWORDS = {
    'quanly1': 'admin123',
    'nhanvien1': 'staff123'
}

def set_passwords():
    app = create_app()
    with app.app_context():
        for username, password in DEFAULT_PASSWORDS.items():
            user = User.query.filter_by(username=username).first()
            if user:
                user.password_hash = generate_password_hash(password)
                print(f"✅ Đã cập nhật mật khẩu cho {username}: {password}")
            else:
                print(f"⚠️  Không tìm thấy user: {username}")
        db.session.commit()
        print("\n✅ Hoàn tất! Bạn có thể đăng nhập với:")
        print("   - Username: quanly1 / Password: admin123 (Quản lý)")
        print("   - Username: nhanvien1 / Password: staff123 (Nhân viên)")

if __name__ == '__main__':
    set_passwords()

