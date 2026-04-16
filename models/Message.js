import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: String,
    receiver: String,
    text: String,
    file: String,
    type: String,
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;