import express from "express";
import Portfolio from "../models/Portfolio.js";
import { deleteImage } from "../utils/cloudinary.js";

const router = express.Router();

// Helper function to extract public ID from Cloudinary URL
function extractPublicIdFromUrl(url) {
  try {
    if (!url || typeof url !== 'string') return null;
    
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

// Helper function to delete multiple images from Cloudinary
async function deleteMultipleImages(imageUrls, publicIds = []) {
  const deletionPromises = [];
  
  // Delete using public IDs if available
  if (publicIds && publicIds.length > 0) {
    publicIds.forEach(publicId => {
      if (publicId) {
        deletionPromises.push(deleteImage(publicId));
      }
    });
  } else if (imageUrls && imageUrls.length > 0) {
    // Extract public IDs from URLs if no public IDs provided
    imageUrls.forEach(url => {
      const publicId = extractPublicIdFromUrl(url);
      if (publicId) {
        deletionPromises.push(deleteImage(publicId));
      }
    });
  }
  
  if (deletionPromises.length > 0) {
    try {
      await Promise.allSettled(deletionPromises);
    } catch (error) {
      console.error('Error deleting images:', error);
    }
  }
}

// Create portfolio project
router.post("/", async (req, res) => {
  try {
    const {
      title,
      excerpt,
      projectOverview,
      clientName,
      completedDate,
      technologies,
      liveDomainLink,
      challenges,
      status,
      category,
      featured,
      mainImage,
      mainImagePublicId,
      galleryImages,
      galleryImagePublicIds
    } = req.body;

    // Validation
    if (!title || !excerpt || !projectOverview || !clientName || !completedDate || !mainImage) {
      return res.status(400).json({ 
        error: "Missing required fields: title, excerpt, projectOverview, clientName, completedDate, mainImage" 
      });
    }

    if (!technologies || technologies.length === 0) {
      return res.status(400).json({ 
        error: "At least one technology is required" 
      });
    }

    // Check for duplicate title/slug
    const existingProject = await Portfolio.findOne({ 
      title: { $regex: new RegExp(`^${title}$`, 'i') } 
    });
    
    if (existingProject) {
      return res.status(400).json({ 
        error: "A project with this title already exists" 
      });
    }

    const portfolio = new Portfolio({
      title: title.trim(),
      excerpt: excerpt.trim(),
      projectOverview: projectOverview.trim(),
      clientName: clientName.trim(),
      completedDate: new Date(completedDate),
      technologies: technologies.map(tech => tech.trim()).filter(tech => tech),
      liveDomainLink: liveDomainLink?.trim() || '',
      challenges: challenges?.trim() || '',
      status: status || 'completed',
      category: category || 'web-dev',
      featured: Boolean(featured),
      mainImage,
      mainImagePublicId: mainImagePublicId || '',
      galleryImages: galleryImages || [],
      galleryImagePublicIds: galleryImagePublicIds || []
    });

    await portfolio.save();
    
    res.status(201).json({ 
      message: "Portfolio project created successfully", 
      portfolio 
    });
  } catch (err) {
    console.error('Portfolio creation error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to create portfolio project" 
    });
  }
});

// Get all portfolio projects with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      status,
      featured,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (featured !== undefined) {
      filter.featured = featured === 'true';
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { technologies: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [portfolios, total] = await Promise.all([
      Portfolio.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Portfolio.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      portfolios,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (err) {
    console.error('Portfolio fetch error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to fetch portfolio projects" 
    });
  }
});

// Get single portfolio project by ID or slug
router.get("/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Try to find by ID first, then by slug
    let portfolio;
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      // It's a valid ObjectId
      portfolio = await Portfolio.findById(identifier);
    } else {
      // It's a slug
      portfolio = await Portfolio.findOne({ slug: identifier });
    }
    
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio project not found" });
    }
    
    res.json(portfolio);
  } catch (err) {
    console.error('Portfolio fetch error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to fetch portfolio project" 
    });
  }
});

// Update portfolio project
router.put("/:id", async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio project not found" });
    }

    const {
      title,
      excerpt,
      projectOverview,
      clientName,
      completedDate,
      technologies,
      liveDomainLink,
      challenges,
      status,
      category,
      featured,
      mainImage,
      mainImagePublicId,
      galleryImages,
      galleryImagePublicIds,
      removedGalleryImages,
      removedGalleryImagePublicIds
    } = req.body;

    // Handle removed gallery images
    if (removedGalleryImages && removedGalleryImages.length > 0) {
      await deleteMultipleImages(removedGalleryImages, removedGalleryImagePublicIds);
    }

    // Handle main image change
    if (mainImage && mainImage !== portfolio.mainImage) {
      // Delete old main image
      if (portfolio.mainImagePublicId) {
        try {
          await deleteImage(portfolio.mainImagePublicId);
        } catch (error) {
          console.error('Error deleting old main image:', error);
        }
      } else if (portfolio.mainImage) {
        const oldPublicId = extractPublicIdFromUrl(portfolio.mainImage);
        if (oldPublicId) {
          try {
            await deleteImage(oldPublicId);
          } catch (error) {
            console.error('Error deleting old main image:', error);
          }
        }
      }
    }

    // Update portfolio data
    const updateData = {
      title: title?.trim() || portfolio.title,
      excerpt: excerpt?.trim() || portfolio.excerpt,
      projectOverview: projectOverview?.trim() || portfolio.projectOverview,
      clientName: clientName?.trim() || portfolio.clientName,
      completedDate: completedDate ? new Date(completedDate) : portfolio.completedDate,
      technologies: technologies ? technologies.map(tech => tech.trim()).filter(tech => tech) : portfolio.technologies,
      liveDomainLink: liveDomainLink?.trim() || portfolio.liveDomainLink,
      challenges: challenges?.trim() || portfolio.challenges,
      status: status || portfolio.status,
      category: category || portfolio.category,
      featured: featured !== undefined ? Boolean(featured) : portfolio.featured,
      mainImage: mainImage || portfolio.mainImage,
      mainImagePublicId: mainImagePublicId || portfolio.mainImagePublicId,
      galleryImages: galleryImages || portfolio.galleryImages,
      galleryImagePublicIds: galleryImagePublicIds || portfolio.galleryImagePublicIds
    };

    // Check for duplicate title if title is being changed
    if (title && title !== portfolio.title) {
      const existingProject = await Portfolio.findOne({ 
        title: { $regex: new RegExp(`^${title}$`, 'i') },
        _id: { $ne: req.params.id }
      });
      
      if (existingProject) {
        return res.status(400).json({ 
          error: "A project with this title already exists" 
        });
      }
    }

    Object.assign(portfolio, updateData);
    await portfolio.save();
    
    res.json({ 
      message: "Portfolio project updated successfully", 
      portfolio 
    });
  } catch (err) {
    console.error('Portfolio update error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to update portfolio project" 
    });
  }
});

// Delete portfolio project
router.delete("/:id", async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio project not found" });
    }
    
    // Collect all images to delete
    const imagesToDelete = [];
    const publicIdsToDelete = [];
    
    // Main image
    if (portfolio.mainImagePublicId) {
      publicIdsToDelete.push(portfolio.mainImagePublicId);
    } else if (portfolio.mainImage) {
      imagesToDelete.push(portfolio.mainImage);
    }
    
    // Gallery images
    if (portfolio.galleryImagePublicIds && portfolio.galleryImagePublicIds.length > 0) {
      publicIdsToDelete.push(...portfolio.galleryImagePublicIds);
    } else if (portfolio.galleryImages && portfolio.galleryImages.length > 0) {
      imagesToDelete.push(...portfolio.galleryImages);
    }
    
    // Delete all images from Cloudinary
    await deleteMultipleImages(imagesToDelete, publicIdsToDelete);
    
    // Delete portfolio from database
    await Portfolio.findByIdAndDelete(req.params.id);
    
    res.json({ 
      message: "Portfolio project and all associated images deleted successfully" 
    });
  } catch (err) {
    console.error('Portfolio delete error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to delete portfolio project" 
    });
  }
});

// Get portfolio statistics
router.get("/stats/overview", async (req, res) => {
  try {
    const [
      totalProjects,
      completedProjects,
      inProgressProjects,
      featuredProjects,
      categoryStats
    ] = await Promise.all([
      Portfolio.countDocuments(),
      Portfolio.countDocuments({ status: 'completed' }),
      Portfolio.countDocuments({ status: 'in-progress' }),
      Portfolio.countDocuments({ featured: true }),
      Portfolio.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ])
    ]);

    res.json({
      totalProjects,
      completedProjects,
      inProgressProjects,
      featuredProjects,
      categoryStats
    });
  } catch (err) {
    console.error('Portfolio stats error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to fetch portfolio statistics" 
    });
  }
});

// Toggle featured status
router.patch("/:id/featured", async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio project not found" });
    }

    portfolio.featured = !portfolio.featured;
    await portfolio.save();

    res.json({ 
      message: `Portfolio project ${portfolio.featured ? 'featured' : 'unfeatured'} successfully`,
      portfolio 
    });
  } catch (err) {
    console.error('Portfolio featured toggle error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to toggle featured status" 
    });
  }
});

// Bulk operations
router.post("/bulk/delete", async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No portfolio IDs provided" });
    }

    // Get all portfolios to delete
    const portfolios = await Portfolio.find({ _id: { $in: ids } });
    
    if (portfolios.length === 0) {
      return res.status(404).json({ error: "No portfolio projects found" });
    }

    // Collect all images to delete
    const imagesToDelete = [];
    const publicIdsToDelete = [];
    
    portfolios.forEach(portfolio => {
      // Main image
      if (portfolio.mainImagePublicId) {
        publicIdsToDelete.push(portfolio.mainImagePublicId);
      } else if (portfolio.mainImage) {
        imagesToDelete.push(portfolio.mainImage);
      }
      
      // Gallery images
      if (portfolio.galleryImagePublicIds && portfolio.galleryImagePublicIds.length > 0) {
        publicIdsToDelete.push(...portfolio.galleryImagePublicIds);
      } else if (portfolio.galleryImages && portfolio.galleryImages.length > 0) {
        imagesToDelete.push(...portfolio.galleryImages);
      }
    });
    
    // Delete all images from Cloudinary
    await deleteMultipleImages(imagesToDelete, publicIdsToDelete);
    
    // Delete portfolios from database
    const result = await Portfolio.deleteMany({ _id: { $in: ids } });
    
    res.json({ 
      message: `${result.deletedCount} portfolio projects and their images deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('Portfolio bulk delete error:', err);
    res.status(500).json({ 
      error: err.message || "Failed to delete portfolio projects" 
    });
  }
});

export default router;