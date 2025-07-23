import mongoose from "mongoose";

const ClientSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, 'Client name is required'],
      trim: true,
      maxlength: [100, 'Client name cannot exceed 100 characters']
    },
    logo: { 
      type: String, 
      required: [true, 'Client logo is required']
    },
    logoPublicId: { 
      type: String,
      default: ''
    }
  },
  { 
    timestamps: true
  }
);

// Index for better query performance
ClientSchema.index({ name: 1 });
ClientSchema.index({ createdAt: -1 });

export default mongoose.model("Client", ClientSchema);