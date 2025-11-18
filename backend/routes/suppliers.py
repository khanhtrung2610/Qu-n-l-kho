from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Supplier, User, Role
from sqlalchemy.exc import IntegrityError

bp = Blueprint('suppliers', __name__)


def require_manager() -> bool:
    ident = get_jwt_identity()
    if not ident:
        return False
    u = User.query.get(int(ident))
    if not u:
        return False
    r = Role.query.get(u.role_id)
    return bool(r and r.role_name == 'manager')


def _sup_to_dict(s: Supplier):
    return {
        'id': s.supplier_id,
        'name': s.supplier_name,
        'contact': s.contact_person,
        'phone': s.phone,
        'email': s.email,
        'address': s.address,
        'status': s.status,
    }


@bp.get('/')
@jwt_required()
def list_suppliers():
    q = Supplier.query.order_by(Supplier.supplier_id.desc()).all()
    return jsonify(items=[_sup_to_dict(s) for s in q])


@bp.post('/')
@jwt_required()
def create_supplier():
    if not require_manager():
        return jsonify(message='forbidden'), 403
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify(message='name is required'), 400
    if Supplier.query.filter_by(supplier_name=name).first():
        return jsonify(message='name already exists'), 409
    try:
        s = Supplier(
            supplier_name=name,
            contact_person=(data.get('contact') or '').strip() or None,
            phone=(data.get('phone') or '').strip() or None,
            email=(data.get('email') or '').strip() or None,
            address=(data.get('address') or '').strip() or None,
            status=(data.get('status') or 'active'),
        )
        db.session.add(s)
        db.session.commit()
        return jsonify(item=_sup_to_dict(s)), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify(message='invalid or duplicate'), 400


@bp.put('/<int:sid>')
@jwt_required()
def update_supplier(sid: int):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    s = Supplier.query.get(sid)
    if not s:
        return jsonify(message='not found'), 404
    data = request.get_json() or {}
    field_mapping = {
        'name': 'supplier_name',
        'contact': 'contact_person',
        'phone': 'phone',
        'email': 'email',
        'address': 'address',
        'status': 'status'
    }
    for frontend_field, backend_field in field_mapping.items():
        if frontend_field in data:
            setattr(s, backend_field, (data[frontend_field] or '').strip() if isinstance(data[frontend_field], str) else data[frontend_field])
    try:
        db.session.commit()
        return jsonify(item=_sup_to_dict(s))
    except IntegrityError:
        db.session.rollback()
        return jsonify(message='invalid or duplicate'), 400


@bp.delete('/<int:sid>')
@jwt_required()
def delete_supplier(sid: int):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    s = Supplier.query.get(sid)
    if not s:
        return jsonify(message='not found'), 404
    try:
        db.session.delete(s)
        db.session.commit()
        return jsonify(message='deleted')
    except IntegrityError:
        db.session.rollback()
        # Likely there are related records (e.g., product_supplier or inventory_transactions)
        return jsonify(message='Không thể xóa nhà cung cấp đang được sử dụng'), 400
    except Exception as e:
        db.session.rollback()
        # Fallback: avoid raw 500 and surface error message to frontend
        return jsonify(message=f'Lỗi không mong đợi khi xóa nhà cung cấp: {str(e)}'), 400
