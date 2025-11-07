from flask import Flask, jsonify, send_from_directory
import os
from flask_jwt_extended import JWTManager
from config import DevConfig
from extensions import db
from flask_cors import CORS


def create_app():
    # Serve static frontend from ../frontend
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
    app = Flask(__name__, static_folder=frontend_dir, static_url_path='/')
    app.config.from_object(DevConfig)
    # Ensure uploads dir exists
    uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'uploads'))
    os.makedirs(uploads_dir, exist_ok=True)

    # init extensions
    db.init_app(app)
    JWTManager(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Register blueprints
    from routes.auth import bp as auth_bp
    from routes.products import bp as products_bp
    from routes.stock import bp as stock_bp
    from routes.reports import bp as reports_bp
    from routes.suppliers import bp as suppliers_bp
    from routes.warehouses import bp as warehouses_bp
    from routes.users import bp as users_bp
    from routes.catalog import bp as catalog_bp
    from routes.relationships import bp as relationships_bp
    from routes.product_supplier import bp as product_supplier_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(stock_bp, url_prefix='/api/stock')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(suppliers_bp, url_prefix='/api/suppliers')
    app.register_blueprint(warehouses_bp, url_prefix='/api/warehouses')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(catalog_bp, url_prefix='/api/catalog')
    app.register_blueprint(relationships_bp, url_prefix='/api/relationships')
    app.register_blueprint(product_supplier_bp, url_prefix='/api/product-supplier')

    @app.get('/api/health')
    def health():
        return jsonify(status='ok')

    # Serve index.html at root to avoid 404 when visiting http://localhost:5000/
    @app.get('/')
    def root():
        return send_from_directory(app.static_folder, 'index.html')

    # Serve other static assets (styles.css, main.js, etc.)
    @app.get('/<path:path>')
    def static_proxy(path: str):
        # Do not intercept API routes
        if path.startswith('api/'):
            return jsonify(message='not found'), 404
        return send_from_directory(app.static_folder, path)

    # Serve uploads (product images)
    @app.get('/uploads/<path:path>')
    def serve_uploads(path: str):
        return send_from_directory(uploads_dir, path)

    return app


# For local run: python app.py
if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000)
