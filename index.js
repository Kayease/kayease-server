import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import blogRoutes from "./routes/blogs.js";
import cloudinaryRoutes from "./routes/cloudinary.js";
import careerRoutes from "./routes/careers.js";
import clientRoutes from "./routes/clients.js";
import portfolioRoutes from "./routes/portfolio.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running." });
});

app.use("/api/blogs", blogRoutes);
app.use("/api/cloudinary", cloudinaryRoutes);
app.use("/api/careers", careerRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/portfolio", portfolioRoutes);

const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected✅✅"))
  .catch((err) => console.error("MongoDB connection error❌❌:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}✈️✈️`);
}); 