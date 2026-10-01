import mongoose from 'mongoose';

const { Schema } = mongoose;

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    startsAt: { type: Date, required: true },
    endsAt: Date,
    location: { type: String, trim: true, maxlength: 200, default: '' },
    isOnline: { type: Boolean, default: false },
    onlineUrl: { type: String, trim: true, maxlength: 500, default: '' },
    // null or missing = unlimited places
    capacity: { type: Number, min: 1, default: null },
    rsvpCount: { type: Number, min: 0, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sample: { type: Boolean, default: false },
  },
  { timestamps: true },
);

eventSchema.index({ startsAt: 1 });

export const Event = mongoose.model('Event', eventSchema);

const rsvpSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

rsvpSchema.index({ event: 1, user: 1 }, { unique: true });
rsvpSchema.index({ user: 1 });

export const Rsvp = mongoose.model('Rsvp', rsvpSchema);
