import mongoose from "mongoose";

const PortfolioSchema = new mongoose.Schema(
  {
    // Basic Information
    title: { 
      type: String, 
      required: true,
      trim: true 
    },
    excerpt: { 
      type: String, 
      required: true,
      trim: true 
    },
    projectOverview: { 
      type: String, 
      required: true,
      trim: true 
    },
    clientName: { 
      type: String, 
      required: true,
      trim: true 
    },
    completedDate: { 
      type: Date, 
      required: true 
    },
    
    // Project Details
    technologies: [{ 
      type: String, 
      trim: true 
    }],
    liveDomainLink: { 
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Live domain link must be a valid URL'
      }
    },
    challenges: { 
      type: String,
      trim: true 
    },
    
    // Project Settings
    status: {
      type: String,
      enum: ["completed", "in-progress", "on-hold"],
      default: "completed",
    },
    category: {
      type: String,
      enum: ["web-dev", "mobile", "ecommerce", "saas", "healthcare", "fintech", "education", "other"],
      default: "web-dev",
    },
    featured: { 
      type: Boolean, 
      default: false 
    },
    
    // Images
    mainImage: { 
      type: String,
      required: true 
    },
    mainImagePublicId: { 
      type: String 
    },
    galleryImages: [{ 
      type: String 
    }],
    galleryImagePublicIds: [{ 
      type: String 
    }],
    
    // SEO and Meta
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Create slug from title before saving
PortfolioSchema.pre('save', function(next) {
  if (this.isModified('title') || this.isNew) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  next();
});

// Virtual for category name
PortfolioSchema.virtual('categoryName').get(function() {
  const categoryMap = {
    'web-dev': 'Web Development',
    'mobile': 'Mobile Development',
    'ecommerce': 'E-commerce',
    'saas': 'SaaS',
    'healthcare': 'Healthcare',
    'fintech': 'Fintech',
    'education': 'Education',
    'other': 'Other'
  };
  return categoryMap[this.category] || 'Other';
});

// Index for better query performance
PortfolioSchema.index({ featured: -1, createdAt: -1 });
PortfolioSchema.index({ category: 1, createdAt: -1 });
PortfolioSchema.index({ status: 1, createdAt: -1 });
PortfolioSchema.index({ slug: 1 });

export default mongoose.model("Portfolio", PortfolioSchema);
