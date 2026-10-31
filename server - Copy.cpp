/**
 * ============================================================================
 * MEDICORE HOSPITAL MANAGEMENT SYSTEM - C++17 RESTFUL API SERVER (server.cpp)
 * ============================================================================
 * Exposes RESTful endpoints for Authentication, Patient Management,
 * Outpatient Scheduling, and Doctor Prescriptions.
 */

#include <iostream>
#include <string>
#include <memory>
#include "include/httplib.h"
#include "include/Models.hpp"
#include "include/Database.hpp"
#include "include/JsonHelper.hpp"

using namespace hms;

int main() {
    // Instantiate Thread-Safe In-Memory Repository
    HospitalDatabase db;

    // Instantiate HTTP REST Server
    httplib::Server svr;

    // Mount Frontend Static Assets
    // Resolves ../frontend when run from backend/, or frontend/ if run from root
    std::string frontend_dir = "frontend";
    std::ifstream test_f(frontend_dir + "/index.html");
    if (!test_f.is_open()) {
        frontend_dir = "../frontend";
    } else {
        test_f.close();
    }
    svr.set_mount_point("/", frontend_dir);

    // ========================================================================
    // 1. AUTHENTICATION MODULE
    // ========================================================================
    /**
     * POST /api/login
     * Authenticates user credentials and returns session profile
     */
    svr.Post("/api/login", [&db](const httplib::Request& req, httplib::Response& res) {
        std::string err;
        JsonValue body = JsonValue::parse(req.body, err);
        if (!err.empty()) {
            res.status = 400;
            res.set_content("{\"success\":false,\"message\":\"Invalid JSON payload\"}", "application/json");
            return;
        }

        std::string username = body.getString("username");
        std::string password = body.getString("password");
        std::string roleReq = body.getString("role");

        auto [authenticated, user] = db.authenticate(username, password);

        JsonValue response;
        if (authenticated) {
            // Optional role check
            if (!roleReq.empty() && roleToString(user.getRole()) != roleReq) {
                response["success"] = false;
                response["message"] = "Role scope mismatch for credentials provided.";
                res.status = 403;
            } else {
                response["success"] = true;
                response["message"] = "Authentication successful";
                response["user"] = user.toJson();
                response["token"] = "medicore_jwt_mock_" + user.getUsername() + "_session";
                res.status = 200;
            }
        } else {
            response["success"] = false;
            response["message"] = "Invalid username or password credentials.";
            res.status = 401;
        }

        res.set_content(response.dump(), "application/json");
    });

    // ========================================================================
    // 2. PATIENT MANAGEMENT MODULE
    // ========================================================================
    /**
     * GET /api/patients
     * Returns list of all registered patients
     */
    svr.Get("/api/patients", [&db](const httplib::Request& /*req*/, httplib::Response& res) {
        std::vector<Patient> patients = db.getAllPatients();

        std::vector<JsonValue> pList;
        pList.reserve(patients.size());
        for (const auto& p : patients) {
            pList.push_back(p.toJson());
        }

        JsonValue out;
        out["success"] = true;
        out["count"] = static_cast<int>(pList.size());
        out["patients"] = pList;

        res.set_content(out.dump(), "application/json");
    });

    /**
     * POST /api/patients
     * Registers a new patient record
     */
    svr.Post("/api/patients", [&db](const httplib::Request& req, httplib::Response& res) {
        std::string err;
        JsonValue body = JsonValue::parse(req.body, err);
        if (!err.empty()) {
            res.status = 400;
            res.set_content("{\"success\":false,\"message\":\"Malformed JSON payload\"}", "application/json");
            return;
        }

        std::string fullName = body.getString("fullName");
        std::string bloodGroup = body.getString("bloodGroup");
        std::string dob = body.getString("dateOfBirth");
        std::string gender = body.getString("gender");
        std::string phone = body.getString("contactNumber");

        // Basic Domain Validation
        if (fullName.empty() || bloodGroup.empty() || dob.empty() || gender.empty() || phone.empty()) {
            res.status = 422;
            res.set_content("{\"success\":false,\"message\":\"Missing mandatory patient fields\"}", "application/json");
            return;
        }

        Patient newPatient = Patient::fromJson(body);
        std::string assignedId = db.registerPatient(newPatient);

        // Optionally persist snapshot to disk
        db.saveToFile("hospital_data.json");

        JsonValue out;
        out["success"] = true;
        out["patientId"] = assignedId;
        out["message"] = "Patient record successfully registered";

        res.status = 201;
        res.set_content(out.dump(), "application/json");
    });

    /**
     * GET /api/patients/:id
     * Retrieves specific patient by ID
     */
    svr.Get("/api/patients/:id", [&db](const httplib::Request& req, httplib::Response& res) {
        std::string pid = req.params.at("id");
        Patient patient;
        if (db.getPatient(pid, patient)) {
            JsonValue out;
            out["success"] = true;
            out["patient"] = patient.toJson();
            res.set_content(out.dump(), "application/json");
        } else {
            res.status = 404;
            res.set_content("{\"success\":false,\"message\":\"Patient ID not found\"}", "application/json");
        }
    });

    // ========================================================================
    // 3. DOCTORS DIRECTORY
    // ========================================================================
    /**
     * GET /api/doctors
     * Returns list of available doctors and specialists
     */
    svr.Get("/api/doctors", [&db](const httplib::Request& /*req*/, httplib::Response& res) {
        std::vector<Doctor> doctors = db.getAllDoctors();

        std::vector<JsonValue> dList;
        for (const auto& d : doctors) {
            dList.push_back(d.toJson());
        }

        JsonValue out;
        out["success"] = true;
        out["doctors"] = dList;
        res.set_content(out.dump(), "application/json");
    });

    // ========================================================================
    // 4. APPOINTMENT SCHEDULING MODULE
    // ========================================================================
    /**
     * GET /api/appointments
     * Returns all scheduled visits
     */
    svr.Get("/api/appointments", [&db](const httplib::Request& /*req*/, httplib::Response& res) {
        std::vector<Appointment> appts = db.getAllAppointments();

        std::vector<JsonValue> aList;
        for (const auto& a : appts) {
            aList.push_back(a.toJson());
        }

        JsonValue out;
        out["success"] = true;
        out["count"] = static_cast<int>(aList.size());
        out["appointments"] = aList;
        res.set_content(out.dump(), "application/json");
    });

    /**
     * POST /api/appointments
     * Schedules a new appointment
     */
    svr.Post("/api/appointments", [&db](const httplib::Request& req, httplib::Response& res) {
        std::string err;
        JsonValue body = JsonValue::parse(req.body, err);
        if (!err.empty()) {
            res.status = 400;
            res.set_content("{\"success\":false,\"message\":\"Malformed JSON payload\"}", "application/json");
            return;
        }

        std::string patientId = body.getString("patientId");
        std::string doctorId = body.getString("doctorId");
        std::string date = body.getString("appointmentDate");
        std::string slot = body.getString("timeSlot");
        std::string reason = body.getString("reason");

        if (patientId.empty() || doctorId.empty() || date.empty() || slot.empty() || reason.empty()) {
            res.status = 422;
            res.set_content("{\"success\":false,\"message\":\"All appointment booking fields are required\"}", "application/json");
            return;
        }

        Appointment appt = Appointment::fromJson(body);
        std::string apptId = db.bookAppointment(appt);

        db.saveToFile("hospital_data.json");

        JsonValue out;
        out["success"] = true;
        out["appointmentId"] = apptId;
        out["message"] = "Appointment successfully booked";

        res.status = 201;
        res.set_content(out.dump(), "application/json");
    });

    /**
     * PUT /api/appointments/:id/status
     * Updates appointment status (e.g., Cancelled)
     */
    svr.Put("/api/appointments/:id/status", [&db](const httplib::Request& req, httplib::Response& res) {
        std::string apptId = req.params.at("id");
        std::string err;
        JsonValue body = JsonValue::parse(req.body, err);
        
        std::string statusStr = body.getString("status");
        AppointmentStatus status = stringToStatus(statusStr);

        if (db.updateAppointmentStatus(apptId, status)) {
            db.saveToFile("hospital_data.json");
            JsonValue out;
            out["success"] = true;
            out["message"] = "Appointment status updated to " + statusStr;
            res.set_content(out.dump(), "application/json");
        } else {
            res.status = 404;
            res.set_content("{\"success\":false,\"message\":\"Appointment not found\"}", "application/json");
        }
    });

    /**
     * POST /api/appointments/:id/prescribe
     * Records doctor diagnosis, vitals, medications, and completes appointment
     */
    svr.Post("/api/appointments/:id/prescribe", [&db](const httplib::Request& req, httplib::Response& res) {
        std::string apptId = req.params.at("id");
        std::string err;
        JsonValue body = JsonValue::parse(req.body, err);
        if (!err.empty()) {
            res.status = 400;
            res.set_content("{\"success\":false,\"message\":\"Invalid JSON\"}", "application/json");
            return;
        }

        std::string diagnosis = body.getString("diagnosis");
        std::string advice = body.getString("advice");

        Vitals vitals;
        if (body.has("vitals")) {
            vitals = Vitals::fromJson(body.get("vitals"));
        }

        std::vector<MedicationItem> meds;
        if (body.has("medications") && body.get("medications").isArray()) {
            for (const auto& mVal : body.get("medications").asArray()) {
                meds.push_back(MedicationItem::fromJson(mVal));
            }
        }

        if (diagnosis.empty()) {
            res.status = 422;
            res.set_content("{\"success\":false,\"message\":\"Clinical diagnosis is required\"}", "application/json");
            return;
        }

        if (db.recordPrescription(apptId, diagnosis, advice, vitals, meds)) {
            db.saveToFile("hospital_data.json");
            JsonValue out;
            out["success"] = true;
            out["message"] = "Prescription and EMR record successfully saved";
            res.set_content(out.dump(), "application/json");
        } else {
            res.status = 404;
            res.set_content("{\"success\":false,\"message\":\"Appointment ID not found\"}", "application/json");
        }
    });

    // ========================================================================
    // 5. PATIENT CLINICAL HISTORY & EMR RECORDS
    // ========================================================================
    /**
     * GET /api/records/:patientId
     * Returns clinical timeline for a patient
     */
    svr.Get("/api/records/:patientId", [&db](const httplib::Request& req, httplib::Response& res) {
        std::string pid = req.params.at("patientId");
        std::vector<MedicalRecord> records = db.getRecordsForPatient(pid);

        std::vector<JsonValue> rList;
        for (const auto& r : records) {
            rList.push_back(r.toJson());
        }

        JsonValue out;
        out["success"] = true;
        out["patientId"] = pid;
        out["records"] = rList;
        res.set_content(out.dump(), "application/json");
    });

    // ========================================================================
    // 6. DASHBOARD ANALYTICS & METRICS
    // ========================================================================
    /**
     * GET /api/stats
     * Aggregated metrics for high-level dashboard
     */
    svr.Get("/api/stats", [&db](const httplib::Request& /*req*/, httplib::Response& res) {
        JsonValue stats = db.getDashboardStats();
        res.set_content(stats.dump(), "application/json");
    });

    // ========================================================================
    // SERVER BOOTSTRAP BANNER
    // ========================================================================
    const std::string host = "0.0.0.0";
    const int port = 8080;

    std::cout << "\n";
    std::cout << "==================================================================\n";
    std::cout << "  MEDICORE HOSPITAL MANAGEMENT SYSTEM - C++17 RESTFUL ENGINE     \n";
    std::cout << "==================================================================\n";
    std::cout << "  [Backend]  Modern C++17 OOP Architecture                       \n";
    std::cout << "  [Storage]  Thread-Safe In-Memory Store + JSON Persistence       \n";
    std::cout << "  [Status]   Serving UI & APIs at: http://localhost:" << port << "       \n";
    std::cout << "------------------------------------------------------------------\n";
    std::cout << "  DEMO CREDENTIALS:                                               \n";
    std::cout << "   * Admin:   admin    / admin123  (Full Hospital Control)       \n";
    std::cout << "   * Doctor:  dr.smith / doc123    (Clinical Consultations & Rx) \n";
    std::cout << "   * Patient: john.doe / pat123    (Portal & Medical History)    \n";
    std::cout << "==================================================================\n\n";

    svr.listen(host, port);

    return 0;
}
