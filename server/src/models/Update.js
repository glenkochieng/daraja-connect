import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Organisational update for the feed (plain text). */
const updateSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    body: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
    pinned: { type: Boolean, default: false },
    publishedAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sample: { type: Boolean, default: false },
  },
  { timestamps: true },
);

updateSchema.index({ pinned: -1, publishedAt: -1 });

export const Update = mongoose.model('Update', updateSchema);
