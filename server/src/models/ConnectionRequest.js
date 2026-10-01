import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CONNECTION_STATUSES = ['pending', 'accepted', 'declined'];

/** The same key for (a, b) and (b, a): one connection record per pair of members. */
export function pairKey(a, b) {
  return [String(a), String(b)].sort().join(':');
}

const connectionRequestSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pairKey: { type: String, required: true, unique: true },
    status: { type: String, enum: CONNECTION_STATUSES, default: 'pending' },
    message: { type: String, trim: true, maxlength: 500, default: '' },
    respondedAt: Date,
  },
  { timestamps: true },
);

connectionRequestSchema.index({ recipient: 1, status: 1 });
connectionRequestSchema.index({ requester: 1, status: 1 });

export const ConnectionRequest = mongoose.model('ConnectionRequest', connectionRequestSchema);
