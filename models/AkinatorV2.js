import mongoose from 'mongoose';

// Daftar region yang valid
const regions = ['en', 'ar', 'cn', 'de', 'es', 'fr', 'il', 'it', 'jp', 'kr', 'nl', 'pt', 'ru', 'tr', 'id'];

const akiSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  region: {
    type: String,
    required: true,
    enum: regions,
    default: 'en',
  },
  childMode: {
    type: Boolean,
    default: false,
  },
  progress: {
    type: String,
    default: '0.00000',
  },
  currentStep: {
    type: Number,
    default: 0,
  },
  currentQuestion: {
    type: String,
    required: true,
  },
  stepLastProposition: {
    type: String,
    default: '',
  },
  signature: {
    type: String,
    default: '',
  },
  session: {
    type: String,
    required: true,
  },
  guessed: {
    id: {
      type: String,
      default: null,
    },
    name: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
    photo: {
      type: String,
      default: null,
    },
  },
  akiWin: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

const akiSession = mongoose.models.AkinatorSessionV2 || mongoose.model('AkinatorSessionV2', akiSessionSchema);

export default akiSession;
