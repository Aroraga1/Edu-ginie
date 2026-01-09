import random
import string
from datetime import datetime, timedelta
from ..extensions import mongo


def generate_otp() -> str:
    """Generate a 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))


def store_otp(email: str, otp: str, purpose: str, data: dict, expires_minutes: int = 10):
    """Store OTP in database with expiration"""
    expires_at = datetime.utcnow() + timedelta(minutes=expires_minutes)
    # Delete existing OTPs for this email and purpose
    mongo.db.otps.delete_many({'email': email, 'purpose': purpose})
    # Store new OTP with data
    mongo.db.otps.insert_one({
        'email': email,
        'otp': otp,
        'expires_at': expires_at,
        'purpose': purpose,
        'data': data,
        'created_at': datetime.utcnow()
    })


def verify_otp(email: str, otp: str, purpose: str) -> dict | None:
    """Verify OTP and return stored data if valid"""
    record = mongo.db.otps.find_one({
        'email': email,
        'purpose': purpose
    })
    
    if not record:
        return None
    
    if datetime.utcnow() > record['expires_at']:
        mongo.db.otps.delete_one({'_id': record['_id']})
        return None
    
    if record['otp'] != otp:
        return None
    
    # OTP is valid, return data and delete OTP
    data = record.get('data', {})
    mongo.db.otps.delete_one({'_id': record['_id']})
    return data

