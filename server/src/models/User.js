import mongoose from 'mongoose';

const { Schema } = mongoose;

export const USER_TYPES = ['pride_alumni', 'current_staff', 'former_staff'];
export const USER_STATUSES = ['pending', 'approved', 'rejected'];

const certificationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    issuer: { type: String, trim: true, maxlength: 160 },
    year: { type: Number, min: 1950, max: 2100 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['member', 'admin'], default: 'member' },
    // Pride Centre alumni are mentees; current and former Kenya Airways staff are mentors.
    userType: { type: String, enum: USER_TYPES, required: true },
    status: { type: String, enum: USER_STATUSES, default: 'pending' },
    statusChangedAt: Date,
    statusChangedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    statusReason: { type: String, maxlength: 500 },
    consent: {
      given: { type: Boolean, required: true },
      givenAt: { type: Date, required: true },
    },
    // Id from the synthetic dataset (e.g. MTR-0001) for seeded sample profiles.
    externalId: { type: String, index: { sparse: true } },
    lastLoginAt: Date,

    profile: {
      headline: { type: String, trim: true, maxlength: 160 },
      bio: { type: String, trim: true, maxlength: 2000 },
      location: { type: String, trim: true, maxlength: 120 },
      specialisation: { type: String, trim: true },
      yearsExperience: { type: Number, min: 0, max: 60 },
      roleTitle: { type: String, trim: true, maxlength: 120 },
      department: { type: String, trim: true, maxlength: 120 },
      fleetExperience: { type: [String], default: [] },
      skills: { type: [String], default: [] },
      certifications: { type: [certificationSchema], default: [] },
      linkedinUrl: { type: String, trim: true, maxlength: 300 },
    },

    mentor: {
      expertiseText: { type: String, trim: true, maxlength: 3000, default: '' },
      canMentorIn: { type: [String], default: [] },
      maxMentees: { type: Number, min: 0, max: 10, default: 2 },
      currentMentees: { type: Number, min: 0, default: 0 },
      isAvailable: { type: Boolean, default: true },
    },

    mentee: {
      prideProgramme: { type: String, trim: true },
      graduationYear: { type: Number, min: 1990, max: 2100 },
      goalsText: { type: String, trim: true, maxlength: 3000, default: '' },
      wantsToLearn: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

userSchema.virtual('isMentor').get(function isMentor() {
  return this.userType !== 'pride_alumni';
});
userSchema.virtual('isMentee').get(function isMentee() {
  return this.userType === 'pride_alumni';
});

userSchema.index({ status: 1, userType: 1, 'profile.specialisation': 1 });
userSchema.index(
  {
    name: 'text',
    'profile.headline': 'text',
    'profile.roleTitle': 'text',
    'profile.bio': 'text',
    'mentor.expertiseText': 'text',
    'mentee.goalsText': 'text',
  },
  {
    name: 'directory_text',
    weights: { name: 10, 'profile.headline': 5, 'profile.roleTitle': 5, 'mentor.expertiseText': 2 },
  },
);

export const User = mongoose.model('User', userSchema);
