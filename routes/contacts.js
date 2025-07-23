import express from "express";
import Contact from "../models/Contact.js";

const router = express.Router();

// Helper function to get client IP
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

// POST - Create new contact inquiry
router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      company,
      projectType,
      budget,
      timeline,
      message,
      newsletter,
      terms
    } = req.body;

    // Validation
    if (!name || !email || !phone || !projectType || !budget || !message || !terms) {
      return res.status(400).json({
        error: "All required fields must be provided"
      });
    }

    // Check if email already exists with recent submission (prevent spam)
    const recentSubmission = await Contact.findOne({
      email: email.toLowerCase(),
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });

    if (recentSubmission) {
      return res.status(429).json({
        error: "You have already submitted a contact form recently. Please wait 24 hours before submitting again."
      });
    }

    // Create new contact
    const newContact = new Contact({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      company: company?.trim() || '',
      projectType,
      budget,
      timeline,
      message: message.trim(),
      newsletter: newsletter || false,
      terms: true,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent']
    });

    const savedContact = await newContact.save();

    res.status(201).json({
      message: "Contact inquiry received successfully! We'll get back to you within 24 hours.",
      contact: {
        id: savedContact._id,
        name: savedContact.name,
        email: savedContact.email,
        projectType: savedContact.projectTypeLabel,
        budget: savedContact.budgetLabel,
        createdAt: savedContact.createdAt
      }
    });

  } catch (error) {
    console.error("Error creating contact:", error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: "Validation failed",
        details: errors
      });
    }

    res.status(500).json({
      error: "Failed to submit contact form. Please try again later."
    });
  }
});

// GET - Get all contacts with filters and pagination (Admin only)
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      projectType,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateFrom,
      dateTo
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (projectType) filter.projectType = projectType;
    
    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    
    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [contacts, totalContacts] = await Promise.all([
      Contact.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Contact.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalContacts / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      contacts,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalContacts,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({
      error: "Failed to fetch contacts"
    });
  }
});

// GET - Get contact by ID (Admin only)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findById(id);
    
    if (!contact) {
      return res.status(404).json({
        error: "Contact not found"
      });
    }

    res.json(contact);

  } catch (error) {
    console.error("Error fetching contact:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: "Invalid contact ID"
      });
    }
    
    res.status(500).json({
      error: "Failed to fetch contact"
    });
  }
});

// PUT - Update contact (Admin only)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      priority,
      notes,
      assignedTo,
      followUpDate
    } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (notes !== undefined) updateData.notes = notes;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (followUpDate) updateData.followUpDate = new Date(followUpDate);

    const updatedContact = await Contact.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedContact) {
      return res.status(404).json({
        error: "Contact not found"
      });
    }

    res.json({
      message: "Contact updated successfully",
      contact: updatedContact
    });

  } catch (error) {
    console.error("Error updating contact:", error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: "Validation failed",
        details: errors
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: "Invalid contact ID"
      });
    }
    
    res.status(500).json({
      error: "Failed to update contact"
    });
  }
});

// DELETE - Delete contact (Admin only)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deletedContact = await Contact.findByIdAndDelete(id);
    
    if (!deletedContact) {
      return res.status(404).json({
        error: "Contact not found"
      });
    }

    res.json({
      message: "Contact deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting contact:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: "Invalid contact ID"
      });
    }
    
    res.status(500).json({
      error: "Failed to delete contact"
    });
  }
});

// GET - Get contact statistics (Admin only)
router.get("/stats/overview", async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));

    const [
      totalContacts,
      newContacts,
      contactedContacts,
      inProgressContacts,
      closedContacts,
      thisMonthContacts,
      thisWeekContacts,
      statusStats,
      priorityStats,
      projectTypeStats
    ] = await Promise.all([
      Contact.countDocuments(),
      Contact.countDocuments({ status: 'new' }),
      Contact.countDocuments({ status: 'contacted' }),
      Contact.countDocuments({ status: 'in-progress' }),
      Contact.countDocuments({ status: 'closed' }),
      Contact.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Contact.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Contact.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Contact.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      Contact.aggregate([
        { $group: { _id: '$projectType', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      overview: {
        total: totalContacts,
        new: newContacts,
        contacted: contactedContacts,
        inProgress: inProgressContacts,
        closed: closedContacts
      },
      thisMonth: thisMonthContacts,
      thisWeek: thisWeekContacts,
      statusBreakdown: statusStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      priorityBreakdown: priorityStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      projectTypeBreakdown: projectTypeStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });

  } catch (error) {
    console.error("Error fetching contact stats:", error);
    res.status(500).json({
      error: "Failed to fetch contact statistics"
    });
  }
});

// POST - Bulk update contact status (Admin only)
router.post("/bulk/update", async (req, res) => {
  try {
    const { ids, updateData } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: "Contact IDs are required"
      });
    }

    const result = await Contact.updateMany(
      { _id: { $in: ids } },
      updateData,
      { runValidators: true }
    );

    res.json({
      message: `${result.modifiedCount} contacts updated successfully`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error("Error bulk updating contacts:", error);
    res.status(500).json({
      error: "Failed to update contacts"
    });
  }
});

// DELETE - Bulk delete contacts (Admin only)
router.post("/bulk/delete", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: "Contact IDs are required"
      });
    }

    const result = await Contact.deleteMany({ _id: { $in: ids } });

    res.json({
      message: `${result.deletedCount} contacts deleted successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error("Error bulk deleting contacts:", error);
    res.status(500).json({
      error: "Failed to delete contacts"
    });
  }
});

export default router;