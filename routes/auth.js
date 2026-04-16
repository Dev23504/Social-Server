import express from "express";

const router = express.Router();

router.post("/register", (req, res) => {
  console.log("API HIT", req.body);
  res.json({ msg: "Register working" });
});

export default router; 