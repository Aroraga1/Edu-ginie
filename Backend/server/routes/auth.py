from flask import Blueprint, request, jsonify, session
from datetime import timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from bson import ObjectId
from ..extensions import mongo
from ..utils.otp_utils import generate_otp, store_otp, verify_otp


auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['GET', 'POST', 'OPTIONS'])
def register():
    """Direct registration without OTP"""
    if request.method == 'OPTIONS':
        return '', 200
    if request.method == 'GET':
        # Allow GET for React Router navigation - just return success
        # React Router will handle rendering the page
        return jsonify({'message': 'OK'}), 200
    data = request.get_json() or request.form or {}
    full_name = (data.get('fullName') or data.get('name') or '').strip()
    username = (data.get('username') or data.get('email', '').split('@')[0] or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    confirm_password = data.get('confirmPassword') or password
    age = data.get('age')
    education = (data.get('education') or '').strip() or 'Student'
    language = (data.get('language') or '').strip() or 'English'
    
    if not all([full_name, email, password]):
        return jsonify({'success': False, 'msg': 'Missing required fields', 'message': 'Missing required fields'}), 400
    if password != confirm_password:
        return jsonify({'success': False, 'msg': 'Passwords do not match', 'message': 'Passwords do not match'}), 400
    if len(password) < 6:
        return jsonify({'success': False, 'msg': 'Password too short', 'message': 'Password must be at least 6 characters'}), 400
    if mongo.db.users.find_one({'$or': [{'email': email}, {'username': username}]}):
        return jsonify({'success': False, 'msg': 'User exists', 'message': 'Email or username already exists'}), 409
    
    try:
        result = mongo.db.users.insert_one({
            'username': username,
            'full_name': full_name,
            'name': full_name,
            'email': email,
            'password': generate_password_hash(password),
            'age': int(age) if age else None,
            'education': education,
            'language': language,
            'created_at': datetime.utcnow()
        })
        session['user_id'] = str(result.inserted_id)
        session['user_name'] = full_name
        session['user_email'] = email
        session.permanent = True  # Mark session as permanent to ensure cookie is saved
        return jsonify({'success': True, 'msg': 'Registration successful', 'message': 'Account created successfully'})
    except Exception as e:
        return jsonify({'success': False, 'msg': f'Registration failed: {str(e)}', 'message': 'Registration failed'}), 500


@auth_bp.route('/login', methods=['GET', 'POST', 'OPTIONS'])
def login():
    """Login endpoint"""
    if request.method == 'OPTIONS':
        return '', 200
    if request.method == 'GET':
        # Allow GET for React Router navigation
        return jsonify({'message': 'OK'}), 200
    data = request.get_json() or {}
    identifier = (data.get('email') or data.get('identifier') or '').strip()
    password = data.get('password') or ''
    
    if not identifier or not password:
        return jsonify({'success': False, 'message': 'Email/username and password are required'}), 400
    
    # Try to find user by email or username (identifier can be either)
    identifier_lower = identifier.lower()
    user = mongo.db.users.find_one({
        '$or': [
            {'email': identifier_lower},
            {'username': identifier}
        ]
    })
    
    if not user:
        print(f"Login attempt failed: User not found for identifier: {identifier}")
        return jsonify({'success': False, 'message': 'Invalid email/username or password'}), 401
    
    # Check if user has password field
    stored_password = user.get('password', '')
    if not stored_password:
        print(f"Login attempt failed: User {identifier} has no password stored")
        return jsonify({'success': False, 'message': 'Account setup incomplete. Please register again.'}), 401
    
    # Check password
    password_valid = check_password_hash(stored_password, password)
    if not password_valid:
        print(f"Login attempt failed: Invalid password for user: {identifier}")
        return jsonify({'success': False, 'message': 'Invalid email/username or password'}), 401
    
    print(f"Login successful for user: {user.get('email')} ({user.get('username')})")
    session['user_id'] = str(user['_id'])
    session['user_name'] = user.get('full_name') or user.get('name')
    session['user_email'] = user['email']
    # Mark session as permanent to ensure cookie is saved
    session.permanent = True
    # Force session to be marked as modified
    session.modified = True
    print(f"Login: Session set with user_id: {session.get('user_id')}, Session keys: {list(session.keys())}")
    return jsonify({'success': True, 'message': 'Login successful'})


@auth_bp.route('/logout', methods=['POST', 'GET'])
def logout():
    session.clear()
    return jsonify({'success': True})


@auth_bp.route('/request_otp', methods=['POST'])
def request_otp():
    """Request OTP - simplified to work with direct registration"""
    data = request.get_json() or request.form
    
    name = (data.get('name') or '').strip()
    username = (data.get('username') or data.get('email', '').split('@')[0] or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    age = data.get('age')
    education = (data.get('education') or '').strip() or 'Student'
    language = (data.get('language') or '').strip() or 'English'
    
    # Validation
    if not all([name, email, password]):
        return jsonify({'msg': 'Missing required fields', 'otp': None}), 400
    
    if len(password) < 6:
        return jsonify({'msg': 'Password too short', 'otp': None}), 400
    
    # Check if user already exists
    if mongo.db.users.find_one({'$or': [{'username': username}, {'email': email}]}):
        return jsonify({'msg': 'User exists', 'otp': None}), 409
    
    # For simplicity, just return a mock OTP (auto-verify in frontend)
    otp = generate_otp()
    
    # Store registration data with OTP (simplified)
    registration_data = {
        'username': username,
        'email': email,
        'password': password,
        'name': name,
        'age': int(age) if age else None,
        'education': education,
        'language': language,
    }
    
    store_otp(email, otp, 'register', registration_data, expires_minutes=10)
    session['flow'] = {'mode': 'register', 'email': email}
    
    # Return OTP for frontend to use
    return jsonify({
        'msg': 'OTP generated for registration',
        'otp': otp
    })


@auth_bp.route('/verify_otp', methods=['POST'])
def verify_otp_route():
    """Verify OTP and complete registration"""
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    otp = (data.get('otp') or '').strip()
    
    if not email or not otp:
        return jsonify({'msg': 'Missing fields'}), 400
    
    # Check session flow
    flow = session.get('flow')
    if not flow or flow.get('email') != email:
        return jsonify({'msg': 'Session missing'}), 400
    
    # Verify OTP
    registration_data = verify_otp(email, otp, 'register')
    
    if not registration_data:
        return jsonify({'msg': 'Invalid or expired OTP'}), 401
    
    # Check if user already exists (double-check)
    if mongo.db.users.find_one({'$or': [
        {'username': registration_data['username']},
        {'email': email}
    ]}):
        session.pop('flow', None)
        return jsonify({'msg': 'User exists'}), 409
    
    # Create user
    try:
        from werkzeug.security import generate_password_hash
        result = mongo.db.users.insert_one({
            'username': registration_data['username'],
            'email': email,
            'password': generate_password_hash(registration_data['password']),
            'full_name': registration_data['name'],
            'name': registration_data['name'],
            'age': registration_data.get('age'),
            'education': registration_data.get('education'),
            'language': registration_data.get('language'),
            'photo': registration_data.get('photo'),
            'created_at': datetime.utcnow()
        })
        
        session.pop('flow', None)
        
        # Set session for auto-login
        session['user_id'] = str(result.inserted_id)
        session['user_name'] = registration_data['name']
        session['user_email'] = email
        
        return jsonify({'msg': 'Registration successful'})
        
    except Exception as e:
        session.pop('flow', None)
        return jsonify({'msg': f'Registration failed: {str(e)}'}), 500


@auth_bp.route('/me', methods=['POST', 'OPTIONS'])
def me():
    """Get current user info - POST only for API calls"""
    if request.method == 'OPTIONS':
        return '', 200
    
    # Debug: Print all cookies received
    print(f"Me endpoint: Cookies received: {request.cookies}")
    print(f"Me endpoint: Session keys before check: {list(session.keys())}")
    
    if 'user_id' not in session:
        print(f"Me endpoint: No user_id in session. Session keys: {list(session.keys())}")
        print(f"Me endpoint: Request origin: {request.headers.get('Origin')}")
        print(f"Me endpoint: Request referer: {request.headers.get('Referer')}")
        return jsonify({'msg': 'Unauthorized', 'message': 'Please log in'}), 401
    
    try:
        user_id_str = session.get('user_id')
        if not user_id_str:
            return jsonify({'msg': 'Unauthorized', 'message': 'Session expired'}), 401
        
        try:
            user = mongo.db.users.find_one({'_id': ObjectId(user_id_str)})
        except Exception as e:
            print(f"Error parsing ObjectId: {e}")
            session.clear()
            return jsonify({'msg': 'Invalid session', 'message': 'Please log in again'}), 401
        
        if not user:
            print(f"User not found for ID: {user_id_str}")
            session.clear()
            return jsonify({'msg': 'User not found', 'message': 'Please log in again'}), 404
        
        return jsonify({
            'user': {
                'id': str(user['_id']),
                'username': user.get('username'),
                'email': user.get('email'),
                'name': user.get('name') or user.get('full_name'),
                'age': user.get('age'),
                'education': user.get('education'),
                'language': user.get('language'),
                'photo': user.get('photo')
            }
        })
    except Exception as e:
        print(f"Error in /me endpoint: {e}")
        session.clear()
        return jsonify({'msg': 'Server error', 'message': 'Please try again'}), 500


