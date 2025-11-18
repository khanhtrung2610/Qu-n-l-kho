"""
Script to set default passwords for demo users
"""
from werkzeug.security import generate_password_hash
from extensions import db
from models import User
from app import create_app

# Default passwords
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
                print(f"OK - Password updated for {username}: {password}")
            else:
                print(f"WARNING - User not found: {username}")
        db.session.commit()
        print("\nDone! You can login with:")
        print("   - Username: quanly1 / Password: admin123 (Manager)")
        print("   - Username: nhanvien1 / Password: staff123 (Staff)")

if __name__ == '__main__':
    set_passwords()
