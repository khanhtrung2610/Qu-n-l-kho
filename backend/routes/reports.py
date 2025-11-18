from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from extensions import db

bp = Blueprint('reports', __name__)


@bp.get('/current-stock')
@jwt_required()
def current_stock():
    rows = db.session.execute(db.text('SELECT * FROM v_current_stock')).mappings().all()
    items = []
    for r in rows:
        d = dict(r)
        # Keep DB view unchanged but expose stable names for frontend
        if 'qty_on_hand' not in d:
            d['qty_on_hand'] = d.get('stock_quantity')
        if 'reorder_level' not in d:
            d['reorder_level'] = d.get('min_stock_level')
        items.append(d)
    return jsonify(items=items)


@bp.get('/low-stock')
@jwt_required()
def low_stock():
    rows = db.session.execute(db.text('SELECT * FROM v_low_stock')).mappings().all()
    items = []
    for r in rows:
        d = dict(r)
        if 'qty_on_hand' not in d:
            d['qty_on_hand'] = d.get('stock_quantity')
        if 'reorder_level' not in d:
            d['reorder_level'] = d.get('min_stock_level')
        items.append(d)
    return jsonify(items=items)


@bp.get('/monthly-in-out')
@jwt_required()
def monthly_in_out():
    date_from = request.args.get('from')
    date_to = request.args.get('to')

    where = []
    params = {}
    if date_from:
        where.append("DATE(created_at) >= :from")
        params['from'] = date_from
    if date_to:
        where.append("DATE(created_at) <= :to")
        params['to'] = date_to

    # Default to current month if no date filters
    if not date_from and not date_to:
        import datetime
        now = datetime.datetime.now()
        current_month_start = now.replace(day=1).strftime('%Y-%m-%d')
        next_month = now.replace(day=28) + datetime.timedelta(days=4)
        current_month_end = (next_month - datetime.timedelta(days=next_month.day)).strftime('%Y-%m-%d')
        where.append("DATE(created_at) >= :from")
        where.append("DATE(created_at) <= :to")
        params['from'] = current_month_start
        params['to'] = current_month_end

    where_sql = (" WHERE " + " AND ".join(where)) if where else ""
    sql = db.text(
        f"""
        SELECT
          DATE_FORMAT(created_at, '%Y-%m') AS ym,
          product_id,
          warehouse_id,
          SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE 0 END) AS qty_in,
          SUM(CASE WHEN transaction_type = 'OUT' THEN quantity ELSE 0 END) AS qty_out,
          COUNT(*) AS txn_count,
          SUM(CASE WHEN transaction_type = 'IN' THEN 1 ELSE 0 END) AS txn_in_count,
          SUM(CASE WHEN transaction_type = 'OUT' THEN 1 ELSE 0 END) AS txn_out_count
        FROM inventory_transactions
        {where_sql}
        GROUP BY ym, product_id, warehouse_id
        ORDER BY ym DESC
        """
    )
    rows = db.session.execute(sql, params)
    return jsonify(items=[dict(r) for r in rows.mappings().all()])


@bp.get('/top-moving')
@jwt_required()
def top_moving():
    # Calculate top moving products from transactions in last 30 days
    sql = db.text("""
        SELECT
          p.product_id,
          p.sku,
          p.product_name AS name,
          SUM(ABS(CASE WHEN it.transaction_type IN ('IN','OUT','ADJUST') THEN it.quantity ELSE 0 END)) AS total_movement_30d
        FROM inventory_transactions it
        JOIN products p ON p.product_id = it.product_id
        WHERE it.created_at >= (CURRENT_DATE - INTERVAL 30 DAY)
        GROUP BY p.product_id, p.sku, p.product_name
        ORDER BY total_movement_30d DESC
        LIMIT 10
    """)
    rows = db.session.execute(sql).mappings().all()
    return jsonify(items=[dict(r) for r in rows])


@bp.get('/weekly-in-out')
@jwt_required()
def weekly_in_out():
    # Aggregate by ISO week using created_at; label as YYYY-WW (ISO year-week)
    sql = db.text(
        """
        SELECT
          DATE_FORMAT(created_at, '%x-%v') AS yw,
          product_id,
          warehouse_id,
          SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE 0 END) AS qty_in,
          SUM(CASE WHEN transaction_type = 'OUT' THEN quantity ELSE 0 END) AS qty_out,
          COUNT(*) AS txn_count
        FROM inventory_transactions
        GROUP BY yw, product_id, warehouse_id
        ORDER BY yw DESC
        """
    )
    rows = db.session.execute(sql).mappings().all()
    return jsonify(items=[dict(r) for r in rows])


@bp.get('/txns')
@jwt_required()
def txns_detail():
    """
    Return detailed inventory transactions with optional filters:
    - from: YYYY-MM-DD (inclusive)
    - to: YYYY-MM-DD (inclusive)
    - warehouse_id: int
    - product_id: int
    Defaults to last 30 days if no date filters provided.
    """
    date_from = request.args.get('from')
    date_to = request.args.get('to')
    wid = request.args.get('warehouse_id', type=int)
    pid = request.args.get('product_id', type=int)

    where = []
    params = {}
    if date_from:
        where.append("DATE(t.created_at) >= :from")
        params['from'] = date_from
    if date_to:
        where.append("DATE(t.created_at) <= :to")
        params['to'] = date_to
    if wid:
        where.append("t.warehouse_id = :wid")
        params['wid'] = wid
    if pid:
        where.append("t.product_id = :pid")
        params['pid'] = pid

    # Default: last 30 days if no date filter
    if not date_from and not date_to:
        where.append("t.created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)")

    where_sql = (" WHERE " + " AND ".join(where)) if where else ""
    sql = db.text(
        f"""
        SELECT
          t.transaction_id AS id,
          t.created_at,
          t.transaction_type AS txn_type,
          t.quantity,
          t.reference_document AS ref_document,
          t.reason,
          p.sku,
          p.product_name,
          w.warehouse_code,
          u.username AS created_by,
          s.supplier_name
        FROM inventory_transactions t
        JOIN products p ON p.product_id = t.product_id
        JOIN warehouses w ON w.warehouse_id = t.warehouse_id
        LEFT JOIN suppliers s ON s.supplier_id = t.supplier_id
        JOIN users u ON u.user_id = t.created_by
        {where_sql}
        ORDER BY t.created_at DESC, t.transaction_id DESC
        LIMIT 500
        """
    )
    rows = db.session.execute(sql, params).mappings().all()
    return jsonify(items=[dict(r) for r in rows])


@bp.get('/daily-in-out')
@jwt_required()
def daily_in_out():
    sql = db.text(
        """
        SELECT
          DATE(created_at) AS yd,
          product_id,
          warehouse_id,
          SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE 0 END) AS qty_in,
          SUM(CASE WHEN transaction_type = 'OUT' THEN quantity ELSE 0 END) AS qty_out,
          COUNT(*) AS txn_count
        FROM inventory_transactions
        GROUP BY yd, product_id, warehouse_id
        ORDER BY yd DESC
        """
    )
    rows = db.session.execute(sql).mappings().all()
    return jsonify(items=[dict(r) for r in rows])
