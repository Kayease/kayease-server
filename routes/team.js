import express from "express";
import Team from "../models/Team.js";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

// Get all team members
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query;
    
    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { role: { $regex: search, $options: "i" } },
        { expertise: { $in: [new RegExp(search, "i")] } }
      ];
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const teamMembers = await Team.find(query)
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Team.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      teamMembers,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});

// Get team member by ID
router.get("/:id", async (req, res) => {
  try {
    const teamMember = await Team.findById(req.params.id);
    if (!teamMember) {
      return res.status(404).json({ error: "Team member not found" });
    }
    res.json(teamMember);
  } catch (error) {
    console.error("Error fetching team member:", error);
    res.status(500).json({ error: "Failed to fetch team member" });
  }
});

// Create new team member
router.post("/", async (req, res) => {
  try {
    const { name, role, experience, expertise, avatar, avatarPublicId, order, isActive } = req.body;

    // Validation
    if (!name || !role || !experience || !expertise || !avatar) {
      return res.status(400).json({ 
        error: "Name, role, experience, expertise, and avatar are required" 
      });
    }

    if (!Array.isArray(expertise) || expertise.length < 2) {
      return res.status(400).json({ 
        error: "At least 2 expertise areas are required" 
      });
    }

    const teamMember = new Team({
      name,
      role,
      experience,
      expertise,
      avatar,
      avatarPublicId,
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true,
    });

    await teamMember.save();
    res.status(201).json(teamMember);
  } catch (error) {
    console.error("Error creating team member:", error);
    res.status(500).json({ error: "Failed to create team member" });
  }
});

// Update team member
router.put("/:id", async (req, res) => {
  try {
    const { name, role, experience, expertise, avatar, avatarPublicId, order, isActive } = req.body;
    
    const teamMember = await Team.findById(req.params.id);
    if (!teamMember) {
      return res.status(404).json({ error: "Team member not found" });
    }

    // Validation
    if (expertise && (!Array.isArray(expertise) || expertise.length < 2)) {
      return res.status(400).json({ 
        error: "At least 2 expertise areas are required" 
      });
    }

    // If avatar is being updated and old one exists, delete old image from Cloudinary
    if (avatar && avatar !== teamMember.avatar && teamMember.avatarPublicId) {
      try {
        await cloudinary.uploader.destroy(teamMember.avatarPublicId);
      } catch (cloudinaryError) {
        console.error("Error deleting old image from Cloudinary:", cloudinaryError);
      }
    }

    // Update fields
    if (name !== undefined) teamMember.name = name;
    if (role !== undefined) teamMember.role = role;
    if (experience !== undefined) teamMember.experience = experience;
    if (expertise !== undefined) teamMember.expertise = expertise;
    if (avatar !== undefined) teamMember.avatar = avatar;
    if (avatarPublicId !== undefined) teamMember.avatarPublicId = avatarPublicId;
    if (order !== undefined) teamMember.order = order;
    if (isActive !== undefined) teamMember.isActive = isActive;

    await teamMember.save();
    res.json(teamMember);
  } catch (error) {
    console.error("Error updating team member:", error);
    res.status(500).json({ error: "Failed to update team member" });
  }
});

// Delete team member
router.delete("/:id", async (req, res) => {
  try {
    const teamMember = await Team.findById(req.params.id);
    if (!teamMember) {
      return res.status(404).json({ error: "Team member not found" });
    }

    // Delete image from Cloudinary if it exists
    if (teamMember.avatarPublicId) {
      try {
        await cloudinary.uploader.destroy(teamMember.avatarPublicId);
      } catch (cloudinaryError) {
        console.error("Error deleting image from Cloudinary:", cloudinaryError);
      }
    }

    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: "Team member deleted successfully" });
  } catch (error) {
    console.error("Error deleting team member:", error);
    res.status(500).json({ error: "Failed to delete team member" });
  }
});

// Get team statistics
router.get("/stats/overview", async (req, res) => {
  try {
    const totalMembers = await Team.countDocuments();
    const activeMembers = await Team.countDocuments({ isActive: true });
    const inactiveMembers = await Team.countDocuments({ isActive: false });
    
    // Get this month's additions
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const thisMonthMembers = await Team.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Get role distribution
    const roleStats = await Team.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      overview: {
        total: totalMembers,
        active: activeMembers,
        inactive: inactiveMembers,
      },
      thisMonthMembers,
      roleStats,
    });
  } catch (error) {
    console.error("Error fetching team stats:", error);
    res.status(500).json({ error: "Failed to fetch team statistics" });
  }
});

// Bulk update order
router.put("/bulk/reorder", async (req, res) => {
  try {
    const { updates } = req.body; // Array of { id, order }
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: "Updates must be an array" });
    }

    const bulkOps = updates.map(({ id, order }) => ({
      updateOne: {
        filter: { _id: id },
        update: { order }
      }
    }));

    await Team.bulkWrite(bulkOps);
    res.json({ message: "Team member order updated successfully" });
  } catch (error) {
    console.error("Error updating team member order:", error);
    res.status(500).json({ error: "Failed to update team member order" });
  }
});

export default router;