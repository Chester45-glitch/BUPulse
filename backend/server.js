require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const authRoutes = require("./routes/auth");
const classroomRoutes = require("./routes/classroom");
const notificationRoutes = require("./routes/notifications");
const chatbotRoutes = require("./routes/chatbot");
const professorRoutes = require("./routes/professor");
const parentRoutes = require("./routes/parent");
const { startScheduler } = require("./services/scheduler");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://bu-pulse.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "bupulse-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use("/api/auth", authRoutes);
app.use("/api/classroom", classroomRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/professor", professorRoutes);
app.use("/api/parent", parentRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "BUPulse API is running", timestamp: new Date() });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 BUPulse API running on http://localhost:${PORT}`);
  startScheduler();
});
