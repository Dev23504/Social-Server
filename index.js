import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import Message from "./models/Message.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let onlineUsers = {};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
      console.log("Server running on", PORT);
    });

  } catch (err) {
    console.log("Mongo Error ❌:", err.message);
    process.exit(1);
  }
};

connectDB();

io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    if (!userId) return;

    socket.join(userId);
    onlineUsers[userId] = socket.id;

    io.emit("onlineUsers", Object.keys(onlineUsers));
  });

  socket.on("sendMessage", async (data) => {
    try {
      if (!data.sender || !data.receiver) return;

      const msg = await Message.create({
        sender: data.sender,
        receiver: data.receiver,
        text: data.text || "",
        file: data.file || "",
        type: data.type || "text",
      });

      io.to(data.receiver).emit("receiveMessage", msg);
      io.to(data.sender).emit("receiveMessage", msg);

    } catch (err) {
      console.log(err.message);
    }
  });

  socket.on("typing", ({ sender, receiver }) => {
    if (receiver) io.to(receiver).emit("typing", sender);
  });

  socket.on("stopTyping", ({ sender, receiver }) => {
    if (receiver) io.to(receiver).emit("stopTyping", sender);
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
    const messages = await Message.find({
      $or: [
        { sender: req.params.user1, receiver: req.params.user2 },
        { sender: req.params.user2, receiver: req.params.user1 },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);

  } catch (err) {
    res.status(500).json({ error: err.message });
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

    if (!currentUser || !targetUser) {
      return res.status(400).json({ message: "Missing data" });
    }

    await User.updateOne(
      { username: currentUser },
      { $addToSet: { following: targetUser } }
    );

    await User.updateOne(
      { username: targetUser },
      { $addToSet: { followers: currentUser } }
    );

    res.json({ message: "Followed successfully" });

  } catch {
    res.status(500).json({ message: "error" });
  }
});