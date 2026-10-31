#!/usr/bin/env python3
"""
=============================================================================
MEDICORE HOSPITAL MANAGEMENT SYSTEM - COMPANION DEV & PREVIEW RUNNER
=============================================================================
This script provides an out-of-the-box local HTTP REST server mirroring the
C++17 backend endpoints, enabling instant browser preview and testing without
requiring a pre-installed C++ compiler.

Usage:
    python run_mock_server.py
Then open http://localhost:8080 in your browser.
=============================================================================
"""

import http.server
import socketserver
import json
import os
import re
from datetime import datetime

PORT = 8080
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# =============================================================================
# IN-MEMORY DATABASE WITH REALISTIC SEED DATA
# =============================================================================
DB = {
    "users": {
        "admin": {
            "id": "USR-101",
            "username": "admin",
            "password": "admin123",
            "role": "admin",
            "fullName": "Chief Medical Officer (CMO)",
            "email": "admin@medicore-hospital.org",
            "phone": "+1 (555) 010-0001"
        },
        "dr.smith": {
            "id": "USR-102",
            "username": "dr.smith",
            "password": "doc123",
            "role": "doctor",
            "fullName": "Dr. Sarah Smith, MD",
            "email": "s.smith@medicore-hospital.org",
            "phone": "+1 (555) 010-0002",
            "doctorId": "DOC-101"
        },
        "dr.chen": {
            "id": "USR-103",
            "username": "dr.chen",
            "password": "doc123",
            "role": "doctor",
            "fullName": "Dr. Michael Chen, MD",
            "email": "m.chen@medicore-hospital.org",
            "phone": "+1 (555) 010-0003",
            "doctorId": "DOC-102"
        },
        "dr.davis": {
            "id": "USR-104",
            "username": "dr.davis",
            "password": "doc123",
            "role": "doctor",
            "fullName": "Dr. Emily Davis, MD",
            "email": "e.davis@medicore-hospital.org",
            "phone": "+1 (555) 010-0004",
            "doctorId": "DOC-103"
        },
        "john.doe": {
            "id": "USR-105",
            "username": "john.doe",
            "password": "pat123",
            "role": "patient",
            "fullName": "Johnathan Doe",
            "email": "john.doe@gmail.com",
            "phone": "+1 (555) 321-4567",
            "patientId": "PID-1001"
        }
    },
    "doctors": [
        {
            "doctorId": "DOC-101",
            "userId": "USR-102",
            "fullName": "Dr. Sarah Smith, MD",
            "specialization": "Cardiology",
            "department": "Cardiovascular Medicine",
            "licenseNumber": "LIC-CARDIO-991",
            "consultationFee": 150.0,
            "availableDays": "Mon, Wed, Fri",
            "availableHours": "09:00 AM - 04:00 PM"
        },
        {
            "doctorId": "DOC-102",
            "userId": "USR-103",
            "fullName": "Dr. Michael Chen, MD",
            "specialization": "Neurology",
            "department": "Neuroscience Institute",
            "licenseNumber": "LIC-NEURO-542",
            "consultationFee": 180.0,
            "availableDays": "Tue, Thu, Sat",
            "availableHours": "10:00 AM - 05:00 PM"
        },
        {
            "doctorId": "DOC-103",
            "userId": "USR-104",
            "fullName": "Dr. Emily Davis, MD",
            "specialization": "Pediatrics",
            "department": "Pediatric & Child Health",
            "licenseNumber": "LIC-PEDI-782",
            "consultationFee": 120.0,
            "availableDays": "Mon - Fri",
            "availableHours": "08:30 AM - 03:30 PM"
        }
    ],
    "patients": [
        {
            "patientId": "PID-1001",
            "userId": "USR-105",
            "fullName": "Johnathan Doe",
            "dateOfBirth": "1988-06-14",
            "gender": "Male",
            "bloodGroup": "O+",
            "contactNumber": "+1 (555) 321-4567",
            "emergencyContact": "Mary Doe: +1 (555) 998-1122",
            "address": "742 Evergreen Terrace, Springfield",
            "allergies": "Penicillin",
            "medicalHistory": "Mild exercise-induced asthma; seasonal rhinitis",
            "registeredAt": "2026-10-15"
        },
        {
            "patientId": "PID-1002",
            "userId": "",
            "fullName": "Jane Roe",
            "dateOfBirth": "1994-11-23",
            "gender": "Female",
            "bloodGroup": "A-",
            "contactNumber": "+1 (555) 432-8765",
            "emergencyContact": "Robert Roe: +1 (555) 777-6543",
            "address": "100 Sunset Boulevard, Suite 12",
            "allergies": "Latex, Sulfa Drugs",
            "medicalHistory": "Hypertension managed with dietary modifications",
            "registeredAt": "2026-10-18"
        },
        {
            "patientId": "PID-1003",
            "userId": "",
            "fullName": "Robert Sterling",
            "dateOfBirth": "1975-03-09",
            "gender": "Male",
            "bloodGroup": "B+",
            "contactNumber": "+1 (555) 876-5432",
            "emergencyContact": "Elena Sterling: +1 (555) 222-3344",
            "address": "450 Beacon Street, Boston",
            "allergies": "None",
            "medicalHistory": "Type 2 Diabetes Mellitus under glycemic control",
            "registeredAt": "2026-10-22"
        }
    ],
    "appointments": [
        {
            "appointmentId": "APT-2001",
            "patientId": "PID-1001",
            "patientName": "Johnathan Doe",
            "doctorId": "DOC-101",
            "doctorName": "Dr. Sarah Smith, MD",
            "department": "Cardiovascular Medicine",
            "appointmentDate": "2026-11-02",
            "timeSlot": "10:00 AM",
            "reason": "Palpitations during morning jogging and mild chest tightness",
            "status": "Scheduled",
            "prescriptionNotes": "",
            "createdAt": "2026-10-28 09:15:00"
        },
        {
            "appointmentId": "APT-2002",
            "patientId": "PID-1002",
            "patientName": "Jane Roe",
            "doctorId": "DOC-102",
            "doctorName": "Dr. Michael Chen, MD",
            "department": "Neuroscience Institute",
            "appointmentDate": "2026-11-03",
            "timeSlot": "11:30 AM",
            "reason": "Recurring unilateral migraine headaches with photophobia",
            "status": "Scheduled",
            "prescriptionNotes": "",
            "createdAt": "2026-10-29 11:20:00"
        },
        {
            "appointmentId": "APT-2003",
            "patientId": "PID-1003",
            "patientName": "Robert Sterling",
            "doctorId": "DOC-101",
            "doctorName": "Dr. Sarah Smith, MD",
            "department": "Cardiovascular Medicine",
            "appointmentDate": "2026-10-25",
            "timeSlot": "02:00 PM",
            "reason": "Annual cardiovascular health check & lipid panel review",
            "status": "Completed",
            "prescriptionNotes": "Essential Hypertension Stage 1 - Prescribed Lisinopril 10mg daily.",
            "createdAt": "2026-10-20 14:00:00"
        },
        {
            "appointmentId": "APT-2004",
            "patientId": "PID-1001",
            "patientName": "Johnathan Doe",
            "doctorId": "DOC-103",
            "doctorName": "Dr. Emily Davis, MD",
            "department": "Pediatric & Child Health",
            "appointmentDate": "2026-10-20",
            "timeSlot": "03:30 PM",
            "reason": "Routine respiratory review",
            "status": "Cancelled",
            "prescriptionNotes": "",
            "createdAt": "2026-10-18 16:45:00"
        }
    ],
    "records": {
        "PID-1001": [
            {
                "recordId": "REC-3001",
                "patientId": "PID-1001",
                "doctorId": "DOC-101",
                "doctorName": "Dr. Sarah Smith, MD",
                "date": "2026-10-15",
                "diagnosis": "Mild Sinus Tachycardia with Stress-Related Symptoms",
                "treatmentNotes": "Advised reduction of caffeinated beverages and 8 hours sleep per night.",
                "vitals": {
                    "bloodPressure": "124/82",
                    "heartRate": "78",
                    "temperature": "98.4",
                    "weight": "76"
                },
                "prescription": {
                    "prescriptionId": "RX-4001",
                    "appointmentId": "APT-1999",
                    "patientId": "PID-1001",
                    "doctorId": "DOC-101",
                    "diagnosis": "Mild Sinus Tachycardia",
                    "advice": "Hydration, stress reduction, follow up in 30 days.",
                    "prescribedDate": "2026-10-15",
                    "medications": [
                        {"name": "Metoprolol Tartrate", "dosage": "25mg", "frequency": "Once daily morning", "duration": "30 days"},
                        {"name": "Magnesium Glycinate", "dosage": "200mg", "frequency": "Nightly before sleep", "duration": "30 days"}
                    ]
                }
            }
        ]
    }
}

next_patient_seq = 1004
next_appt_seq = 2005
next_rec_seq = 3002

class MediCoreRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for all responses
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        url_path = self.path.split("?")[0]

        # API Endpoints
        if url_path == "/api/patients":
            self.send_json({"success": True, "count": len(DB["patients"]), "patients": DB["patients"]})
        elif url_path.startswith("/api/patients/"):
            pid = url_path.split("/")[-1]
            p = next((x for x in DB["patients"] if x["patientId"] == pid), None)
            if p:
                self.send_json({"success": True, "patient": p})
            else:
                self.send_json({"success": False, "message": "Patient not found"}, status=404)
        elif url_path == "/api/doctors":
            self.send_json({"success": True, "doctors": DB["doctors"]})
        elif url_path == "/api/appointments":
            self.send_json({"success": True, "count": len(DB["appointments"]), "appointments": DB["appointments"]})
        elif url_path.startswith("/api/records/"):
            pid = url_path.split("/")[-1]
            recs = DB["records"].get(pid, [])
            self.send_json({"success": True, "patientId": pid, "records": recs})
        elif url_path == "/api/stats":
            total_patients = len(DB["patients"])
            total_appts = len(DB["appointments"])
            total_docs = len(DB["doctors"])
            completed = sum(1 for a in DB["appointments"] if a["status"] == "Completed")
            scheduled = sum(1 for a in DB["appointments"] if a["status"] == "Scheduled")
            cancelled = sum(1 for a in DB["appointments"] if a["status"] == "Cancelled")
            self.send_json({
                "totalPatients": total_patients,
                "totalAppointments": total_appts,
                "totalDoctors": total_docs,
                "completedAppointments": completed,
                "scheduledAppointments": scheduled,
                "cancelledAppointments": cancelled
            })
        else:
            # Serve Static Frontend Files
            self.serve_static(url_path)

    def do_POST(self):
        url_path = self.path.split("?")[0]
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        global next_patient_seq, next_appt_seq, next_rec_seq

        if url_path == "/api/login":
            username = data.get("username", "")
            password = data.get("password", "")
            role_req = data.get("role", "")
            user = DB["users"].get(username)

            if user and user["password"] == password:
                if role_req and user["role"].lower() != role_req.lower():
                    self.send_json({"success": False, "message": "Role mismatch for user"}, status=403)
                else:
                    self.send_json({
                        "success": True,
                        "message": "Authentication successful",
                        "user": user,
                        "token": f"jwt_{username}_session"
                    })
            else:
                self.send_json({"success": False, "message": "Invalid username or password credentials."}, status=401)

        elif url_path == "/api/patients":
            patient_id = f"PID-{next_patient_seq}"
            next_patient_seq += 1
            new_p = {
                "patientId": patient_id,
                "userId": "",
                "fullName": data.get("fullName", ""),
                "dateOfBirth": data.get("dateOfBirth", ""),
                "gender": data.get("gender", ""),
                "bloodGroup": data.get("bloodGroup", ""),
                "contactNumber": data.get("contactNumber", ""),
                "emergencyContact": data.get("emergencyContact", "N/A"),
                "address": data.get("address", ""),
                "allergies": data.get("allergies", "None"),
                "medicalHistory": data.get("medicalHistory", "None"),
                "registeredAt": datetime.now().strftime("%Y-%m-%d")
            }
            DB["patients"].append(new_p)
            self.send_json({"success": True, "patientId": patient_id, "message": "Patient registered successfully"}, status=201)

        elif url_path == "/api/appointments":
            appt_id = f"APT-{next_appt_seq}"
            next_appt_seq += 1
            new_a = {
                "appointmentId": appt_id,
                "patientId": data.get("patientId", ""),
                "patientName": data.get("patientName", "Patient"),
                "doctorId": data.get("doctorId", ""),
                "doctorName": data.get("doctorName", "Doctor"),
                "department": data.get("department", "General"),
                "appointmentDate": data.get("appointmentDate", ""),
                "timeSlot": data.get("timeSlot", ""),
                "reason": data.get("reason", ""),
                "status": "Scheduled",
                "prescriptionNotes": "",
                "createdAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            DB["appointments"].append(new_a)
            self.send_json({"success": True, "appointmentId": appt_id, "message": "Appointment booked successfully"}, status=201)

        elif re.match(r"^/api/appointments/[^/]+/prescribe$", url_path):
            appt_id = url_path.split("/")[3]
            appt = next((a for a in DB["appointments"] if a["appointmentId"] == appt_id), None)
            if not appt:
                self.send_json({"success": False, "message": "Appointment not found"}, status=404)
                return

            diagnosis = data.get("diagnosis", "")
            advice = data.get("advice", "")
            vitals = data.get("vitals", {})
            medications = data.get("medications", [])

            appt["status"] = "Completed"
            appt["prescriptionNotes"] = f"{diagnosis} - {advice}"

            rec_id = f"REC-{next_rec_seq}"
            next_rec_seq += 1
            record = {
                "recordId": rec_id,
                "patientId": appt["patientId"],
                "doctorId": appt["doctorId"],
                "doctorName": appt["doctorName"],
                "date": appt["appointmentDate"],
                "diagnosis": diagnosis,
                "treatmentNotes": advice,
                "vitals": vitals,
                "prescription": {
                    "prescriptionId": f"RX-{rec_id}",
                    "appointmentId": appt_id,
                    "patientId": appt["patientId"],
                    "doctorId": appt["doctorId"],
                    "diagnosis": diagnosis,
                    "advice": advice,
                    "prescribedDate": appt["appointmentDate"],
                    "medications": medications
                }
            }

            if appt["patientId"] not in DB["records"]:
                DB["records"][appt["patientId"]] = []
            DB["records"][appt["patientId"]].append(record)

            self.send_json({"success": True, "message": "Prescription and medical record recorded"}, status=200)

        else:
            self.send_json({"error": "Endpoint not found"}, status=404)

    def do_PUT(self):
        url_path = self.path.split("?")[0]
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        if re.match(r"^/api/appointments/[^/]+/status$", url_path):
            appt_id = url_path.split("/")[3]
            appt = next((a for a in DB["appointments"] if a["appointmentId"] == appt_id), None)
            if appt:
                appt["status"] = data.get("status", "Scheduled")
                self.send_json({"success": True, "message": f"Appointment status updated to {appt['status']}"})
            else:
                self.send_json({"success": False, "message": "Appointment not found"}, status=404)
        else:
            self.send_json({"error": "Endpoint not found"}, status=404)

    def send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self, path):
        if path == "/" or path == "":
            path = "/index.html"

        file_path = os.path.join(FRONTEND_DIR, path.lstrip("/"))
        if not os.path.exists(file_path):
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"404 Not Found")
            return

        ext = os.path.splitext(file_path)[1].lower()
        mime_types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json",
            ".png": "image/png",
            ".svg": "image/svg+xml"
        }
        content_type = mime_types.get(ext, "application/octet-stream")

        with open(file_path, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

def main():
    print("=" * 70)
    print("  MEDICORE HOSPITAL MANAGEMENT SYSTEM - LOCAL DEV RUNNER")
    print("=" * 70)
    print(f"  [Server]  Running on http://localhost:{PORT}")
    print(f"  [Frontend] Serving files from: {FRONTEND_DIR}")
    print("-" * 70)
    print("  QUICK LOGIN DEMO ACCOUNTS:")
    print("   * Admin:   admin    / admin123  (Full Hospital Control)")
    print("   * Doctor:  dr.smith / doc123    (Clinical Consultations & Rx)")
    print("   * Patient: john.doe / pat123    (Portal & Medical History)")
    print("=" * 70)
    print("\nPress Ctrl+C to stop the server.\n")

    with socketserver.TCPServer(("", PORT), MediCoreRequestHandler) as httpd:
        httpd.allow_reuse_address = True
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down MediCore HMS server...")

if __name__ == "__main__":
    main()
