from flask import Blueprint, request, jsonify, redirect, current_app, url_for
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import check_password_hash, generate_password_hash
from extensions import db
from models import User, Role
from authlib.integrations.flask_client import OAuth
import os

bp = Blueprint('auth', __name__)


def _user_to_dict(u: User):
    return {
        'id': u.user_id,
        'username': u.username,
        'full_name': u.full_name,
        'role': u.role.role_name if u.role else None,
        'status': u.status,
    }


@bp.post('/login')
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify(message='username and password required'), 400

    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify(message='invalid credentials'), 401

    # Use hashed password check
    valid = check_password_hash(user.password_hash, password)

    if not valid or user.status != 'active':
        return jsonify(message='invalid credentials'), 401

    token = create_access_token(
        identity=str(user.user_id),
        additional_claims={'role': user.role.role_name if user.role else None}
    )
    return jsonify(access_token=token, user=_user_to_dict(user))


@bp.get('/me')
@jwt_required()
def me():
    ident = get_jwt_identity()
    user = User.query.get(int(ident))
    if not user:
        return jsonify(message='user not found'), 404
    return jsonify(user=_user_to_dict(user))


@bp.post('/set-password')
@jwt_required()
def set_password():
    # Simple endpoint to set pbkdf2 hash for demo
    ident = get_jwt_identity()
    user = User.query.get(int(ident))
    if not user:
        return jsonify(message='user not found'), 404
    data = request.get_json() or {}
    new_password = data.get('new_password')
    if not new_password:
        return jsonify(message='new_password required'), 400
    # Store hashed password
    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify(message='password updated')


# ---------------------
# Google OIDC SSO
# ---------------------
def _get_oauth():

    oauth = getattr(current_app, '_oauth_client', None)
    if oauth is None:
        oauth = OAuth(current_app)
        issuer = os.getenv('OIDC_ISSUER', 'https://accounts.google.com')
        client_id = os.getenv('OIDC_CLIENT_ID')
        client_secret = os.getenv('OIDC_CLIENT_SECRET')
        server_metadata_url = issuer.rstrip('/') + '/.well-known/openid-configuration'
        oauth.register(
            name='google',
            client_id=client_id,
            client_secret=client_secret,
            server_metadata_url=server_metadata_url,
            client_kwargs={'scope': 'openid email profile'},
        )
        current_app._oauth_client = oauth
    return oauth


@bp.get('/sso/login')
def sso_login():
    oauth = _get_oauth()
    google = oauth.create_client('google')
    # Always use current host to avoid cookie host mismatch
    redirect_uri = url_for('auth.sso_callback', _external=True)
    return google.authorize_redirect(redirect_uri, prompt='select_account')


@bp.get('/sso/callback')
def sso_callback():
    oauth = _get_oauth()
    google = oauth.create_client('google')
    try:
        token = google.authorize_access_token()
    except Exception as e:
        # State mismatch or other OAuth error: restart login flow
        return redirect(url_for('auth.sso_login'))
    # Prefer userinfo endpoint; fallback to ID token
    info = token.get('userinfo') or google.parse_id_token(token)
    if not info:
        return jsonify(message='oidc userinfo missing'), 400
    email = info.get('email')
    name = info.get('name') or email.split('@')[0]
    if not email:
        return jsonify(message='email not found in oidc claims'), 400

    # Find or create user mapped by email as username
    user = User.query.filter_by(username=email).first()
    if not user:
        # role default: staff; ensure role exists
        role = Role.query.filter_by(role_name='staff').first()
        if not role:
            role = Role(role_name='staff')
            db.session.add(role)
            db.session.commit()
        # Create SSO user with empty local password
        user = User(username=email, full_name=name, role_id=role.role_id, status='active', password_hash='')
        db.session.add(user)
        db.session.commit()

    token_str = create_access_token(identity=str(user.user_id), additional_claims={'role': user.role.role_name if user.role else None})
    # Redirect back to SPA with token in URL fragment to avoid logging it server-side
    front = '/'  # served by Flask static at root
    return redirect(f"{front}#token={token_str}")


# ---------------------
# GitHub OAuth2 SSO
# ---------------------
@bp.get('/sso/github/login')
def sso_github_login():
    oauth = _get_oauth()
    # Register GitHub client if not already registered
    if not hasattr(oauth, 'github'):
        client_id = os.getenv('GITHUB_CLIENT_ID')
        client_secret = os.getenv('GITHUB_CLIENT_SECRET')
        oauth.register(
            name='github',
            client_id=client_id,
            client_secret=client_secret,
            access_token_url='https://github.com/login/oauth/access_token',
            authorize_url='https://github.com/login/oauth/authorize',
            api_base_url='https://api.github.com/',
            client_kwargs={'scope': 'user:email'},
        )
    github = oauth.create_client('github')
    redirect_uri = url_for('auth.sso_github_callback', _external=True)
    return github.authorize_redirect(redirect_uri)


@bp.get('/sso/github/callback')
def sso_github_callback():
    oauth = _get_oauth()
    github = oauth.create_client('github')
    try:
        token = github.authorize_access_token()
    except Exception:
        return redirect(url_for('auth.sso_github_login'))
    
    # Get user info from GitHub API
    resp = github.get('user', token=token)
    info = resp.json()
    if not info:
        return jsonify(message='github user info missing'), 400
    
    # GitHub might not expose email publicly, try to get primary verified email
    email = info.get('email')
    if not email:
        emails_resp = github.get('user/emails', token=token)
        emails = emails_resp.json()
        for e in emails:
            if e.get('primary') and e.get('verified'):
                email = e.get('email')
                break
    
    name = info.get('name') or info.get('login') or email
    username = email or info.get('login')  # fallback to login if no email
    
    if not username:
        return jsonify(message='github username/email not found'), 400

    # Find or create user
    user = User.query.filter_by(username=username).first()
    if not user:
        role = Role.query.filter_by(role_name='staff').first()
        if not role:
            role = Role(role_name='staff')
            db.session.add(role)
            db.session.commit()
        user = User(username=username, full_name=name, role_id=role.role_id, status='active', password_hash='')
        db.session.add(user)
        db.session.commit()

    token_str = create_access_token(identity=str(user.user_id), additional_claims={'role': user.role.role_name if user.role else None})
    front = '/'
    return redirect(f"{front}#token={token_str}")


