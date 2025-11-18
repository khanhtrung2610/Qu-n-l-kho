from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash
from sqlalchemy.orm import joinedload
from extensions import db
from models import User, Role

bp = Blueprint('users', __name__)


def require_manager():
    ident = get_jwt_identity()
    try:
        uid = int(ident)
    except Exception:
        return False
    u = User.query.get(uid)
    return bool(u and u.role and u.role.role_name == 'manager')


def _user_to_dict(u: User):
    return {
        'id': u.user_id,
        'username': u.username,
        'full_name': u.full_name,
        'role': u.role.role_name if u.role else None,
        'status': u.status,
        'created_at': u.created_at.isoformat() if u.created_at else None,
    }


@bp.get('/')
@jwt_required()
def list_users():
    if not require_manager():
        return jsonify(message='forbidden'), 403
    q = User.query.options(joinedload(User.role)).order_by(User.user_id.desc()).all()
    return jsonify(items=[_user_to_dict(u) for u in q])


@bp.post('/')
@jwt_required()
def create_user():
    if not require_manager():
        return jsonify(message='forbidden'), 403
    data = request.get_json() or {}
    username = data.get('username')
    full_name = data.get('full_name')
    role_name = data.get('role')
    password = data.get('password')
    if not (username and full_name and role_name and password):
        return jsonify(message='username, full_name, role, password required'), 400
    role = Role.query.filter_by(role_name=role_name).first()
    if not role:
        return jsonify(message='invalid role'), 400
    if User.query.filter_by(username=username).first():
        return jsonify(message='username already exists'), 409
    user = User(
        username=username,
        full_name=full_name,
        role_id=role.role_id,
        status='active',
        password_hash=generate_password_hash(password),
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(item=_user_to_dict(user)), 201


@bp.put('/<int:uid>')
@jwt_required()
def update_user(uid: int):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    user = User.query.get(uid)
    if not user:
        return jsonify(message='not found'), 404
    data = request.get_json() or {}
    if 'full_name' in data:
        user.full_name = data['full_name']
    if 'status' in data and data['status'] in ['active', 'inactive']:
        user.status = data['status']
    db.session.commit()
    return jsonify(item=_user_to_dict(user))


@bp.post('/<int:uid>/set-role')
@jwt_required()
def set_role(uid: int):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    data = request.get_json() or {}
    role_name = data.get('role')
    role = Role.query.filter_by(role_name=role_name).first()
    if not role:
        return jsonify(message='invalid role'), 400
    user = User.query.get(uid)
    if not user:
        return jsonify(message='not found'), 404
    user.role_id = role.role_id
    db.session.commit()
    return jsonify(item=_user_to_dict(user))


@bp.post('/<int:uid>/activate')
@jwt_required()
def activate(uid: int):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    user = User.query.get(uid)
    if not user:
        return jsonify(message='not found'), 404
    user.status = 'active'
    db.session.commit()
    return jsonify(item=_user_to_dict(user))


@bp.post('/<int:uid>/deactivate')
@jwt_required()
def deactivate(uid: int):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    user = User.query.get(uid)
    if not user:
        return jsonify(message='not found'), 404
    user.status = 'inactive'
    db.session.commit()
    return jsonify(item=_user_to_dict(user))


@bp.post('/<int:uid>/reset-password')
@jwt_required()
def reset_password(uid: int):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    data = request.get_json() or {}
    new_password = data.get('new_password')
    if not new_password:
        return jsonify(message='new_password required'), 400
    user = User.query.get(uid)
    if not user:
        return jsonify(message='not found'), 404
    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify(message='password reset ok')


@bp.delete('/<int:uid>')
@jwt_required()
def delete_user(uid: int):
    if not require_manager():
        return jsonify(message='forbidden'), 403
    ident = get_jwt_identity()
    try:
        me = int(ident)
    except Exception:
        me = None
    user = User.query.get(uid)
    if not user:
        return jsonify(message='not found'), 404
    # Do not allow deleting yourself
    if me and user.user_id == me:
        return jsonify(message='cannot delete yourself'), 400
    # Do not allow deleting managers
    if user.role and user.role.role_name == 'manager':
        return jsonify(message='cannot delete manager'), 400
    db.session.delete(user)
    db.session.commit()
    return ('', 204)
