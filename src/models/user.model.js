import { Schema, model } from 'mongoose';
import { USER_ROLES } from '../constants/index.js';

const userSchema = new Schema(
  {
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    age: { type: Number, min: 0 },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
    },
  },
  { timestamps: true, versionKey: false }
);

export const UserModel = model('User', userSchema);
