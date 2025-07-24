import mongoose from "mongoose";

const TeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },
    experience: { type: String, required: true },
    expertise: [{ type: String, required: true }],
    avatar: { type: String, required: true },
    avatarPublicId: { type: String },
    order: { type: Number, default: 0 }, // For ordering team members
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Team", TeamSchema);