import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Every mentor recommendation shown to a mentee. Together with the requests that
 * link back to it, this is the data needed to evaluate the recommender with real
 * users (rank of the mentor a mentee chose, acceptance rate per rank, ...).
 */
const recommendationSchema = new Schema(
  {
    mentee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mentor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    batchId: { type: String, required: true },
    rank: { type: Number, required: true, min: 1 },
    score: { type: Number, required: true },
    blockScores: {
      text: { type: Number, default: null },
      skills: { type: Number, default: null },
      specialisation: { type: Number, default: null },
    },
    reasons: { type: [String], default: [] },
    configVersion: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

recommendationSchema.index({ mentee: 1, createdAt: -1 });
recommendationSchema.index({ batchId: 1 });

export const Recommendation = mongoose.model('Recommendation', recommendationSchema);
