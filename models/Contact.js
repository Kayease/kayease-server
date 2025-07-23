import mongoose from "mongoose";

const ContactSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 100
    },
    email: { 
      type: String, 
      required: true,
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, 'Please enter a valid email address']
    },
    phone: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 20
    },
    company: { 
      type: String, 
      trim: true,
      maxlength: 100
    },
    projectType: { 
      type: String, 
      required: true,
      enum: [
        'web-development',
        'mobile-app',
        'ecommerce',
        'digital-marketing',
        'branding',
        'consulting',
        'other'
      ]
    },
    budget: { 
      type: String, 
      required: true,
      enum: [
        '5k-15k',
        '15k-30k',
        '30k-50k',
        '50k-100k',
        '100k+',
        'discuss'
      ]
    },
    timeline: { 
      type: String,
      enum: [
        'asap',
        '1-3-months',
        '3-6-months',
        '6-12-months',
        'flexible'
      ]
    },
    message: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 2000
    },
    newsletter: { 
      type: Boolean, 
      default: false 
    },
    terms: { 
      type: Boolean, 
      required: true,
      validate: {
        validator: function(v) {
          return v === true;
        },
        message: 'Terms and conditions must be accepted'
      }
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'in-progress', 'quoted', 'closed', 'archived'],
      default: 'new'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    notes: {
      type: String,
      maxlength: 1000
    },
    assignedTo: {
      type: String,
      trim: true
    },
    followUpDate: {
      type: Date
    },
    source: {
      type: String,
      default: 'website'
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for project type label
ContactSchema.virtual('projectTypeLabel').get(function() {
  const projectTypeLabels = {
    'web-development': 'Web Development',
    'mobile-app': 'Mobile App Development',
    'ecommerce': 'E-commerce Solution',
    'digital-marketing': 'Digital Marketing',
    'branding': 'Branding & Design',
    'consulting': 'Digital Consulting',
    'other': 'Other'
  };
  return projectTypeLabels[this.projectType] || this.projectType;
});

// Virtual for budget label
ContactSchema.virtual('budgetLabel').get(function() {
  const budgetLabels = {
    '5k-15k': '$5,000 - $15,000',
    '15k-30k': '$15,000 - $30,000',
    '30k-50k': '$30,000 - $50,000',
    '50k-100k': '$50,000 - $100,000',
    '100k+': '$100,000+',
    'discuss': 'Let\'s Discuss'
  };
  return budgetLabels[this.budget] || this.budget;
});

// Index for better query performance
ContactSchema.index({ email: 1 });
ContactSchema.index({ createdAt: -1 });
ContactSchema.index({ status: 1 });
ContactSchema.index({ priority: 1 });

export default mongoose.model("Contact", ContactSchema);