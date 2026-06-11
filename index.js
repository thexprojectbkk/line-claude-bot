import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// เก็บประวัติข้อความแต่ละกลุ่ม
const messageHistory = {};

// Health check สำหรับ UptimeRobot
app.get("/", (req, res) => res.send("OK"));

app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // ตอบ LINE ทันที

  const events = req.body.events;
  for (const event of events) {
    // ตอบรับคำเชิญเข้ากลุ่มอัตโนมัติ
    if (event.type === "join") {
      await replyLine(event.replyToken, "สวัสดีครับ! พิม /สรุป เมื่อต้องการให้ผมสรุปการสนทนา 😊");
      continue;
    }

    if (event.type !== "message" || event.message.type !== "text") continue;

    const text = event.message.text;
    const sourceId = event.source.groupId || event.source.userId;

    // สะสมข้อความในกลุ่ม
    if (!messageHistory[sourceId]) messageHistory[sourceId] = [];
    messageHistory[sourceId].push(text);

    // ถ้าพิม /สรุป → ให้ Claude สรุป
    if (text === "/สรุป") {
      const history = messageHistory[sourceId].slice(-50).join("\n");
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `สรุปการสนทนาต่อไปนี้เป็นภาษาไทย:\n${history}`
        }]
      });
      await replyLine(event.replyToken, response.content[0].text);
      messageHistory[sourceId] = []; // clear หลังสรุป
    }
  }
});

async function replyLine(replyToken, text) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_TOKEN}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }]
    })
  });
}

app.listen(3000, () => console.log("Bot running on port 3000"));
