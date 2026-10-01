import mongoose from 'mongoose';

const { Schema } = mongoose;

export const ARTICLE_STATUSES = ['pending', 'approved', 'rejected'];

/**
 * Knowledge repository article. Bodies are plain text (paragraphs separated by
 * blank lines); the client renders them as text, never as HTML.
 */
const articleSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    summary: { type: String, trim: true, maxlength: 300, default: '' },
    body: { type: String, required: true, trim: true, minlength: 20, maxlength: 20000 },
    category: { type: String, required: true, trim: true },
    topics: { type: [String], default: [] },
    status: { type: String, enum: ARTICLE_STATUSES, default: 'pending' },
    moderationNote: { type: String, trim: true, maxlength: 500, default: '' },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: Date,
    publishedAt: Date,
    // Seeded example content (shown with a "Sample" label).
    sample: { type: Boolean, default: false },
  },
  { timestamps: true },
);

articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ author: 1, createdAt: -1 });
articleSchema.index(
  { title: 'text', summary: 'text', body: 'text' },
  { name: 'article_text', weights: { title: 10, summary: 5, body: 1 } },
);

export const Article = mongoose.model('Article', articleSchema);
