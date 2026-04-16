import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  profilePic: String,
  followers: [String],
  following: [String],
});

const User = mongoose.model("User", userSchema);

export default User;