import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Server } from "socket.io";
import http from "http";
import Message from "./models/Message.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

let onlineUsers = {};

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Server running on ${PORT}`));
  })
  .catch((err) => console.log(err));

io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    socket.join(userId);
    onlineUsers[userId] = socket.id;
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });

  socket.on("sendMessage", async (data) => {
    try {
      const msg = new Message({
        sender: data.sender,
        receiver: data.receiver,
        text: data.text || "",
        file: data.file || "",
        type: data.type || "text",
      });

      const savedMsg = await msg.save();

      io.to(data.receiver).emit("receiveMessage", savedMsg);
      io.to(data.sender).emit("receiveMessage", savedMsg);
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("typing", ({ sender, receiver }) => {
    io.to(receiver).emit("typing", sender);
  });

  socket.on("stopTyping", ({ sender, receiver }) => {
    io.to(receiver).emit("stopTyping", sender);
  });

  socket.on("disconnect", () => {
    for (let user in onlineUsers) {
      if (onlineUsers[user] === socket.id) {
        delete onlineUsers[user];
        break;
      }
    }
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });
});

app.get("/messages/:user1/:user2", async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch {
    res.status(500).json({ error: "error" });
  }
});

app.get("/users/:username", async (req, res) => {
  try {
    const users = await User.find({
      username: { $ne: req.params.username },
    }).select("-password");

    res.json(users);
  } catch {
    res.status(500).json([]);
  }
});

app.post("/follow", async (req, res) => {
  try {
    const { currentUser, targetUser } = req.body;

    await User.updateOne(
      { username: currentUser },
      { $addToSet: { following: targetUser } }
    );

    await User.updateOne(
      { username: targetUser },
      { $addToSet: { followers: currentUser } }
    );

    res.json({ message: "done" });
  } catch {
    res.status(500).json({ message: "error" });
  }
});