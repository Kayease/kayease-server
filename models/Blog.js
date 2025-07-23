import mongoose from "mongoose";

const AuthorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String },
    avatar: { type: String },
  },
  { _id: false }
);

const BlogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, required: true },
    tags: [{ type: String }],
    image: { type: String, required: true },
    imagePublicId: { type: String },
    readTime: { type: Number, default: 5 },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    featured: { type: Boolean, default: false },
    author: { type: AuthorSchema, required: true },
    publishDate: { type: Date, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Blog", BlogSchema);
