import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BACKEND_DIR = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(BACKEND_DIR, ".env") });

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/verifact";
const DB_NAME = process.env.DB_NAME || "verifact";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
}));
app.use(express.json({ limit: "50mb" }));

let db = null;
let mongoClient = null;

// Helper to extract client IP and user agent
function getClientMeta(req) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  const userAgent = req.headers["user-agent"] || "Unknown Browser";
  const origin = req.headers["origin"] || req.headers["host"] || "direct";
  return { ip, userAgent, origin };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function logInternalError(context, error) {
  console.error(context, error instanceof Error ? error.name : "UnknownError");
}

function getAuthenticatedUser(req) {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload && typeof payload === "object" && typeof payload.id === "string"
      ? payload
      : null;
  } catch {
    return null;
  }
}

function requireAuthenticatedUser(req, res, next) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  req.authenticatedUser = user;
  return next();
}

async function recordAuthActivity(req, { userId, email, displayName, event }) {
  if (!db) return;

  const meta = getClientMeta(req);
  const timestamp = new Date().toISOString();
  await db.collection("user_sessions").insertOne({
    user_id: userId,
    email,
    display_name: displayName || "User",
    event,
    ip: meta.ip,
    user_agent: meta.userAgent,
    origin: meta.origin,
    timestamp,
  });

  await db.collection("access_logs").insertOne({
    type: "authentication",
    user_id: userId,
    email,
    event,
    ip: meta.ip,
    origin: meta.origin,
    timestamp,
  });
}

async function initMongoDB() {
  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    await db.command({ ping: 1 });
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    console.log(`✅ Connected to MongoDB database: ${DB_NAME}`);
    console.log(`📂 Collections available: ${collections.map(({ name }) => name).join(", ") || "none"}`);

  } catch (err) {
    logInternalError("MongoDB connection error:", err);
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

// Fetch only the authenticated user's scans from MongoDB.
app.get("/api/scans", requireAuthenticatedUser, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    const userId = typeof req.query.user_id === "string" ? req.query.user_id.trim() : "";

    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    if (userId !== req.authenticatedUser.id) {
      return res.status(403).json({ error: "You can only access your own scans" });
    }

    const scans = await db.collection("scans")
  .find({ user_id: req.authenticatedUser.id })
  .sort({ created_at: -1 })
  .limit(100)
  .toArray();
    const formatted = scans.map((s) => ({
      id: s._id.toString(),
      user_id: s.user_id,
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
    logInternalError("Fetch scans error:", err);
    res.status(500).json({ error: "Unable to fetch scans" });
  }
});

// Save a scan to MongoDB (with client IP & device metadata).
app.post("/api/scans", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });

    const authorization = req.headers.authorization;
    const authenticatedUser = getAuthenticatedUser(req);
    if (authorization && !authenticatedUser) {
      return res.status(401).json({ error: "Invalid or expired authentication token" });
    }

    const requestedUserId = typeof req.body?.user_id === "string"
      ? req.body.user_id.trim()
      : "";

    if (authenticatedUser) {
      if (requestedUserId && requestedUserId !== authenticatedUser.id) {
        return res.status(403).json({ error: "You can only save scans for your own account" });
      }
    } else if (requestedUserId !== "guest-user") {
      return res.status(401).json({ error: "Authentication required for user scans" });
    }

    const meta = getClientMeta(req);
    const { user_id: _requestedUserId, ...scanBody } = req.body || {};
    const newScan = {
      ...scanBody,
      user_id: authenticatedUser?.id || "guest-user",
      client_ip: meta.ip,
      user_agent: meta.userAgent,
      origin: meta.origin,
      created_at: req.body?.created_at || new Date().toISOString(),
    };
    const result = await db.collection("scans").insertOne(newScan);
    res.json({ id: result.insertedId.toString(), ...newScan });
  } catch (err) {
    logInternalError("Save scan error:", err);
    res.status(500).json({ error: "Unable to save scan" });
  }
});

// Delete only a scan owned by the authenticated user.
app.delete("/api/scans/:id", requireAuthenticatedUser, async (req, res) => {
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
      user_id: req.authenticatedUser.id,
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
    logInternalError("Delete scan error:", err);
    res.status(500).json({
      error: "Unable to delete scan",
    });
  }
});

// Auto-record user login / profile update into MongoDB Compass
app.post("/api/users", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    const meta = getClientMeta(req);
    const { password: _password, ...safeUserBody } = req.body || {};
    const userDoc = {
      ...safeUserBody,
      last_ip: meta.ip,
      user_agent: meta.userAgent,
      network_origin: meta.origin,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const query = safeUserBody.email ? { email: safeUserBody.email } : { id: safeUserBody.id };
    await db.collection("users").updateOne(query, { $set: userDoc }, { upsert: true });

    // Also record login session event into user_sessions collection
    await db.collection("user_sessions").insertOne({
      user_id: safeUserBody.id || safeUserBody.email || "anonymous",
      email: safeUserBody.email || null,
      display_name: safeUserBody.display_name || "User",
      event: "login_activity",
      ip: meta.ip,
      user_agent: meta.userAgent,
      origin: meta.origin,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, user: userDoc });
  } catch (err) {
    logInternalError("User activity error:", err);
    res.status(500).json({ error: "Unable to record user activity" });
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
    logInternalError("Session activity error:", err);
    res.status(500).json({ error: "Unable to record session activity" });
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
    logInternalError("Analysis log error:", err);
    res.status(500).json({ error: "Unable to record analysis log" });
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
    logInternalError("Evaluation error:", err);
    res.status(500).json({ error: "Unable to record evaluation" });
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

    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const displayName = typeof req.body?.display_name === "string" ? req.body.display_name.trim() : "";

    if (!displayName || !email || !password) {
      return res.status(400).json({
        error: "Display name, email, and password are required",
      });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
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
      display_name: displayName,
      created_at: new Date().toISOString(),
    };

    const result = await users.insertOne(newUser);
    const userId = result.insertedId.toString();

    await recordAuthActivity(req, {
      userId,
      email,
      displayName,
      event: "register",
    });

    const token = jwt.sign(
      {
        id: userId,
        email,
        display_name: displayName,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        display_name: displayName,
      },
    });
  } catch (err) {
    logInternalError("Register error:", err);
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

    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }

    const users = db.collection("users");

    const user = await users.findOne({ email });

    if (!user || typeof user.password !== "string") {
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

    const userId = user._id.toString();
    const displayName = typeof user.display_name === "string" && user.display_name.trim()
      ? user.display_name.trim()
      : "User";

    await recordAuthActivity(req, {
      userId,
      email: user.email,
      displayName,
      event: "login",
    });

    const token = jwt.sign(
      {
        id: userId,
        email: user.email,
        display_name: displayName,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: userId,
        email: user.email,
        display_name: displayName,
      },
    });
  } catch (err) {
    logInternalError("Login error:", err);

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
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

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
