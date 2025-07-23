import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import blogRoutes from "./routes/blogs.js";
import cloudinaryRoutes from "./routes/cloudinary.js";
import careerRoutes from "./routes/careers.js";
import clientRoutes from "./routes/clients.js";
import portfolioRoutes from "./routes/portfolio.js";
import contactRoutes from "./routes/contacts.js";

dotenv.config();

const app = express();
app.use(cors({
  origin: [
    'http://localhost:8001',
    'https://kayease-beta.vercel.app'
  ],
  credentials: true // if you use cookies/auth
}));
app.use(express.json({ limit: "100mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running." });
});

app.use("/api/blogs", blogRoutes);
app.use("/api/cloudinary", cloudinaryRoutes);
app.use("/api/careers", careerRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/contacts", contactRoutes);

const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected✅✅"))
  .catch((err) => console.error("MongoDB connection error❌❌:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}✈️✈️`);
}); 