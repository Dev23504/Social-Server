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

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => console.log("Mongo Error:", err));

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

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
      console.log("SendMessage Error:", err);
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