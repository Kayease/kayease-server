import express from "express";
import Blog from "../models/Blog.js";
import { deleteImage } from "../utils/cloudinary.js";

const router = express.Router();

// Create blog (expects image as URL in req.body.image)
router.post("/", async (req, res) => {
  try {
    const blog = new Blog({
      ...req.body,
      publishDate: req.body.publishDate || new Date(),
      author: req.body.author || { name: "Admin" },
      status: req.body.status || "published",
    });
    await blog.save();
    res.status(201).json({ message: "Blog created successfully", blog });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to create blog" });
  }
});

// Update blog
router.put("/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: "Blog not found" });

    // Update blog data
    Object.assign(blog, req.body);
    await blog.save();
    res.json({ message: "Blog updated successfully", blog });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update blog" });
  }
});

// Delete blog: delete image from Cloudinary first, then delete blog from DB
router.delete("/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    
    // Delete image from Cloudinary if exists
    if (blog.imagePublicId) {
      try {
        const cloudRes = await deleteImage(blog.imagePublicId);
        if (cloudRes.result !== "ok" && cloudRes.result !== "not found") {
          return res.status(500).json({ error: "Failed to delete image from Cloudinary" });
        }
      } catch (cloudErr) {
        console.error("Cloudinary deletion error:", cloudErr);
        return res.status(500).json({ error: "Failed to delete image from Cloudinary: " + cloudErr.message });
      }
    } else if (blog.image) {
      // If no imagePublicId but image URL exists, try to extract public ID
      try {
        const publicId = extractPublicIdFromUrl(blog.image);
        if (publicId) {
          const cloudRes = await deleteImage(publicId);
          if (cloudRes.result !== "ok" && cloudRes.result !== "not found") {
            console.warn("Failed to delete image using extracted public ID");
          }
        }
      } catch (cloudErr) {
        console.error("Error extracting/deleting image:", cloudErr);
      }
    }
    
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: "Blog and image deleted successfully" });
  } catch (err) {
    console.error('Blog delete error:', err);
    res.status(500).json({ error: err.message || "Failed to delete blog" });
  }
});

// Helper function to extract public ID from Cloudinary URL
function extractPublicIdFromUrl(url) {
  try {
    const urlParts = url.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    if (uploadIndex === -1) return null;
    
    // Get everything after 'upload/v{version}/'
    const pathAfterUpload = urlParts.slice(uploadIndex + 2).join('/');
    // Remove file extension
    const publicId = pathAfterUpload.replace(/\.[^/.]+$/, '');
    return publicId;
  } catch (err) {
    console.error('Error extracting public ID:', err);
    return null;
  }
}

// Get all blogs
router.get("/", async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    console.error('Error fetching blogs:', err);
    res.status(500).json({ error: err.message || "Failed to fetch blogs" });
  }
});

// Get single blog
router.get("/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }
    res.json(blog);
  } catch (err) {
    console.error('Error fetching blog by ID:', err);
    res.status(500).json({ error: err.message || "Failed to fetch blog" });
  }
});

// Get blog statistics
router.get("/stats/overview", async (req, res) => {
  try {
    const totalBlogs = await Blog.countDocuments();
    const publishedBlogs = await Blog.countDocuments({ status: "published" });
    const draftBlogs = await Blog.countDocuments({ status: "draft" });
    const featuredBlogs = await Blog.countDocuments({ featured: true });
    
    // Get blogs created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const thisMonthBlogs = await Blog.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Calculate total views and likes (if these fields exist)
    const blogsWithStats = await Blog.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: { $ifNull: ["$views", 0] } },
          totalLikes: { $sum: { $ifNull: ["$likes", 0] } }
        }
      }
    ]);

    const stats = blogsWithStats[0] || { totalViews: 0, totalLikes: 0 };

    res.json({
      totalBlogs,
      publishedBlogs,
      draftBlogs,
      featuredBlogs,
      thisMonthBlogs,
      totalViews: stats.totalViews,
      totalLikes: stats.totalLikes,
      overview: {
        total: totalBlogs,
        published: publishedBlogs,
        drafts: draftBlogs,
        featured: featuredBlogs
      }
    });
  } catch (error) {
    console.error("Error fetching blog stats:", error);
    res.status(500).json({ error: "Failed to fetch blog statistics" });
  }
});

export default router;
