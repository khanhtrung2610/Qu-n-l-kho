from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text
from extensions import db

bp = Blueprint('stock', __name__)


@bp.get('/recent')
@jwt_required()
def recent_transactions():
    """Get recent transactions by type (IN/OUT/ADJUST)"""
    txn_type = request.args.get('type', '').upper()
    limit = request.args.get('limit', 20, type=int)
    
    if txn_type not in ('IN', 'OUT', 'ADJUST'):
        return jsonify(error='Invalid type'), 400
    
    query = text("""
        SELECT 
            it.transaction_id,
            it.transaction_code AS txn_code,
            it.product_id,
            p.sku AS product_sku,
            p.product_name AS product_name,
            it.warehouse_id,
            w.warehouse_code,
            w.warehouse_name,
            it.quantity,
            it.transaction_type AS txn_type,
            it.reason,
            it.reference_document AS ref_document,
            it.created_at,
            u.full_name AS created_by_name
        FROM inventory_transactions it
        JOIN products p ON it.product_id = p.product_id
        JOIN warehouses w ON it.warehouse_id = w.warehouse_id
        JOIN users u ON it.created_by = u.user_id
        WHERE it.transaction_type = :txn_type
        ORDER BY it.created_at DESC
        LIMIT :limit
    """)
    
    result = db.session.execute(query, {'txn_type': txn_type, 'limit': limit})
    rows = result.mappings().all()
    
    items = []
    for r in rows:
        items.append({
            'id': r['transaction_id'],
            'txn_code': r['txn_code'],
            'product_id': r['product_id'],
            'product_sku': r['product_sku'],
            'product_name': r['product_name'],
            'warehouse_id': r['warehouse_id'],
            'warehouse_code': r['warehouse_code'],
            'warehouse_name': r['warehouse_name'],
            'quantity': r['quantity'],
            'txn_type': r['txn_type'],
            'reason': r['reason'],
            'ref_document': r['ref_document'],
            'created_at': r['created_at'].isoformat() if r['created_at'] else None,
            'created_by_name': r['created_by_name']
        })
    
    return jsonify(items=items)


def _call_proc(proc_sql: str, params: dict):
    with db.session.begin():
        db.session.execute(text(proc_sql), params)


@bp.post('/in')
@jwt_required()
def stock_in():
    ident = get_jwt_identity()
    data = request.get_json() or {}
    quantity = data.get('quantity')
    if not isinstance(quantity, int) or quantity <= 0:
        return jsonify(message='quantity must be a positive integer'), 400
    _call_proc(
        'CALL sp_stock_in(:p_product_id, :p_warehouse_id, :p_quantity, :p_supplier_id, :p_created_by, :p_reason, :p_reference_document)',
        {
            'p_product_id': data.get('product_id'),
            'p_warehouse_id': data.get('warehouse_id'),
            'p_quantity': quantity,
            'p_supplier_id': data.get('supplier_id'),
            'p_created_by': int(ident),
            'p_reason': data.get('reason'),
            'p_reference_document': data.get('ref_document'),
        },
    )
    return jsonify(message='ok')


@bp.post('/out')
@jwt_required()
def stock_out():
    ident = get_jwt_identity()
    data = request.get_json() or {}
    quantity = data.get('quantity')
    if not isinstance(quantity, int) or quantity <= 0:
        return jsonify(message='quantity must be a positive integer'), 400
    _call_proc(
        'CALL sp_stock_out(:p_product_id, :p_warehouse_id, :p_quantity, :p_created_by, :p_reason, :p_reference_document)',
        {
            'p_product_id': data.get('product_id'),
            'p_warehouse_id': data.get('warehouse_id'),
            'p_quantity': quantity,
            'p_created_by': int(ident),
            'p_reason': data.get('reason'),
            'p_reference_document': data.get('ref_document'),
        },
    )
    return jsonify(message='ok')


@bp.post('/adjust')
@jwt_required()
def stock_adjust():
    ident = get_jwt_identity()
    data = request.get_json() or {}
    signed_delta = data.get('signed_delta')
    if not isinstance(signed_delta, int) or signed_delta == 0:
        return jsonify(message='signed_delta must be a non-zero integer'), 400
    _call_proc(
        'CALL sp_stock_adjust(:p_product_id, :p_warehouse_id, :p_delta, :p_created_by, :p_reason, :p_reference_document)',
        {
            'p_product_id': data.get('product_id'),
            'p_warehouse_id': data.get('warehouse_id'),
            'p_delta': signed_delta,
            'p_created_by': int(ident),
            'p_reason': data.get('reason'),
            'p_reference_document': data.get('ref_document'),
        },
    )
    return jsonify(message='ok')
