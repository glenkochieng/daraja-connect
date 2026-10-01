import mongoose from 'mongoose';

const { Schema } = mongoose;

export const MENTORSHIP_STATUSES = ['pending', 'accepted', 'declined', 'cancelled', 'completed'];
export const OPEN_STATUSES = ['pending', 'accepted'];

const mentorshipRequestSchema = new Schema(
  {
    mentee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mentor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: MENTORSHIP_STATUSES, default: 'pending' },
    // True while pending or accepted: at most one open request per mentee-mentor pair.
    open: { type: Boolean, default: true },
    message: { type: String, trim: true, maxlength: 1000, default: '' },
    responseMessage: { type: String, trim: true, maxlength: 1000, default: '' },
    // The recommendation the mentee acted on, if any (for evaluating the recommender).
    recommendation: { type: Schema.Types.ObjectId, ref: 'Recommendation' },
    respondedAt: Date,
    completedAt: Date,
  },
  { timestamps: true },
);

mentorshipRequestSchema.index(
  { mentee: 1, mentor: 1 },
  { unique: true, partialFilterExpression: { open: true }, name: 'one_open_request_per_pair' },
);
mentorshipRequestSchema.index({ mentor: 1, status: 1, createdAt: -1 });
mentorshipRequestSchema.index({ mentee: 1, status: 1, createdAt: -1 });

export const MentorshipRequest = mongoose.model('MentorshipRequest', mentorshipRequestSchema);
