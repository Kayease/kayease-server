import mongoose from "mongoose";

const CareerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    department: { 
      type: String, 
      required: true,
      enum: ["engineering", "design", "marketing", "sales", "operations", "other"]
    },
    location: { type: String, required: true },
    jobType: { 
      type: String, 
      required: true,
      enum: ["remote", "hybrid", "in-office"]
    },
    experience: { type: String },
    salary: { type: String },
    skills: [{ type: String, required: true }],
    description: { type: String, required: true },
    requirements: [{ type: String, required: true }],
    responsibilities: [{ type: String }],
    benefits: [{ type: String }],
    status: {
      type: String,
      enum: ["active", "paused", "closed"],
      default: "active",
    },
    postedDate: { type: Date, default: Date.now },
    applicationCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Career", CareerSchema);
