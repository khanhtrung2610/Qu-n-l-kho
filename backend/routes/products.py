from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Product, Role, User
from sqlalchemy.exc import IntegrityError
import os

bp = Blueprint('products', __name__)


def require_manager() -> bool:
    ident = get_jwt_identity()
    if not ident:
        return False
    u = User.query.get(int(ident))
    if not u:
        return False
    r = Role.query.get(u.role_id)
    return bool(r and r.role_name == 'manager')


def _product_to_dict(p: Product):
    # image served via API to avoid DB schema changes
    img_url = f"/api/products/{p.product_id}/image"
    return {
        'id': p.product_id,
        'sku': p.sku,
        'name': p.product_name,
        'category': p.category,
        'unit': p.unit,
        'reorder_level': p.min_stock_level,
        'status': p.status,
        'image_url': img_url,
        'default_warehouse_id': p.default_warehouse_id,
        'default_warehouse_code': p.default_warehouse.warehouse_code if p.default_warehouse else None,
        'default_warehouse_name': p.default_warehouse.warehouse_name if p.default_warehouse else None,
    }


@bp.get('/')
@jwt_required()
def list_products():
    q = Product.query.order_by(Product.product_id.desc()).all()
    return jsonify(items=[_product_to_dict(p) for p in q])


@bp.post('/')
@jwt_required()
def create_product():
    if not require_manager():
        return jsonify(message='forbidden'), 403
    data = request.get_json() or {}
    sku = (data.get('sku') or '').strip()
    name = (data.get('name') or '').strip()
    if not sku or not name:
        return jsonify(message='sku and name are required'), 400
    if Product.query.filter_by(sku=sku).first():
        return jsonify(message='sku already exists'), 409
    try:
        p = Product(
            sku=sku,
            product_name=name,
            category=data.get('category'),
            unit=(data.get('unit') or 'pcs').strip(),
            min_stock_level=int(data.get('reorder_level') or 0),
            status=data.get('status') or 'active',
            default_warehouse_id=data.get('default_warehouse_id'),
        )
        db.session.add(p)
        db.session.commit()
        return jsonify(item=_product_to_dict(p)), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify(message='duplicate or invalid data'), 400


@bp.put('/<int:pid>')
@jwt_required()
def update_product(pid):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    p = Product.query.get(pid)
    if not p:
        return jsonify(message='not found'), 404
    data = request.get_json() or {}
    # Map frontend field names to backend column names
    field_mapping = {
        'name': 'product_name',
        'category': 'category',
        'unit': 'unit',
        'reorder_level': 'min_stock_level',
        'status': 'status',
        'default_warehouse_id': 'default_warehouse_id',
    }
    for frontend_field, backend_field in field_mapping.items():
        if frontend_field in data:
            val = data[frontend_field]
            if backend_field in ['default_warehouse_id']:
                setattr(p, backend_field, val if val else None)
            else:
                setattr(p, backend_field, val)
    db.session.commit()
    return jsonify(item=_product_to_dict(p))


@bp.delete('/<int:pid>')
@jwt_required()
def delete_product(pid):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    p = Product.query.get(pid)
    if not p:
        return jsonify(message='not found'), 404
    db.session.delete(p)
    db.session.commit()
    return jsonify(message='deleted')


def _uploads_dir() -> str:
    # backend/uploads/products
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
    prod = os.path.join(base, 'products')
    os.makedirs(prod, exist_ok=True)
    return prod


@bp.post('/<int:pid>/image')
@jwt_required()
def upload_product_image(pid: int):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    p = Product.query.get(pid)
    if not p:
        return jsonify(message='not found'), 404
    if 'file' not in request.files:
        return jsonify(message='no file'), 400
    f = request.files['file']
    if not f.filename:
        return jsonify(message='empty filename'), 400
    ext = os.path.splitext(f.filename.lower())[1]
    if ext not in ['.jpg', '.jpeg', '.png', '.webp']:
        return jsonify(message='unsupported file type'), 400
    dest_dir = _uploads_dir()
    dest_name = f"{pid}{ext}"
    dest_path = os.path.join(dest_dir, dest_name)
    # remove previous files for this pid (any ext)
    for old in os.listdir(dest_dir):
        if old.startswith(f"{pid}."):
            try:
                os.remove(os.path.join(dest_dir, old))
            except OSError:
                pass
    f.save(dest_path)
    return jsonify(image_url=f"/api/products/{pid}/image?v=ts"), 201


@bp.get('/<int:pid>/image')
def get_product_image(pid: int):
    dest_dir = _uploads_dir()
    # find file with any allowed extension
    for ext in ['.jpg', '.jpeg', '.png', '.webp']:
        fp = os.path.join(dest_dir, f"{pid}{ext}")
        if os.path.exists(fp):
            return send_from_directory(dest_dir, os.path.basename(fp))
    # Not found => 404; frontend should fallback to placeholder
    return jsonify(message='no image'), 404
