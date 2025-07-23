import express from "express";
import Career from "../models/Career.js";

const router = express.Router();

// Get all careers with filtering and search
router.get("/", async (req, res) => {
  try {
    const { 
      search, 
      department, 
      status, 
      jobType, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (department && department !== 'all') {
      filter.department = department;
    }
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (jobType && jobType !== 'all') {
      filter.jobType = jobType;
    }

    // Build search query
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { skills: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const careers = await Career.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Career.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      careers,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (err) {
    console.error('Get careers error:', err);
    res.status(500).json({ error: err.message || "Failed to fetch careers" });
  }
});

// Get single career by ID
router.get("/:id", async (req, res) => {
  try {
    const career = await Career.findById(req.params.id);
    if (!career) {
      return res.status(404).json({ error: "Career not found" });
    }
    
    // Increment view count
    career.viewCount += 1;
    await career.save();
    
    res.json(career);
  } catch (err) {
    console.error('Get career error:', err);
    res.status(500).json({ error: err.message || "Failed to fetch career" });
  }
});

// Create new career
router.post("/", async (req, res) => {
  try {
    // Validate required fields
    const { title, department, location, jobType, description, requirements, skills } = req.body;
    
    if (!title || !department || !location || !jobType || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    if (!requirements || requirements.length === 0) {
      return res.status(400).json({ error: "At least one requirement is required" });
    }
    
    if (!skills || skills.length === 0) {
      return res.status(400).json({ error: "At least one skill is required" });
    }

    // Filter out empty requirements
    const filteredRequirements = requirements.filter(req => req && req.trim());
    const filteredSkills = skills.filter(skill => skill && skill.trim());
    
    const career = new Career({
      ...req.body,
      requirements: filteredRequirements,
      skills: filteredSkills,
      postedDate: new Date()
    });
    
    await career.save();
    res.status(201).json({ message: "Career created successfully", career });
  } catch (err) {
    console.error('Create career error:', err);
    res.status(500).json({ error: err.message || "Failed to create career" });
  }
});

// Update career
router.put("/:id", async (req, res) => {
  try {
    const career = await Career.findById(req.params.id);
    if (!career) {
      return res.status(404).json({ error: "Career not found" });
    }

    // Validate required fields if they're being updated
    const { title, department, location, jobType, description, requirements, skills } = req.body;
    
    if (title !== undefined && !title) {
      return res.status(400).json({ error: "Title is required" });
    }
    
    if (requirements !== undefined && (!requirements || requirements.length === 0)) {
      return res.status(400).json({ error: "At least one requirement is required" });
    }
    
    if (skills !== undefined && (!skills || skills.length === 0)) {
      return res.status(400).json({ error: "At least one skill is required" });
    }

    // Filter out empty requirements and skills if they're being updated
    const updateData = { ...req.body };
    if (requirements) {
      updateData.requirements = requirements.filter(req => req && req.trim());
    }
    if (skills) {
      updateData.skills = skills.filter(skill => skill && skill.trim());
    }

    Object.assign(career, updateData);
    await career.save();
    
    res.json({ message: "Career updated successfully", career });
  } catch (err) {
    console.error('Update career error:', err);
    res.status(500).json({ error: err.message || "Failed to update career" });
  }
});

// Delete career
router.delete("/:id", async (req, res) => {
  try {
    const career = await Career.findById(req.params.id);
    if (!career) {
      return res.status(404).json({ error: "Career not found" });
    }
    
    await Career.findByIdAndDelete(req.params.id);
    res.json({ message: "Career deleted successfully" });
  } catch (err) {
    console.error('Delete career error:', err);
    res.status(500).json({ error: err.message || "Failed to delete career" });
  }
});

// Bulk delete careers
router.post("/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No career IDs provided" });
    }
    
    const result = await Career.deleteMany({ _id: { $in: ids } });
    res.json({ 
      message: `${result.deletedCount} careers deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('Bulk delete careers error:', err);
    res.status(500).json({ error: err.message || "Failed to delete careers" });
  }
});

// Update career status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !["active", "paused", "closed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    
    const career = await Career.findById(req.params.id);
    if (!career) {
      return res.status(404).json({ error: "Career not found" });
    }
    
    career.status = status;
    await career.save();
    
    res.json({ message: "Career status updated successfully", career });
  } catch (err) {
    console.error('Update career status error:', err);
    res.status(500).json({ error: err.message || "Failed to update career status" });
  }
});

// Get career statistics
router.get("/stats/overview", async (req, res) => {
  try {
    const totalCareers = await Career.countDocuments();
    const activeCareers = await Career.countDocuments({ status: 'active' });
    const pausedCareers = await Career.countDocuments({ status: 'paused' });
    const closedCareers = await Career.countDocuments({ status: 'closed' });
    
    const departmentStats = await Career.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          }
        }
      }
    ]);
    
    const totalApplications = await Career.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$applicationCount' }
        }
      }
    ]);
    
    const totalViews = await Career.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$viewCount' }
        }
      }
    ]);

    res.json({
      overview: {
        total: totalCareers,
        active: activeCareers,
        paused: pausedCareers,
        closed: closedCareers
      },
      departments: departmentStats,
      totalApplications: totalApplications[0]?.total || 0,
      totalViews: totalViews[0]?.total || 0
    });
  } catch (err) {
    console.error('Get career stats error:', err);
    res.status(500).json({ error: err.message || "Failed to fetch career statistics" });
  }
});

export default router;