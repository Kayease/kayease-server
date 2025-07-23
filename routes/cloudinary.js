import express from "express";
import { deleteImage, uploadImageBase64 } from "../utils/cloudinary.js";

const router = express.Router();

// Upload image to Cloudinary
router.post("/upload", async (req, res) => {
  try {
    const { image, folder, publicId } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: "Image data is required" });
    }

    const result = await uploadImageBase64(image, folder || 'uploads', publicId);
    
    res.json({
      message: "Image uploaded successfully",
      secure_url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes
    });
  } catch (err) {
    console.error('Cloudinary upload route error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to upload image to Cloudinary" 
    });
  }
});

// Delete image from Cloudinary
router.post("/delete", async (req, res) => {
  try {
    const { publicId } = req.body;
    
    if (!publicId) {
      return res.status(400).json({ error: "Public ID is required" });
    }

    const result = await deleteImage(publicId);
    
    res.json({ 
      message: "Image deleted successfully", 
      result: result.result || result
    });
  } catch (err) {
    console.error('Cloudinary delete route error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to delete image from Cloudinary" 
    });
  }
});

export default router;