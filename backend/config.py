import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'mysql+pymysql://root:Led%40nh28624@localhost:3306/warehouse_db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-secret-change-me')
    # SECRET_KEY is required for Flask sessions (used by OAuth state/nonce)
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', JWT_SECRET_KEY)
    JSON_SORT_KEYS = False
    # Session cookie settings (important for OAuth state/nonce on localhost)
    SESSION_COOKIE_NAME = 'warehouse_session'
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = False  # True only behind HTTPS in production

class DevConfig(Config):
    DEBUG = True

class ProdConfig(Config):
    DEBUG = False
