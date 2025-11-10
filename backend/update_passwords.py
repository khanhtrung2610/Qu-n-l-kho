"""
Update password hashes in database
"""
import sys
import os
sys.path.append(os.path.dirname(__file__))

from werkzeug.security import generate_password_hash
from sqlalchemy import create_engine, text

# Database connection using SQLAlchemy (same as app.py)
DATABASE_URI = 'mysql+pymysql://root:Led%40nh28624@localhost/warehouse_db'

try:
    engine = create_engine(DATABASE_URI)
    
    # Generate hash for default password: admin123
    password_hash = generate_password_hash('admin123')
    
    # Update all users with the same password
    users = ['admin', 'quanly1', 'nhanvien1']
    
    with engine.connect() as conn:
        for username in users:
            result = conn.execute(
                text("UPDATE users SET password_hash = :pwd WHERE username = :user"),
                {"pwd": password_hash, "user": username}
            )
            conn.commit()
            print(f"✅ Updated password for: {username}")
    
    print("\n" + "="*50)
    print("✅ All passwords updated successfully!")
    print("="*50)
    print("\nLogin credentials:")
    print("- Username: admin / Password: admin123")
    print("- Username: quanly1 / Password: admin123")
    print("- Username: nhanvien1 / Password: admin123")
    
except Exception as e:
    print(f"❌ Error: {e}")
    print("\nNote: Make sure database 'warehouse_management' exists!")
    print("Run: recreate_database.bat first")
