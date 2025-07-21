#!/usr/bin/env python3
"""
Debug script to reproduce the 'float' object has no attribute 'strip' error
"""
import pandas as pd
import numpy as np

print("🔍 Reproducing the 'float' object has no attribute 'strip' error...")

# Load the problematic email
df = pd.read_csv('data/v2/my_gmail_dataset_v2_expanded.csv', nrows=5)

# Get the first email with NaN sender_email
email_data = df.iloc[1].to_dict()  # Second row has NaN sender_email

print(f"📧 Email data types:")
print(f"   subject: {type(email_data['subject'])} = {repr(email_data['subject'])}")
print(f"   body: {type(email_data['body'])} = {repr(email_data['body'])}")
print(f"   sender_email: {type(email_data['sender_email'])} = {repr(email_data['sender_email'])}")

print(f"\n💥 Attempting the problematic code from classify_with_gpt.py:")

try:
    # This is the EXACT code from lines 41-44 that fails
    subject = email_data.get("subject", "").strip()
    print(f"✅ subject.strip() worked: {repr(subject)}")
except Exception as e:
    print(f"❌ subject.strip() failed: {e}")

try:
    body = email_data.get("body", "").strip()  
    print(f"✅ body.strip() worked: {repr(body)}")
except Exception as e:
    print(f"❌ body.strip() failed: {e}")

try:
    sender_email = email_data.get("sender_email", "").strip()
    print(f"✅ sender_email.strip() worked: {repr(sender_email)}")
except Exception as e:
    print(f"❌ sender_email.strip() failed: {e}")
    print(f"   sender_email type: {type(email_data['sender_email'])}")
    print(f"   sender_email value: {email_data['sender_email']}")
    print(f"   Is NaN: {pd.isna(email_data['sender_email'])}")

print(f"\n🛠️  Proposed fix:")

def safe_strip(value):
    """Safely convert to string and strip, handling NaN/None/float values"""
    if pd.isna(value) or value is None:
        return ""
    return str(value).strip()

# Test the fix
print(f"✅ Fixed sender_email: {repr(safe_strip(email_data['sender_email']))}")
print(f"✅ Fixed subject: {repr(safe_strip(email_data['subject']))}")
print(f"✅ Fixed body: {repr(safe_strip(email_data['body']))}") 