import os
import time
import json
import re
import hashlib
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
from flask_pymongo import PyMongo
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import io

from PyPDF2 import PdfReader
from bson import ObjectId
from bson.errors import InvalidId

from google import genai

from server import create_app

app = create_app()
    
if __name__ == "__main__":
    app.run(debug=True)