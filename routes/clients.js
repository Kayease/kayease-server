import express from "express";
import Client from "../models/Client.js";
import { deleteImage } from "../utils/cloudinary.js";

const router = express.Router();

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

// Create client (expects logo as URL in req.body.logo)
router.post("/", async (req, res) => {
  try {
    // Validate required fields
    const { name, logo } = req.body;
    if (!name || !logo) {
      return res.status(400).json({ 
        error: "Name and logo are required fields" 
      });
    }

    // Create client with provided data
    const clientData = {
      name: req.body.name,
      logo: req.body.logo,
      logoPublicId: req.body.logoPublicId || ''
    };

    const client = new Client(clientData);
    await client.save();
    
    res.status(201).json({ 
      message: "Client created successfully", 
      client 
    });
  } catch (err) {
    console.error('Client creation error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to create client" 
    });
  }
});

// Get all clients with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (search) {
      filter.name = new RegExp(search, 'i');
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const clients = await Client.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Client.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      clients,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalClients: total,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (err) {
    console.error('Get clients error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to fetch clients" 
    });
  }
});

// Get single client by ID
router.get("/:id", async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(client);
  } catch (err) {
    console.error('Get client error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to fetch client" 
    });
  }
});

// Update client
router.put("/:id", async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Store old logo info for potential cleanup
    const oldLogo = client.logo;
    const oldLogoPublicId = client.logoPublicId;

    // Update client data (only name, logo, logoPublicId)
    if (req.body.name) client.name = req.body.name;
    if (req.body.logo) client.logo = req.body.logo;
    if (req.body.logoPublicId !== undefined) client.logoPublicId = req.body.logoPublicId;
    
    await client.save();

    // If logo was changed and we have old logo, delete it from Cloudinary
    if (req.body.logo && req.body.logo !== oldLogo && oldLogoPublicId) {
      try {
        await deleteImage(oldLogoPublicId);
      } catch (cloudErr) {
        console.warn('Failed to delete old logo from Cloudinary:', cloudErr);
        // Don't fail the update if image deletion fails
      }
    }

    res.json({ 
      message: "Client updated successfully", 
      client 
    });
  } catch (err) {
    console.error('Client update error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to update client" 
    });
  }
});

// Delete client
router.delete("/:id", async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    
    // Delete logo from Cloudinary if exists
    if (client.logoPublicId) {
      try {
        const cloudRes = await deleteImage(client.logoPublicId);
        if (cloudRes.result !== "ok" && cloudRes.result !== "not found") {
          return res.status(500).json({ 
            error: "Failed to delete logo from Cloudinary" 
          });
        }
      } catch (cloudErr) {
        console.error("Cloudinary deletion error:", cloudErr);
        return res.status(500).json({ 
          error: "Failed to delete logo from Cloudinary: " + cloudErr.message 
        });
      }
    } else if (client.logo) {
      // If no logoPublicId but logo URL exists, try to extract public ID
      try {
        const publicId = extractPublicIdFromUrl(client.logo);
        if (publicId) {
          const cloudRes = await deleteImage(publicId);
          if (cloudRes.result !== "ok" && cloudRes.result !== "not found") {
            console.warn("Failed to delete logo using extracted public ID");
          }
        }
      } catch (cloudErr) {
        console.error("Error extracting/deleting logo:", cloudErr);
      }
    }
    
    await Client.findByIdAndDelete(req.params.id);
    res.json({ message: "Client and logo deleted successfully" });
  } catch (err) {
    console.error('Client delete error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to delete client" 
    });
  }
});



// Get client statistics
router.get("/stats/overview", async (req, res) => {
  try {
    const totalClients = await Client.countDocuments();

    // Get recent clients (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentClients = await Client.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      totalClients,
      recentClients
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to fetch client statistics" 
    });
  }
});

export default router;