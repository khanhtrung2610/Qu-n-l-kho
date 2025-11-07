from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Warehouse, User, Role
from sqlalchemy.exc import IntegrityError

bp = Blueprint('warehouses', __name__)


def require_manager() -> bool:
    ident = get_jwt_identity()
    if not ident:
        return False
    u = User.query.get(int(ident))
    if not u:
        return False
    r = Role.query.get(u.role_id)
    return bool(r and r.role_name == 'manager')


def _wh_to_dict(w: Warehouse):
    return {
        'id': w.warehouse_id,
        'code': w.warehouse_code,
        'name': w.warehouse_name,
        'location': w.location,
        'status': w.status,
        'manager_id': w.manager_id,
        'manager_name': w.manager.full_name if w.manager else None,
        'manager_username': w.manager.username if w.manager else None,
        'created_at': w.created_at.isoformat() if w.created_at else None,
    }


@bp.get('/')
@jwt_required()
def list_warehouses():
    q = Warehouse.query.order_by(Warehouse.warehouse_code.asc()).all()
    return jsonify(items=[_wh_to_dict(w) for w in q])


@bp.post('/')
@jwt_required()
def create_warehouse():
    if not require_manager():
        return jsonify(message='forbidden'), 403
    data = request.get_json() or {}
    code = (data.get('code') or '').strip()
    name = (data.get('name') or '').strip()
    if not code or not name:
        return jsonify(message='code and name are required'), 400
    if Warehouse.query.filter_by(warehouse_code=code).first():
        return jsonify(message='code already exists'), 409
    try:
        w = Warehouse(
            warehouse_code=code,
            warehouse_name=name,
            location=(data.get('location') or '').strip() or None,
            status=(data.get('status') or 'active'),
            manager_id=data.get('manager_id'),
        )
        db.session.add(w)
        db.session.commit()
        return jsonify(item=_wh_to_dict(w)), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify(message='invalid or duplicate'), 400


@bp.put('/<int:wid>')
@jwt_required()
def update_warehouse(wid: int):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    w = Warehouse.query.get(wid)
    if not w:
        return jsonify(message='not found'), 404
    data = request.get_json() or {}
    if 'code' in data:
        new_code = (data.get('code') or '').strip()
        if not new_code:
            return jsonify(message='code required'), 400
        if new_code != w.warehouse_code and Warehouse.query.filter_by(warehouse_code=new_code).first():
            return jsonify(message='code already exists'), 409
        w.warehouse_code = new_code
    field_mapping = {'name': 'warehouse_name', 'location': 'location', 'status': 'status', 'manager_id': 'manager_id'}
    for frontend_field, backend_field in field_mapping.items():
        if frontend_field in data:
            val = data[frontend_field]
            if backend_field == 'manager_id':
                setattr(w, backend_field, val if val else None)
            else:
                setattr(w, backend_field, (val or '').strip() if isinstance(val, str) else val)
    try:
        db.session.commit()
        return jsonify(item=_wh_to_dict(w))
    except IntegrityError:
        db.session.rollback()
        return jsonify(message='invalid or duplicate'), 400


@bp.delete('/<int:wid>')
@jwt_required()
def delete_warehouse(wid: int):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    w = Warehouse.query.get(wid)
    if not w:
        return jsonify(message='not found'), 404
    # Protect if referenced by stock (FK constraints will block if used)
    try:
        db.session.delete(w)
        db.session.commit()
        return jsonify(message='deleted')
    except IntegrityError:
        db.session.rollback()
        return jsonify(message='cannot delete warehouse in use'), 400
