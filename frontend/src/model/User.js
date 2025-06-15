import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ["user", "assistant"],
  },
  content: {
    type: Schema.Types.Mixed,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});
const notesSchema = new Schema({
  type: {
    type: String,
    required: true,
  },
  content: {
    type: Schema.Types.Mixed,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const conversationSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  notes: [notesSchema],
  messages: [messageSchema],
});

const folderSchema = new Schema(
  {
    folderName: {
      type: String,
      required: true,
      unique: true,
    },
    conversations: [conversationSchema],
  },
  { timestamps: true }
);

const userSchema = new Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Please use a valid email",
    ],
    unique: true,
  },
  password: {
    type: String,
    required: true,
    trim: true,
  },
  verifyCode: {
    type: String,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verifyCodeExpiry: {
    type: Date,
  },

  folders: [folderSchema],
});

const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

export default UserModel;
