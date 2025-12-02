// src/repositories/user.repo.ts
import { FilterQuery } from "mongoose";
import User, { IUser } from "../models/User";

export type UserListOpts = {
  page?: number;
  limit?: number;
  q?: string;
  includeInactive?: boolean;
  role?: "super_admin" | "editor";
};

export const userRepo = {
  async create(data: Partial<IUser>) {
    const doc = new User(data);
    return doc.save();
  },

  async update(id: string, data: Partial<IUser>) {
    const doc = await User.findById(id);
    if (!doc) return null;
    Object.assign(doc, data);
    return doc.save();
  },

  async delete(id: string) {
    return User.findByIdAndDelete(id);
  },

  async getByEmail(email: string) {
    return User.findOne({ email: email.toLowerCase() });
  },

  async getById(id: string) {
    return User.findById(id);
  },

  async list(opts: UserListOpts = {}) {
    const { page = 1, limit = 20, q, includeInactive = false, role } = opts;

    const filter: FilterQuery<IUser> = {};
    if (!includeInactive) filter.isActive = true;
    if (role) filter.role = role;
    if (q?.trim()) {
      const keyword = new RegExp(q.trim(), "i");
      filter.$or = [{ email: keyword }, { name: keyword }];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  },
};
