import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import { Server } from "socket.io";
import http from "http";
import Message from "./models/Message.js";
import User from "./models/User.js";

dns.setDefaultResultOrder("ipv4first");
dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

let onlineUsers = {};

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("Mongo Error:", err.message));

server.listen(PORT, () => console.log("Server running on", PORT));

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
      console.log("Message Error:", err.message);
    }
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