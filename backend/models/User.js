const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  govtID: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  role: {
    type: String,
    required: true,
    enum: ['voter', 'admin'],
    default: 'voter'
  }
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ govtID: 1 });
userSchema.index({ role: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;