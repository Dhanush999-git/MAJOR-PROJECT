import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/verifact";
const DB_NAME = process.env.DB_NAME || "verifact";
const JWT_SECRET = process.env.JWT_SECRET || "verifact-local-secret";
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));

let db = null;

// Helper to extract client IP and user agent
function getClientMeta(req) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  const userAgent = req.headers["user-agent"] || "Unknown Browser";
  const origin = req.headers["origin"] || req.headers["host"] || "direct";
  return { ip, userAgent, origin };
}

async function initMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`✅ Connected to MongoDB Compass at: ${MONGODB_URI}`);
    console.log(`📂 Database: ${DB_NAME} | Collections: scans, users, analysis_logs, user_sessions, access_logs`);

    // 1. Ensure 'scans' collection exists
    const scansColl = db.collection("scans");
    if ((await scansColl.countDocuments()) === 0) {
      await scansColl.insertOne({
        scan_type: "text",
        input_label: "Welcome to VeriFact MongoDB Compass Connection",
        verdict: "authentic",
        confidence: 98,
        details: { note: "MongoDB Compass scans collection successfully initialized." },
        client_ip: "127.0.0.1",
        created_at: new Date().toISOString(),
      });
      console.log("📌 Initialized MongoDB Compass 'scans' collection.");
    }

    // 2. Ensure 'users' collection exists
    const usersColl = db.collection("users");
    if ((await usersColl.countDocuments()) === 0) {
      await usersColl.insertOne({
        email: "user@verifact.ai",
        display_name: "Forensic Analyst",
        role: "investigator",
        last_ip: "127.0.0.1",
        created_at: new Date().toISOString(),
      });
      console.log("📌 Initialized MongoDB Compass 'users' collection.");
    }

    // 3. Ensure 'user_sessions' collection exists
    const sessionsColl = db.collection("user_sessions");
    if ((await sessionsColl.countDocuments()) === 0) {
      await sessionsColl.insertOne({
        session_event: "system_init",
        user_id: "system",
        ip: "127.0.0.1",
        user_agent: "VeriFact Core Server",
        timestamp: new Date().toISOString(),
      });
      console.log("📌 Initialized MongoDB Compass 'user_sessions' collection.");
    }

    // 4. Ensure 'access_logs' collection exists
    const accessColl = db.collection("access_logs");
    if ((await accessColl.countDocuments()) === 0) {
      await accessColl.insertOne({
        event: "server_boot",
        host: HOST,
        port: PORT,
        timestamp: new Date().toISOString(),
      });
      console.log("📌 Initialized MongoDB Compass 'access_logs' collection.");
    }
  } catch (err) {
    console.error("❌ MongoDB Compass Connection Error:", err.message);
  }
}

// Root landing route to guide users to the frontend application
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>VeriFact API Server</title></head>
      <body style="font-family: system-ui, -apple-system, sans-serif; background: #0b0f17; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
        <div style="text-align: center; padding: 2.5rem; background: rgba(30,41,59,0.7); border-radius: 1.25rem; border: 1px solid rgba(255,255,255,0.1); max-w: 480px; backdrop-filter: blur(12px);">
          <h2 style="color: #818cf8; margin-top: 0; font-size: 1.5rem;">⚡ VeriFact Backend API Server</h2>
          <p style="color: #94a3b8; font-size: 0.95rem; leading-height: 1.5;">You have accessed the Node.js / MongoDB API server on port 5000.</p>
          <div style="margin-top: 2rem;">
            <a href="http://localhost:8081" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 0.85rem 1.75rem; text-decoration: none; border-radius: 9999px; font-weight: bold; font-size: 0.95rem; display: inline-block; box-shadow: 0 10px 25px -5px rgba(99,102,241,0.4);">
              Go to Frontend App (http://localhost:8081) &rarr;
            </a>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Health check
app.get("/api/health", (req, res) => {
  const meta = getClientMeta(req);
  res.json({
    status: db ? "connected" : "disconnected",
    database: DB_NAME,
    client: meta,
    timestamp: new Date().toISOString(),
  });
});

// Fetch all scans from MongoDB Compass
app.get("/api/scans", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    const userId = req.query.user_id;

const query = userId ? { user_id: userId } : {};

const scans = await db.collection("scans")
  .find(query)
  .sort({ created_at: -1 })
  .limit(100)
  .toArray();
    const formatted = scans.map((s) => ({
      id: s._id.toString(),
      user_id: s.user_id || "local-user",
      scan_type: s.scan_type,
      input_label: s.input_label,
      file_path: s.file_path || null,
      verdict: s.verdict,
      confidence: s.confidence,
      source_type: s.source_type || null,
      details: s.details || {},
      effects: s.effects || [],
      client_ip: s.client_ip || "127.0.0.1",
      user_agent: s.user_agent || "Unknown",
      created_at: s.created_at || new Date().toISOString(),
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save scan to MongoDB Compass (with client IP & device metadata)
app.post("/api/scans", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    const meta = getClientMeta(req);
    const newScan = {
      ...req.body,
      client_ip: meta.ip,
      user_agent: meta.userAgent,
      origin: meta.origin,
      created_at: req.body.created_at || new Date().toISOString(),
    };
    const result = await db.collection("scans").insertOne(newScan);
    res.json({ id: result.insertedId.toString(), ...newScan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete scan from MongoDB Compass
// Delete scan from MongoDB
app.delete("/api/scans/:id", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        error: "Database not connected",
      });
    }

    const { ObjectId } = await import("mongodb");

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        error: "Invalid scan ID",
      });
    }

    const result = await db.collection("scans").deleteOne({
      _id: new ObjectId(req.params.id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: "Scan not found",
      });
    }

    res.json({
      success: true,
      message: "Scan deleted successfully",
    });
  } catch (err) {
    console.error("Delete scan error:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// Auto-record user login / profile update into MongoDB Compass
app.post("/api/users", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    const meta = getClientMeta(req);
    const userDoc = {
      ...req.body,
      last_ip: meta.ip,
      user_agent: meta.userAgent,
      network_origin: meta.origin,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const query = req.body.email ? { email: req.body.email } : { id: req.body.id };
    await db.collection("users").updateOne(query, { $set: userDoc }, { upsert: true });

    // Also record login session event into user_sessions collection
    await db.collection("user_sessions").insertOne({
      user_id: req.body.id || req.body.email || "anonymous",
      email: req.body.email || null,
      display_name: req.body.display_name || "User",
      event: "login_activity",
      ip: meta.ip,
      user_agent: meta.userAgent,
      origin: meta.origin,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, user: userDoc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-record explicit session login / logout events into MongoDB Compass
app.post("/api/auth/session", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    const meta = getClientMeta(req);
    const sessionDoc = {
      user_id: req.body.user_id || "anonymous",
      email: req.body.email || null,
      event: req.body.event || "session_access",
      ip: meta.ip,
      user_agent: meta.userAgent,
      network_origin: meta.origin,
      timestamp: new Date().toISOString(),
    };
    await db.collection("user_sessions").insertOne(sessionDoc);

    // Record access log entry
    await db.collection("access_logs").insertOne({
      type: "network_user_access",
      user_id: req.body.user_id || "guest",
      email: req.body.email || null,
      ip: meta.ip,
      origin: meta.origin,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, session: sessionDoc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save telemetry analysis logs into MongoDB Compass
app.post("/api/logs", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    const meta = getClientMeta(req);
    const logDoc = {
      ...req.body,
      client_ip: meta.ip,
      user_agent: meta.userAgent,
      origin: meta.origin,
      timestamp: new Date().toISOString(),
    };
    await db.collection("analysis_logs").insertOne(logDoc);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record ground truth feedback & evaluate predictions
app.post("/api/eval", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    const { scan_id, ground_truth, model_versions, fp_fn_flag, user_notes } = req.body;
    const meta = getClientMeta(req);

    const evalDoc = {
      scan_id,
      ground_truth,
      model_versions: model_versions || "ForensicEnsemble v2.4",
      fp_fn_flag: fp_fn_flag || null, // "false_positive" | "false_negative" | "accurate"
      user_notes: user_notes || null,
      client_ip: meta.ip,
      timestamp: new Date().toISOString(),
    };

    await db.collection("evaluation_logs").insertOne(evalDoc);

    // If scan_id provided, update scan record in scans collection
    if (scan_id) {
      try {
        const { ObjectId } = await import("mongodb");
        await db.collection("scans").updateOne(
          { _id: new ObjectId(scan_id) },
          { $set: { ground_truth, fp_fn_flag: evalDoc.fp_fn_flag, evaluated_at: evalDoc.timestamp } }
        );
      } catch {}
    }

    res.json({ success: true, evaluation: evalDoc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ===============================
// LOCAL AUTHENTICATION
// ===============================

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const { email, password, display_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const users = db.collection("users");

    const existingUser = await users.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        error: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      email,
      password: hashedPassword,
      display_name: display_name || "User",
      created_at: new Date().toISOString(),
    };

    const result = await users.insertOne(newUser);

    const token = jwt.sign(
      {
        id: result.insertedId.toString(),
        email,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: result.insertedId.toString(),
        email,
        display_name: newUser.display_name,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({
      error: "Registration failed",
    });
  }
});


// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        error: "Database not connected",
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const users = db.collection("users");

    const user = await users.findOne({ email });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        display_name: user.display_name || "User",
      },
    });
  } catch (err) {
    console.error("Login error:", err);

    res.status(500).json({
      error: "Login failed",
    });
  }
});
// ===============================
// TEXT ANALYSIS
// ===============================

app.post("/api/analyze/text", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        error: "Text is required",
      });
    }

    // Temporary local analysis
    // Replace this section later with your actual text ML model.
    const isSuspicious =
      text.toLowerCase().includes("fake") ||
      text.toLowerCase().includes("scam");

    const result = {
      isAuthentic: !isSuspicious,
      confidence: isSuspicious ? 85 : 90,
      category: isSuspicious ? "fake" : "authentic",
      analysis: isSuspicious
        ? "The text contains potentially suspicious claims."
        : "No obvious suspicious indicators were detected.",
    };

    res.json(result);
  } catch (err) {
    console.error("Text analysis error:", err);

    res.status(500).json({
      error: "Text analysis failed",
    });
  }
});
initMongoDB().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`🚀 VeriFact MongoDB API Server running on http://${HOST}:${PORT}`);
  });
});
