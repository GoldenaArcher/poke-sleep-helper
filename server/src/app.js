import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

const mongoUrl = process.env.MONGODB_URI;
if (mongoUrl) {
  mongoose
    .connect(mongoUrl)
    .then(() => console.log("MongoDB connected"))
    .catch((error) => console.error("MongoDB connection error", error));
} else {
  console.warn("MONGODB_URI not set; running without DB connection");
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

export default app;
