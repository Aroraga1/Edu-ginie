import os
from flask import Flask, request, jsonify
from flask.sessions import SecureCookieSessionInterface
from .config import Config
from .extensions import mongo
from .routes.auth import auth_bp
from .routes.ai_hub import ai_hub_bp
from .routes.exam import exam_bp
from .routes.profile import profile_bp
from .routes.user_data import user_data_bp


class CustomSessionInterface(SecureCookieSessionInterface):
    """Custom session interface that doesn't use partitioned cookies"""
    
    def open_session(self, app, request):
        """Override to load session from cookie - ensure proper deserialization"""
        cookie_name = self.get_cookie_name(app)
        val = request.cookies.get(cookie_name)
        
        print(f"CustomSessionInterface: open_session called, cookie_name: {cookie_name}")
        print(f"CustomSessionInterface: Cookie value received: {val[:100] if val else 'None'}...")  # Print first 100 chars
        
        if not val:
            print("CustomSessionInterface: No cookie value found")
            return self.session_class()
        
        s = self.get_signing_serializer(app)
        if s is None:
            print("CustomSessionInterface: No signing serializer available")
            return self.session_class()
        
        max_age = app.permanent_session_lifetime.total_seconds() if app.permanent_session_lifetime else None
        
        try:
            # Try to load the signed cookie
            data = s.loads(val, max_age=max_age)
            session_data = self.session_class(data)
            print(f"CustomSessionInterface: Successfully loaded session with keys: {list(session_data.keys())}")
            print(f"CustomSessionInterface: Session user_id: {session_data.get('user_id')}")
            return session_data
        except Exception as e:
            print(f"CustomSessionInterface: Error loading session: {type(e).__name__}: {e}")
            print(f"CustomSessionInterface: Cookie value type: {type(val)}, length: {len(val) if val else 0}")
            # Try to parse as JSON if it's not signed (fallback for debugging)
            try:
                import json
                if val.startswith('{'):
                    data = json.loads(val)
                    print(f"CustomSessionInterface: Parsed as JSON, keys: {list(data.keys())}")
                    session_data = self.session_class(data)
                    return session_data
            except:
                pass
            return self.session_class()
    
    def save_session(self, app, session, response):
        """Override to remove partitioned parameter - fixes Flask/Werkzeug compatibility"""
        domain = self.get_cookie_domain(app)
        path = self.get_cookie_path(app)
        cookie_name = self.get_cookie_name(app)
        httponly = self.get_cookie_httponly(app)
        secure = self.get_cookie_secure(app)
        samesite = self.get_cookie_samesite(app)
        
        # Check if session should be deleted (empty session dict)
        session_modified = session.modified if hasattr(session, 'modified') else False
        if not session:
            if session_modified:
                response.delete_cookie(
                    cookie_name,
                    domain=domain,
                    path=path
                )
            return
        
        # Save session cookie without partitioned parameter
        # Ensure cookie is set with proper attributes for cross-origin requests
        expires = self.get_expiration_time(app, session)
        
        # Debug: Print session data being saved
        session_data = dict(session)
        print(f"CustomSessionInterface: Saving session with keys: {list(session_data.keys())}")
        
        # Get signing serializer - this signs the cookie for security
        s = self.get_signing_serializer(app)
        if s is None:
            print("CustomSessionInterface: Warning - No signing serializer available!")
            return
        
        # Serialize and sign the session data
        cookie_value = s.dumps(dict(session))
        print(f"CustomSessionInterface: Cookie value length: {len(cookie_value)}, starts with: {cookie_value[:50]}...")
        
        response.set_cookie(
            cookie_name,
            cookie_value,
            expires=expires,
            httponly=httponly,
            domain=None,  # Don't set domain - let browser use default (allows localhost to work)
            path=path if path else '/',  # Ensure path is set
            secure=secure,
            samesite='Lax'  # Use Lax instead of Strict for better cross-origin support
            # Note: partitioned parameter explicitly removed for compatibility
        )
        print(f"CustomSessionInterface: Cookie '{cookie_name}' set in response with path={path if path else '/'}")


def create_app(config_class: type[Config] | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class or Config())

    # Fix session cookie compatibility issue
    app.session_interface = CustomSessionInterface()

    # CORS headers for frontend
    @app.after_request
    def after_request(response):
        # Allow both ports 8080 and 8081 for frontend
        origin = request.headers.get('Origin', '')
        allowed_origins = ['http://localhost:8080', 'http://localhost:8081', 'http://127.0.0.1:8080', 'http://127.0.0.1:8081']
        if origin in allowed_origins:
            response.headers.add('Access-Control-Allow-Origin', origin)
        else:
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8080')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    # Init extensions
    mongo.init_app(app)

    # Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(ai_hub_bp)
    app.register_blueprint(exam_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(user_data_bp)

    # Catch-all for undefined API routes
    @app.errorhandler(404)
    def handle_404(error):
        """Handle 404 errors - return JSON for API routes, allow frontend to handle page routes"""
        # If it's a request for an API endpoint, return JSON error
        if request.path.startswith('/api') or \
           request.path.startswith('/profile/') or \
           request.path.startswith('/ai_hub/') or \
           request.path in ['/register', '/login', '/logout', '/me', '/request_otp', '/verify_otp']:
            return jsonify({'error': 'API endpoint not found', 'path': request.path}), 404
        # Otherwise, let the frontend handle it (this won't be reached in production)
        return jsonify({'message': 'Not found'}), 404

    @app.errorhandler(405)
    def handle_405(error):
        """Handle 405 Method Not Allowed"""
        return jsonify({'error': 'Method not allowed', 'path': request.path, 'method': request.method}), 405

    return app


